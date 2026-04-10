import { runScraperAgent } from "./agents/scraperAgent.js";
import { runClassifierAgent } from "./agents/classifierAgent.js";
import { runShiftDetectorAgent } from "./agents/shiftDetectorAgent.js";
import { runContextAgent } from "./agents/contextAgent.js";
import { runNarratorAgent } from "./agents/narratorAgent.js";
import {
  runMockClassifierAgent,
  runMockContextAgent,
  runMockNarratorAgent,
} from "./lib/mockAiPipeline.js";
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

function sentenceForScore(s) {
  if (s <= -5) return "Recent posts lean strongly progressive / left-coded on this axis.";
  if (s <= -2) return "Recent posts lean modestly left on this axis.";
  if (s >= 5) return "Recent posts lean strongly conservative / right-coded on this axis.";
  if (s >= 2) return "Recent posts lean modestly right on this axis.";
  return "Mixed or centrist signals in the latest window.";
}

function trendArrow(firstScore, lastScore) {
  const d = lastScore - firstScore;
  if (d > 1.5) return "right";
  if (d < -1.5) return "left";
  return "stable";
}

function buildIssuesGrid(timeline, topics) {
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
        current_stance: sentenceForScore(b),
        trend: trendArrow(a, b),
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
  }));
}

function buildDashboardPayload({
  scraper,
  classifier,
  shiftPack,
  narrator,
}) {
  const { profile, dateRange, handle } = scraper;
  const { timeline, topics } = classifier;
  const { shifts } = shiftPack;

  const issues = buildIssuesGrid(timeline, topics);
  const ring = shiftRingLevel(shifts);

  const currentOverall = timeline.at(-1)?.overall ?? 0;
  const pastOverall = timeline[0]?.overall ?? 0;

  const pic = profile?.profile_image_url
    ? upgradeTwitterImageUrl(profile.profile_image_url)
    : fallbackAvatarUrl(handle);
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
      demo_mode: Boolean(narrator?.demo_mode),
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
  });
  const hasLlmKey = Boolean(process.env.LAVA_API_KEY || process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY);
  const useRealClaude = hasLlmKey && process.env.USE_MOCK_AI !== "true";

  let classifier;
  let shiftPack;
  let withNews;
  let narrator;

  if (useRealClaude) {
    classifier = await runClassifierAgent(scraper, emit);
    shiftPack = runShiftDetectorAgent(classifier, emit);
    withNews = await runContextAgent(shiftPack, emit);
    narrator = await runNarratorAgent(withNews, emit);
  } else {
    if (!hasLlmKey) {
      emit({
        stage: "classifier",
        message:
          "No LLM key set — running demo stance + news + summary (set LAVA_API_KEY for real analysis).",
        progress: 0.26,
      });
    }
    classifier = await runMockClassifierAgent(scraper, emit);
    shiftPack = runShiftDetectorAgent(classifier, emit);
    withNews = await runMockContextAgent(shiftPack, emit);
    narrator = await runMockNarratorAgent(withNews, emit);
    narrator = { ...narrator, demo_mode: true };
  }

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
