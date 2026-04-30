import { runScraperAgent } from "./agents/scraperAgent.js";
import { runClassifierAgent } from "./agents/classifierAgent.js";
import { runShiftDetectorAgent } from "./agents/shiftDetectorAgent.js";
import { runContextAgent } from "./agents/contextAgent.js";
import { runNarratorAgent } from "./agents/narratorAgent.js";
import { getTweetsForHandle, saveAnalysis } from "./db/database.js";
import { upgradeTwitterImageUrl, fallbackAvatarUrl } from "./lib/avatars.js";

const PRETTY = {
  immigration: "Immigration",
  economy: "Economy",
  climate: "Climate",
  healthcare: "Healthcare",
  foreign_policy: "Foreign Policy",
  social_issues: "Social Issues",
  media_free_speech: "Media / Free Speech",
};

const TOPIC_KEYWORDS = {
  immigration: ["border", "immigration", "migrant", "deport", "asylum", "visa"],
  economy: ["jobs", "tax", "inflation", "economy", "tariff", "market", "prices"],
  climate: ["climate", "energy", "emissions", "oil", "gas", "renewable"],
  healthcare: ["health", "medicare", "medicaid", "drug", "hospital", "insurance", "vaccine"],
  foreign_policy: ["china", "russia", "ukraine", "nato", "iran", "israel", "trade war"],
  social_issues: ["abortion", "rights", "crime", "education", "trans", "family", "values"],
  media_free_speech: ["media", "press", "censorship", "speech", "platform", "journalist", "fake news"],
};

function preferredProfileImage(handle, rawUrl) {
  const h = String(handle || "").replace(/^@/, "").toLowerCase();
  if (h === "hasanabi" || h === "hasanthehun") {
    // Force Hasan's avatar source to the canonical X profile handle requested by user.
    return "https://unavatar.io/x/hasanthehun?fallback=https%3A%2F%2Fui-avatars.com%2Fapi%2F%3Fname%3DHA%26size%3D256%26background%3D1a222c%26color%3D6ee7d8%26bold%3Dtrue";
  }
  if (rawUrl) return upgradeTwitterImageUrl(rawUrl) || rawUrl;
  return fallbackAvatarUrl(h);
}

const TOPIC_FRAMING = {
  immigration: {
    left: "language tends to emphasize migrant protections and humanitarian framing",
    right: "language tends to emphasize border enforcement and restriction-first framing",
    center: "posts mix security and humanitarian framing without a single consistent line",
  },
  economy: {
    left: "posts favor redistribution, labor protections, and stronger public intervention",
    right: "posts favor market-first growth, deregulation, and private-sector led outcomes",
    center: "economic rhetoric mixes populist and market language across periods",
  },
  climate: {
    left: "rhetoric is more aligned with urgency on emissions reduction and climate policy",
    right: "rhetoric is more skeptical of aggressive climate mandates and prioritizes cost/energy reliability",
    center: "climate messaging is mixed and not a dominant organizing theme",
  },
  healthcare: {
    left: "posts lean toward public guarantees and expanded coverage expectations",
    right: "posts lean toward private-choice, cost-control, and anti-bureaucratic framing",
    center: "healthcare references are episodic with no strong directional anchor",
  },
  foreign_policy: {
    left: "tone is relatively restraint-oriented with multilateral emphasis",
    right: "tone is more hawkish/national-interest oriented with strength-first framing",
    center: "foreign policy references are mixed between restraint and hard-power language",
  },
  social_issues: {
    left: "posts generally align with progressive social/civil-rights framing",
    right: "posts generally align with conservative/traditional social framing",
    center: "social-issue language is mixed, situational, or weakly signaled",
  },
  media_free_speech: {
    left: "speech/media critiques mostly target concentration, access, and platform power",
    right: "speech/media critiques mostly center censorship, bias, and viewpoint suppression",
    center: "media/free-speech commentary is mixed and often reactive to events",
  },
};

function trendDeltaThreshold(handle) {
  const h = String(handle || "").replace(/^@/, "").toLowerCase();
  if (h === "realdonaldtrump" || h === "donaldtrump") return 0.15;
  return 0.75;
}

function sentenceForScore(topic, score, firstScore, handle) {
  const d = score - (firstScore ?? score);
  const t = trendDeltaThreshold(handle);
  const drift =
    d > t ? " It has moved right versus the earlier window." :
    d < -t ? " It has moved left versus the earlier window." :
    " It has stayed relatively stable versus the earlier window.";
  const framing = TOPIC_FRAMING[topic] || {
    left: "signals skew progressive/left",
    right: "signals skew conservative/right",
    center: "signals are mixed/centrist",
  };
  if (score <= -5) return `Strongly left-coded on this axis: ${framing.left}.${drift}`;
  if (score <= -2) return `Moderately left-coded on this axis: ${framing.left}.${drift}`;
  if (score >= 5) return `Strongly right-coded on this axis: ${framing.right}.${drift}`;
  if (score >= 2) return `Moderately right-coded on this axis: ${framing.right}.${drift}`;
  return `Mixed or centrist on this axis: ${framing.center}.${drift}`;
}

function trendArrow(firstScore, lastScore, handle) {
  const d = lastScore - firstScore;
  const t = trendDeltaThreshold(handle);
  if (d > t) return "right";
  if (d < -t) return "left";
  return "stable";
}

function buildIssuesGrid(timeline, topics, handle) {
  if (!timeline.length) return [];
  const first = timeline[0];
  const last = timeline[timeline.length - 1];
  return topics
    .filter((t) => t !== "__overall__")
    .map((topic) => {
      const a = first.scores[topic] ?? 0;
      const b = last.scores[topic] ?? 0;
      return {
        key: topic,
        topic: PRETTY[topic] || topic,
        current_stance: sentenceForScore(topic, b, a, handle),
        trend: trendArrow(a, b, handle),
        score_current: b,
        score_previous: a,
      };
    });
}

function shiftRingLevel(shifts) {
  const mag = shifts.reduce((m, s) => Math.max(m, s.magnitude || 0), 0);
  if (mag >= 6) return "significant";
  if (mag >= 3) return "moderate";
  return "stable";
}

function sampleTweetsForShifts(handle, shifts, limit = 8) {
  const all = getTweetsForHandle(handle);
  if (!all.length) return [];
  const picks = new Set();
  const out = [];
  const stride = Math.max(1, Math.floor(all.length / (limit + 2)));
  for (let i = 0; i < all.length && out.length < limit; i += stride) {
    out.push(all[i]);
  }
  return out.map((t) => ({
    id: t.id,
    text: t.tweet_text,
    created_at: t.created_at,
    likes: t.likes,
    retweets: t.retweets,
    url: /^\d+$/.test(String(t.id || ""))
      ? `https://x.com/${String(handle || "").replace(/^@/, "")}/status/${t.id}`
      : null,
  }));
}

function periodBounds(period) {
  const m = /^(\d{4})-(H[12])$/.exec(String(period || "").trim());
  if (!m) return null;
  const y = Number(m[1]);
  const h = m[2];
  const startMonth = h === "H1" ? 0 : 6;
  const start = new Date(Date.UTC(y, startMonth, 1));
  const end = new Date(Date.UTC(y, startMonth + 6, 0, 23, 59, 59));
  return { start, end };
}

function pickQuoteForTopic(tweets, topic, period) {
  const bounds = periodBounds(period);
  const list = bounds
    ? tweets.filter((t) => {
        const d = new Date(t.created_at);
        return d >= bounds.start && d <= bounds.end;
      })
    : tweets;
  if (!list.length) return null;
  const kw = TOPIC_KEYWORDS[topic] || [];
  const scored = list
    .map((t) => {
      const text = String(t.tweet_text || "").toLowerCase();
      const hits = kw.reduce((n, k) => n + (text.includes(k) ? 1 : 0), 0);
      const engagement = (t.likes || 0) + 2 * (t.retweets || 0);
      return { t, hits, engagement };
    })
    .sort((a, b) => b.hits - a.hits || b.engagement - a.engagement);
  const picked = scored[0]?.t || list[0];
  const snippet = String(picked.tweet_text || "").replace(/\s+/g, " ").trim().slice(0, 280);
  return {
    text: snippet,
    created_at: picked.created_at,
  };
}

function enrichShiftsWithQuotes(handle, shifts) {
  const tweets = getTweetsForHandle(handle);
  return shifts.map((s) => {
    const topic = s.topic === "__overall__" ? "economy" : s.topic;
    const bq = pickQuoteForTopic(tweets, topic, s.period_before);
    const aq = pickQuoteForTopic(tweets, topic, s.period_after);
    const before = bq ? `${s.before_summary}\nQuote: "${bq.text}" (${String(bq.created_at).slice(0, 10)})` : s.before_summary;
    const after = aq ? `${s.after_summary}\nQuote: "${aq.text}" (${String(aq.created_at).slice(0, 10)})` : s.after_summary;
    return { ...s, before_summary: before, after_summary: after };
  });
}

function buildDashboardPayload({
  scraper,
  classifier,
  shiftPack,
  narrator,
}) {
  const { profile, dateRange, handle } = scraper;
  const { timeline, topics } = classifier;
  const shifts = enrichShiftsWithQuotes(handle, shiftPack.shifts || []);

  const issues = buildIssuesGrid(timeline, topics, handle);
  const ring = shiftRingLevel(shifts);

  const currentOverall = timeline.at(-1)?.overall ?? 0;
  const pastOverall = timeline[0]?.overall ?? 0;

  const pic = preferredProfileImage(handle, profile?.profile_image_url);
  const profileOut = { ...profile, profile_image_url: pic || fallbackAvatarUrl(handle) };

  return {
    handle,
    profile: profileOut,
    dateRange,
    spectrum: {
      current: narrator.current_spectrum_estimate ?? currentOverall,
      three_years_ago: narrator.spectrum_three_years_ago ?? pastOverall,
      current_estimated: currentOverall,
    },
    issues,
    shifts: shifts.map((s) => ({
      ...s,
      magnitude_tier:
        s.magnitude >= 6 ? "high" : s.magnitude >= 3 ? "mid" : "low",
      before: s.before_summary,
      fissure: `Shifted ${s.direction} on ${s.topic === "__overall__" ? "overall stance" : s.topic} (Δ≈${s.magnitude.toFixed(1)}).`,
      after: s.after_summary,
      news: s.news_context,
    })),
    timeline,
    narrative: {
      full_summary: narrator.full_summary,
      most_significant_shift: narrator.most_significant_shift,
      surprises: narrator.surprises_or_inconsistencies,
    },
    sampleTweets: sampleTweetsForShifts(handle, shifts),
    meta: {
      confidence: narrator.overall_confidence ?? 0.55,
      disclaimer:
        narrator.disclaimer ||
        "AI-generated interpretation of public posts. Not a statement of private beliefs. Verify sources independently.",
      shift_stability_ring: ring,
      scrape_source: scraper.scrapeMeta?.source || "unknown",
      corpus_tweet_count: Array.isArray(scraper.tweets) ? scraper.tweets.length : 0,
    },
  };
}

/**
 * @param {string} rawHandle
 * @param {(ev: object) => void} emit
 */
export async function runPipeline(rawHandle, emit, opts = {}) {
  const handle = rawHandle.replace(/^@/, "").toLowerCase();
  emit({ stage: "start", message: "Starting multi-agent analysis…", progress: 0.01 });

  const scraper = await runScraperAgent(handle, emit, {
    forceRescrape: Boolean(opts.forceRescrape),
    maxPosts: opts.maxPosts,
    allowXCapture: Boolean(opts.allowXCapture),
    preferredPlatform: opts.preferredPlatform,
  });
  const hasLlmKey = Boolean(process.env.LAVA_API_KEY || process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY);
  if (!hasLlmKey) {
    throw new Error(
      "No LLM key configured. Set one of LAVA_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY in server/.env.",
    );
  }

  const classifier = await runClassifierAgent(scraper, emit);
  const shiftPack = runShiftDetectorAgent(classifier, emit);
  const withNews = await runContextAgent(shiftPack, emit);
  const narrator = await runNarratorAgent(withNews, emit);

  const dashboard = buildDashboardPayload({
    scraper,
    classifier,
    shiftPack: withNews,
    narrator,
  });

  saveAnalysis(handle, dashboard);
  emit({
    stage: "complete",
    message: "Analysis saved — opening dashboard…",
    progress: 1,
    dashboard,
  });
  return dashboard;
}
