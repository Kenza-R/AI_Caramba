/**
 * Agent 1 — The Historian (x-timeline-scraper only):
 * 1) x-timeline-scraper fetch from authenticated cURL
 * 2) optional headless cURL auto-capture + retry (explicitly allowed only)
 */
import {
  clearTweetsForHandle,
  insertTweet,
  getCorpusMeta,
  saveCorpusMeta,
  getTweetsForHandle,
  getAnalysis,
} from "../db/database.js";
import { lookupTwitterProfileByUsername } from "../lib/twitterUser.js";
import { fetchViaXTimelineScraper } from "../lib/xTimelineScrape.js";
import { captureXTimelineCurl } from "../lib/xTimelineCapture.js";
import { fallbackAvatarUrl, canonicalXHandle } from "../lib/avatars.js";

const THREE_YEARS_MS = 3 * 365 * 24 * 60 * 60 * 1000;
const MIN_TWEETS_OK = 72;
const MIN_CORPUS_SPAN_DAYS = 30;
const MIN_ANALYSIS_TWEETS = Math.max(
  40,
  Math.min(1200, Number(process.env.MIN_ANALYSIS_TWEETS || 120) || 120)
);
const HARD_MIN_TWEETS = 40;
const ANALYSIS_MAX_POSTS_DEFAULT = Math.max(
  200,
  Math.min(3200, Number(process.env.ANALYSIS_MAX_POSTS || 1200) || 1200)
);
const XTIMELINE_AUTO_CAPTURE =
  String(process.env.XTIMELINE_AUTO_CAPTURE || "true").toLowerCase() !== "false";

function corpusSourceTrusted(source) {
  return Boolean(source);
}

function corpusSpanDays(oldestIso, newestIso) {
  if (!oldestIso || !newestIso) return 0;
  const a = new Date(oldestIso).getTime();
  const b = new Date(newestIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, (b - a) / 86400000);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Remove invalid Unicode surrogate code units that can break JSON encoding
 * for upstream model APIs.
 */
function sanitizeUnicode(s) {
  return String(s || "").replace(
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
    ""
  );
}

async function twitterFetch(path, bearer) {
  const res = await fetch(`https://api.twitter.com/2/${path}`, {
    headers: { Authorization: `Bearer ${bearer}` },
  });
  if (res.status === 429) {
    const reset = res.headers.get("x-rate-limit-reset");
    const waitSec = reset ? Math.max(1, Number(reset) - Math.floor(Date.now() / 1000)) : 5;
    await sleep(Math.min(waitSec * 1000, 90_000));
    throw new Error("Twitter rate limited — retrying");
  }
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Twitter API ${res.status}: ${errText.slice(0, 400)}`);
  }
  return res.json();
}

async function fetchUserByUsername(username, bearer) {
  const u = encodeURIComponent(username.replace(/^@/, ""));
  const data = await twitterFetch(`users/by/username/${u}?user.fields=profile_image_url,description,name,username`, bearer);
  if (!data.data) throw new Error("User not found on Twitter/X");
  return data.data;
}

async function fetchAllTweets(userId, bearer, startIso, maxPosts) {
  const tweets = [];
  let token = null;
  const fields = "created_at,public_metrics";
  for (let n = 0; n < 40; n++) {
    const qs = new URLSearchParams({
      max_results: "100",
      "tweet.fields": fields,
      exclude: "retweets",
      start_time: startIso,
    });
    if (token) qs.set("pagination_token", token);
    const path = `users/${userId}/tweets?${qs.toString()}`;
    const data = await withRetries(() => twitterFetch(path, bearer), { retries: 4, baseMs: 2000 });
    const batch = data.data || [];
    for (const tw of batch) {
      const m = tw.public_metrics || {};
      tweets.push({
        id: tw.id,
        tweet_text: tw.text || "",
        created_at: tw.created_at,
        likes: m.like_count ?? 0,
        retweets: m.retweet_count ?? 0,
        replies: m.reply_count ?? 0,
      });
    }
    token = data.meta?.next_token;
    if (!token || tweets.length >= maxPosts) break;
  }
  return tweets.slice(0, maxPosts);
}

async function fetchViaApify(handle, startIso, maxPosts) {
  const token = process.env.APIFY_API_TOKEN;
  const actor = process.env.APIFY_TWITTER_ACTOR_ID;
  if (!token) throw new Error("Apify token not configured");
  if (!actor) throw new Error("Set APIFY_TWITTER_ACTOR_ID");
  const input = {
    searchTerms: [`from:${handle.replace(/^@/, "")}`],
    maxTweets: maxPosts,
    since: startIso.slice(0, 10),
  };
  const runRes = await fetch(
    `https://api.apify.com/v2/acts/${actor}/runs?token=${token}&waitForFinish=120`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );
  if (!runRes.ok) {
    const t = await runRes.text();
    throw new Error(`Apify run failed: ${runRes.status} ${t.slice(0, 300)}`);
  }
  const run = await runRes.json();
  const ds = run.data?.defaultDatasetId;
  if (!ds) throw new Error("Apify: no dataset id");
  const itemsRes = await fetch(
    `https://api.apify.com/v2/datasets/${ds}/items?token=${token}&clean=true&format=json`
  );
  if (!itemsRes.ok) throw new Error("Apify dataset fetch failed");
  const items = await itemsRes.json();
  const tweets = [];
  for (const it of items) {
    const text = it.text || it.full_text || "";
    if (!text) continue;
    tweets.push({
      id: String(it.id || it.tweetId || Math.random()),
      tweet_text: text,
      created_at: it.createdAt || it.created_at || new Date().toISOString(),
      likes: it.likeCount ?? it.like_count ?? 0,
      retweets: it.retweetCount ?? it.retweet_count ?? 0,
      replies: it.replyCount ?? it.reply_count ?? 0,
    });
  }
  tweets.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  return tweets.slice(0, maxPosts);
}

function dedupeTweets(tweets) {
  const seen = new Set();
  const out = [];
  for (const t of tweets) {
    const cleanText = sanitizeUnicode(t.tweet_text || "");
    const key = `${(t.created_at || "").slice(0, 10)}|${cleanText.slice(0, 140).toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...t, tweet_text: cleanText });
  }
  return out.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

function sampleEvenlyByTime(sortedTweets, maxPosts) {
  if (!Array.isArray(sortedTweets) || sortedTweets.length <= maxPosts) return sortedTweets;
  const n = sortedTweets.length;
  const out = [];
  const seen = new Set();
  const step = (n - 1) / (maxPosts - 1);
  for (let i = 0; i < maxPosts; i++) {
    const idx = Math.round(i * step);
    const clamped = Math.max(0, Math.min(n - 1, idx));
    if (seen.has(clamped)) continue;
    seen.add(clamped);
    out.push(sortedTweets[clamped]);
  }
  if (out.length < maxPosts) {
    for (let i = 0; i < n && out.length < maxPosts; i++) {
      if (seen.has(i)) continue;
      seen.add(i);
      out.push(sortedTweets[i]);
    }
  }
  return out.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

export async function runScraperAgent(handle, emit, opts = {}) {
  const normalized = handle.replace(/^@/, "").toLowerCase();
  const start = new Date(Date.now() - THREE_YEARS_MS).toISOString();
  const allowXCapture = Boolean(opts.allowXCapture);
  const maxPosts = Math.max(
    200,
    Math.min(3200, Number(opts.maxPosts || ANALYSIS_MAX_POSTS_DEFAULT) || ANALYSIS_MAX_POSTS_DEFAULT)
  );
  const forceRescrape =
    Boolean(opts.forceRescrape) || process.env.FORCE_RESCRAPE === "true";
  let tweets = [];
  let profile = null;
  let source = "xtimeline";

  if (!forceRescrape) {
    const meta = getCorpusMeta(normalized);
    const cached = getTweetsForHandle(normalized);
    const span = corpusSpanDays(cached[0]?.created_at, cached[cached.length - 1]?.created_at);
    const trusted = corpusSourceTrusted(meta?.source);
    if (trusted && cached.length >= MIN_TWEETS_OK && span >= MIN_CORPUS_SPAN_DAYS) {
      let twProfile = await lookupTwitterProfileByUsername(normalized);
      if (!twProfile) {
        const prev = getAnalysis(normalized);
        if (prev?.profile?.username) twProfile = prev.profile;
      }
      if (!twProfile) {
        twProfile = {
          id: `cached_${normalized}`,
          name: normalized,
          username: canonicalXHandle(normalized),
          description: "Loaded from previously saved corpus.",
          profile_image_url: fallbackAvatarUrl(normalized),
        };
      }
      const sortedAll = [...cached]
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      const sorted = sampleEvenlyByTime(sortedAll, maxPosts);
      emit({
        stage: "scraper",
        message: `Loaded ${sorted.length} posts from saved corpus (database • ${meta.source}).`,
        detail: `Span ≈ ${Math.round(span)} days. Set FORCE_RESCRAPE=true to fetch fresh posts.`,
        progress: 0.24,
        done: true,
      });
      return {
        handle: normalized,
        profile: {
          id: twProfile.id || "cached",
          name: twProfile.name,
          username: twProfile.username || normalized,
          description: twProfile.description || "",
          profile_image_url: twProfile.profile_image_url || "",
        },
        tweets: sorted,
        dateRange: {
          start: sorted[0]?.created_at || start,
          end: sorted[sorted.length - 1]?.created_at || new Date().toISOString(),
        },
        scrapeMeta: {
          source: "database_cache",
          underlying: meta.source,
          tweet_count: sorted.length,
        },
      };
    }
  }

  emit({
    stage: "scraper",
    message: "Fetching via x-timeline-scraper…",
    detail: "x-timeline-scraper is the only enabled corpus source.",
    progress: 0.08,
  });
  let attemptedAutoCapture = false;
  try {
    tweets = await fetchViaXTimelineScraper({
      handle: normalized,
      startIso: start,
      maxPosts,
    });
    if (!tweets.length && allowXCapture && XTIMELINE_AUTO_CAPTURE) {
      attemptedAutoCapture = true;
      emit({
        stage: "scraper",
        message: "Auto-capturing X timeline request…",
        detail: "x-timeline returned 0 posts; refreshing request from browser session.",
        progress: 0.12,
      });
      const cap = await captureXTimelineCurl(normalized);
      emit({
        stage: "scraper",
        message: "Auto-capturing X timeline request…",
        detail: `Saved refreshed request to ${cap.savePath}`,
        progress: 0.15,
      });
      tweets = await fetchViaXTimelineScraper({
        handle: normalized,
        startIso: start,
        maxPosts,
      });
    }
  } catch (e) {
    if (allowXCapture && XTIMELINE_AUTO_CAPTURE && !attemptedAutoCapture) {
      try {
        emit({
          stage: "scraper",
          message: "Auto-capturing X timeline request…",
          detail: "Opening profile in headless browser to refresh auth cURL.",
          progress: 0.12,
        });
        const cap = await captureXTimelineCurl(normalized);
        emit({
          stage: "scraper",
          message: "Auto-capturing X timeline request…",
          detail: `Saved refreshed request to ${cap.savePath}`,
          progress: 0.15,
        });
        tweets = await fetchViaXTimelineScraper({
          handle: normalized,
          startIso: start,
          maxPosts,
        });
      } catch (e2) {
        throw new Error(
          `x-timeline-scraper failed and auto-capture retry failed: ${String(e2.message || e2)}`
        );
      }
    } else {
      throw new Error(`x-timeline-scraper failed: ${String(e.message || e)}`);
    }
  }

  tweets = dedupeTweets(tweets);
  if (tweets.length < HARD_MIN_TWEETS) {
    throw new Error(
      `x-timeline-scraper returned only ${tweets.length} posts (minimum ${HARD_MIN_TWEETS}). ` +
      "Provide a valid authenticated cURL in server/curl.txt and retry."
    );
  }
  if (tweets.length < MIN_ANALYSIS_TWEETS) {
    emit({
      stage: "scraper",
      message: `Collected ${tweets.length} posts (below target ${MIN_ANALYSIS_TWEETS}, proceeding with available corpus).`,
      progress: 0.2,
    });
  }

  profile = await lookupTwitterProfileByUsername(normalized).catch(() => null);
  if (!profile) {
    profile = {
      id: `xtimeline_${normalized}`,
      name: normalized,
      username: canonicalXHandle(normalized),
      description: "Fetched via x-timeline-scraper.",
      profile_image_url: fallbackAvatarUrl(normalized),
    };
  }

  tweets = dedupeTweets(tweets);
  const startMs = new Date(start).getTime();
  // Keep analysis bounded to ~3 years and configured corpus size.
  const filtered = tweets
    .filter((t) => {
      const ms = new Date(t.created_at).getTime();
      return Number.isFinite(ms) && ms >= startMs;
    });
  tweets = sampleEvenlyByTime(filtered, maxPosts);

  clearTweetsForHandle(normalized);
  for (const t of tweets) {
    insertTweet({
      id: t.id,
      handle: normalized,
      tweet_text: sanitizeUnicode(t.tweet_text),
      created_at: t.created_at,
      likes: t.likes,
      retweets: t.retweets,
      replies: t.replies,
    });
  }

  const sorted = [...tweets].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  saveCorpusMeta(normalized, {
    source,
    tweet_count: sorted.length,
    oldest_at: sorted[0]?.created_at ?? null,
    newest_at: sorted[sorted.length - 1]?.created_at ?? null,
  });
  emit({
    stage: "scraper",
    message: `Stored ${sorted.length} tweets in database (${source}).`,
    progress: 0.24,
    done: true,
  });

  return {
    handle: normalized,
    profile: {
      id: profile.id,
      name: profile.name,
      username: profile.username,
      description: profile.description || "",
      profile_image_url: profile.profile_image_url || "",
    },
    tweets: sorted,
    dateRange: {
      start: sorted[0]?.created_at || start,
      end: sorted[sorted.length - 1]?.created_at || new Date().toISOString(),
    },
    scrapeMeta: { source, tweet_count: sorted.length },
  };
}
