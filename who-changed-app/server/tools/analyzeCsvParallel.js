import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import { runClassifierAgent } from "../agents/classifierAgent.js";
import { runShiftDetectorAgent } from "../agents/shiftDetectorAgent.js";
import { runContextAgent } from "../agents/contextAgent.js";
import { runNarratorAgent } from "../agents/narratorAgent.js";
import { lookupTwitterProfileByUsername } from "../lib/twitterUser.js";
import { fallbackAvatarUrl } from "../lib/avatars.js";
import {
  clearTweetsForHandle,
  insertTweet,
  saveCorpusMeta,
  saveAnalysis,
} from "../db/database.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const TOPIC_KEYWORDS = {
  immigration: ["border", "immigration", "migrant", "deport", "asylum", "visa"],
  economy: ["economy", "inflation", "jobs", "tax", "tariff", "market", "price"],
  climate: ["climate", "energy", "emissions", "oil", "gas", "renewable"],
  healthcare: ["health", "medicare", "medicaid", "drug", "hospital", "insurance", "vaccine"],
  foreign_policy: ["china", "russia", "ukraine", "nato", "iran", "israel", "war"],
  social_issues: ["abortion", "rights", "crime", "education", "trans", "family", "values"],
  media_free_speech: ["media", "press", "censorship", "speech", "platform", "journalist", "fake news"],
};
const TOPIC_PRETTY = {
  immigration: "Immigration",
  economy: "Economy",
  climate: "Climate",
  healthcare: "Healthcare",
  foreign_policy: "Foreign Policy",
  social_issues: "Social Issues",
  media_free_speech: "Media / Free Speech",
};

function parseCsvText(text) {
  const rows = [];
  let row = [];
  let field = "";
  let i = 0;
  let inQuotes = false;

  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 2;
        continue;
      }
      if (ch === '"') {
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function rowObjects(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map((h) =>
    String(h || "")
      .replace(/^\uFEFF/, "")
      .trim()
      .toLowerCase()
  );
  return rows.slice(1).map((r) => {
    const o = {};
    headers.forEach((h, idx) => {
      o[h] = String(r[idx] ?? "");
    });
    return o;
  });
}

function parseCreatedAt(v) {
  const s = String(v || "").trim();
  if (!s) return null;
  const iso = s.includes("T") ? s : `${s.replace(" ", "T")}Z`;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

function numberOr0(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeTweetId(v) {
  return String(v || "").replace(/'/g, "").trim();
}

function corpusSpanDays(tweets) {
  if (!tweets.length) return 0;
  const min = new Date(tweets[0].created_at).getTime();
  const max = new Date(tweets[tweets.length - 1].created_at).getTime();
  if (!Number.isFinite(min) || !Number.isFinite(max)) return 0;
  return Math.max(0, (max - min) / 86400000);
}

function periodKeyForDate(d, useQuarter) {
  const y = d.getUTCFullYear();
  if (useQuarter) {
    const q = Math.floor(d.getUTCMonth() / 3) + 1;
    return `${y}-Q${q}`;
  }
  const half = d.getUTCMonth() < 6 ? "H1" : "H2";
  return `${y}-${half}`;
}

function tweetContainsTopic(tweetText, topic) {
  const txt = String(tweetText || "").toLowerCase();
  const kws = TOPIC_KEYWORDS[topic] || [];
  return kws.some((kw) => txt.includes(kw));
}

function computeBaselineUsage(tweets, classifier) {
  const timeline = classifier.timeline || [];
  const baselines = classifier.analysis_meta?.topic_baselines || {};
  const useQuarter = timeline.some((w) => String(w.period || "").includes("-Q"));

  const windowTweetCounts = new Map();
  const windowTopicTweetCounts = new Map();
  for (const tw of tweets) {
    const d = new Date(tw.created_at);
    const period = periodKeyForDate(d, useQuarter);
    windowTweetCounts.set(period, (windowTweetCounts.get(period) || 0) + 1);

    if (!windowTopicTweetCounts.has(period)) {
      windowTopicTweetCounts.set(period, {});
    }
    const topicMap = windowTopicTweetCounts.get(period);
    for (const topic of classifier.topics || []) {
      if (tweetContainsTopic(tw.tweet_text, topic)) {
        topicMap[topic] = (topicMap[topic] || 0) + 1;
      }
    }
  }

  const periods = timeline.map((w) => w.period);
  const baselineUsage = {};
  for (const topic of classifier.topics || []) {
    const b = baselines[topic];
    if (!b?.period) {
      baselineUsage[topic] = {
        baseline_period: null,
        initial_tweets_used: 0,
        topic_hit_tweets_used: 0,
        cumulative_topic_hits: 0,
      };
      continue;
    }
    const endIdx = periods.findIndex((p) => p === b.period);
    const upto = endIdx >= 0 ? periods.slice(0, endIdx + 1) : [];
    const totalTweets = upto.reduce((n, p) => n + (windowTweetCounts.get(p) || 0), 0);
    const topicTweets = upto.reduce((n, p) => n + (windowTopicTweetCounts.get(p)?.[topic] || 0), 0);

    baselineUsage[topic] = {
      baseline_period: b.period,
      initial_tweets_used: totalTweets,
      topic_hit_tweets_used: topicTweets,
      cumulative_topic_hits: Number(b.cumulative_hits || 0),
    };
  }
  return baselineUsage;
}

function inferHandleFromFilename(filename) {
  const base = path.basename(filename).toLowerCase();
  const m = base.match(/twexportly_([a-z0-9_]+)_tweets/);
  return m?.[1] || "unknown_handle";
}

function scoreBand(score) {
  if (score <= -5) return "Strongly left-coded";
  if (score <= -2) return "Moderately left-coded";
  if (score >= 5) return "Strongly right-coded";
  if (score >= 2) return "Moderately right-coded";
  return "Mixed or centrist";
}

function trendFromDelta(d) {
  if (d > 0.75) return "right";
  if (d < -0.75) return "left";
  return "stable";
}

function buildIssuesGrid(timeline, topics) {
  if (!timeline?.length) return [];
  const first = timeline[0];
  const last = timeline[timeline.length - 1];
  return (topics || []).map((topic) => {
    const a = Number(first?.scores?.[topic] ?? 0);
    const b = Number(last?.scores?.[topic] ?? 0);
    const delta = b - a;
    return {
      key: topic,
      topic: TOPIC_PRETTY[topic] || topic,
      current_stance: `${scoreBand(b)} on this axis.`,
      trend: trendFromDelta(delta),
      score_current: b,
      score_previous: a,
    };
  });
}

function shiftRingLevel(shifts) {
  const mag = (shifts || []).reduce((m, s) => Math.max(m, Number(s?.magnitude || 0)), 0);
  if (mag >= 6) return "significant";
  if (mag >= 3) return "moderate";
  return "stable";
}

function sampleTweetsForShifts(handle, tweets, limit = 8) {
  if (!tweets?.length) return [];
  const out = [];
  const stride = Math.max(1, Math.floor(tweets.length / (limit + 2)));
  for (let i = 0; i < tweets.length && out.length < limit; i += stride) {
    const t = tweets[i];
    out.push({
      id: t.id,
      text: t.tweet_text,
      created_at: t.created_at,
      likes: t.likes,
      retweets: t.retweets,
      url: /^\d+$/.test(String(t.id || ""))
        ? `https://x.com/${String(handle || "").replace(/^@/, "")}/status/${t.id}`
        : null,
    });
  }
  return out;
}

function buildDashboardPayload({ handle, profile, tweets, classifier, withNews, narrator }) {
  const timeline = classifier.timeline || [];
  const shifts = withNews.shifts || [];
  const issues = buildIssuesGrid(timeline, classifier.topics);
  const currentOverall = Number(timeline[timeline.length - 1]?.overall ?? 0);
  const oldOverall = Number(timeline[0]?.overall ?? 0);
  const ring = shiftRingLevel(shifts);
  return {
    handle,
    profile,
    dateRange: {
      start: tweets[0]?.created_at || null,
      end: tweets[tweets.length - 1]?.created_at || null,
    },
    spectrum: {
      current: Number(narrator?.current_spectrum_estimate ?? currentOverall),
      three_years_ago: Number(narrator?.spectrum_three_years_ago ?? oldOverall),
      current_estimated: currentOverall,
    },
    issues,
    shifts: shifts.map((s) => ({
      ...s,
      magnitude_tier: s.magnitude >= 6 ? "high" : s.magnitude >= 3 ? "mid" : "low",
      before: s.before_summary || "",
      fissure:
        s.fissure ||
        `Shifted ${s.direction || "right"} on ${
          s.topic === "__overall__" ? "overall stance" : s.topic
        } (Δ≈${Number(s.magnitude || 0).toFixed(1)}).`,
      after: s.after_summary || "",
      news: s.news_context || null,
    })),
    timeline,
    narrative: {
      full_summary: narrator?.full_summary || "",
      most_significant_shift: narrator?.most_significant_shift || "",
      surprises: narrator?.surprises_or_inconsistencies || "",
    },
    sampleTweets: sampleTweetsForShifts(handle, tweets),
    meta: {
      confidence: Number(narrator?.overall_confidence ?? 0.5),
      disclaimer:
        narrator?.disclaimer ||
        "AI-generated interpretation of public posts. Not a statement of private beliefs. Verify sources independently.",
      shift_stability_ring: ring,
      scrape_source: "csv_import",
      corpus_tweet_count: tweets.length,
    },
  };
}

async function main() {
  const args = process.argv.slice(2);
  const csvPath = args.find((a) => !a.startsWith("--"));
  const explicitHandle = args.find((a, i) => i > 0 && !a.startsWith("--"));
  const shouldSave = !args.includes("--no-save");
  if (!csvPath) {
    throw new Error(
      "Usage: node tools/analyzeCsvParallel.js <path/to/export.csv> [handle]\n" +
        "Example: node tools/analyzeCsvParallel.js ../../TwExportly_hasanthehun_tweets_2026_04_30.csv hasanthehun",
    );
  }

  const raw = await fs.readFile(csvPath, "utf8");
  const rows = rowObjects(parseCsvText(raw));
  const handle = String(explicitHandle || inferHandleFromFilename(csvPath))
    .replace(/^@/, "")
    .toLowerCase();

  const tweets = rows
    .map((r) => ({
      id: normalizeTweetId(r.tweet_id),
      tweet_text: String(r.text || "").trim(),
      created_at: parseCreatedAt(r.created_at),
      likes: numberOr0(r.favorite_count),
      retweets: numberOr0(r.retweet_count),
      replies: numberOr0(r.reply_count),
    }))
    .filter((t) => t.id && t.tweet_text && t.created_at)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  if (!tweets.length) {
    throw new Error("No valid tweets found in CSV after parsing.");
  }

  const emit = (ev) => {
    const stage = ev?.stage || "stage";
    const msg = ev?.message || "";
    if (msg) console.log(`[${stage}] ${msg}`);
  };

  const scraperResult = {
    handle,
    profile: {
      handle,
      display_name: `@${handle}`,
      bio: "",
      profile_image_url: "",
    },
    tweets,
    dateRange: {
      start: tweets[0].created_at,
      end: tweets[tweets.length - 1].created_at,
    },
    scrapeMeta: {
      source: "csv_import",
      fetched: tweets.length,
      requested: tweets.length,
      chronological: true,
      span_days: Math.round(corpusSpanDays(tweets)),
    },
  };

  const classifier = await runClassifierAgent(scraperResult, emit);
  const shiftPack = runShiftDetectorAgent(classifier, emit);
  const withNews = await runContextAgent(shiftPack, emit);
  const narrator = await runNarratorAgent(withNews, emit);
  const twProfile = await lookupTwitterProfileByUsername(handle).catch(() => null);
  const profile = {
    id: twProfile?.id || `csv_${handle}`,
    name: twProfile?.name || `@${handle}`,
    username: twProfile?.username || handle,
    description: twProfile?.description || "Imported from TwExportly CSV.",
    profile_image_url: twProfile?.profile_image_url || fallbackAvatarUrl(handle),
  };
  const dashboard = buildDashboardPayload({
    handle,
    profile,
    tweets,
    classifier,
    withNews,
    narrator,
  });

  if (shouldSave) {
    clearTweetsForHandle(handle);
    for (const t of tweets) {
      insertTweet({
        id: t.id,
        handle,
        tweet_text: t.tweet_text,
        created_at: t.created_at,
        likes: t.likes,
        retweets: t.retweets,
        replies: t.replies,
      });
    }
    saveCorpusMeta(handle, {
      source: "csv_import",
      tweet_count: tweets.length,
      oldest_at: tweets[0]?.created_at || null,
      newest_at: tweets[tweets.length - 1]?.created_at || null,
    });
    saveAnalysis(handle, dashboard);
  }

  const baselineUsage = computeBaselineUsage(tweets, classifier);
  const output = {
    source_file: path.resolve(csvPath),
    handle,
    corpus_tweet_count: tweets.length,
    corpus_start: tweets[0].created_at,
    corpus_end: tweets[tweets.length - 1].created_at,
    windows: classifier.timeline.length,
    baseline_usage_by_topic: baselineUsage,
    shift_count: withNews.shifts?.length || 0,
    top_shifts: (withNews.shifts || []).slice(0, 8).map((s) => ({
      topic: s.topic,
      direction: s.direction,
      magnitude: s.magnitude,
      period_before: s.period_before,
      period_after: s.period_after,
      anomaly_flag: Boolean(s.anomaly_flag),
    })),
    spectrum: {
      start: classifier.timeline[0]?.overall ?? 0,
      current: classifier.timeline[classifier.timeline.length - 1]?.overall ?? 0,
    },
    narrative: narrator,
    saved_to_dashboard: shouldSave,
  };

  console.log("\n=== ANALYSIS RESULT (JSON) ===");
  console.log(JSON.stringify(output, null, 2));
  if (shouldSave) {
    console.log(`\nSaved analysis for @${handle} to app database.`);
  }
}

main().catch((err) => {
  console.error(`CSV analysis failed: ${err?.message || err}`);
  process.exit(1);
});
