/**
 * Deterministic "demo" stance timeline + narrative when ANTHROPIC_API_KEY is missing.
 */
import { callClaudeJson } from "./anthropic.js";
import { fetchGdeltHeadlines } from "./gdelt.js";

const TOPICS = [
  "immigration",
  "economy",
  "climate",
  "healthcare",
  "foreign_policy",
  "social_issues",
  "media_free_speech",
];

const WEIGHTS = {
  immigration: 0.14,
  economy: 0.18,
  climate: 0.12,
  healthcare: 0.14,
  foreign_policy: 0.16,
  social_issues: 0.14,
  media_free_speech: 0.12,
};

/**
 * Handle-specific demo priors to keep mock mode broadly plausible.
 * Scores are on the app's -10..+10 axis.
 */
const HANDLE_PROFILES = {
  elonmusk: {
    start: {
      immigration: 1.8,
      economy: 4.8,
      climate: -0.8,
      healthcare: 0.4,
      foreign_policy: 1.8,
      social_issues: 0.6,
      media_free_speech: 4.2,
    },
    end: {
      immigration: 6.2,
      economy: 5.8,
      climate: 1.0,
      healthcare: 0.8,
      foreign_policy: 4.0,
      social_issues: 3.2,
      media_free_speech: 6.6,
    },
  },
  tuckercarlson: {
    start: {
      immigration: 7.0,
      economy: 5.8,
      climate: 2.5,
      healthcare: 3.2,
      foreign_policy: 4.8,
      social_issues: 6.6,
      media_free_speech: 6.8,
    },
    end: {
      immigration: 7.6,
      economy: 5.6,
      climate: 2.8,
      healthcare: 3.0,
      foreign_policy: 5.6,
      social_issues: 6.8,
      media_free_speech: 7.2,
    },
  },
  tulsigabbard: {
    start: {
      immigration: -1.8,
      economy: -2.4,
      climate: -2.0,
      healthcare: -2.2,
      foreign_policy: -0.8,
      social_issues: -1.6,
      media_free_speech: 0.4,
    },
    end: {
      immigration: 4.2,
      economy: 2.8,
      climate: 0.2,
      healthcare: 0.6,
      foreign_policy: 2.6,
      social_issues: 2.4,
      media_free_speech: 4.0,
    },
  },
  billmaher: {
    start: {
      immigration: -0.6,
      economy: 0.4,
      climate: -2.4,
      healthcare: -1.6,
      foreign_policy: -0.4,
      social_issues: -1.2,
      media_free_speech: 2.4,
    },
    end: {
      immigration: 1.6,
      economy: 1.8,
      climate: -1.2,
      healthcare: -0.8,
      foreign_policy: 0.8,
      social_issues: -0.2,
      media_free_speech: 3.6,
    },
  },
  hasanabi: {
    start: {
      immigration: -6.6,
      economy: -5.4,
      climate: -6.0,
      healthcare: -6.4,
      foreign_policy: -5.8,
      social_issues: -6.8,
      media_free_speech: -2.6,
    },
    end: {
      immigration: -6.0,
      economy: -4.8,
      climate: -5.6,
      healthcare: -5.8,
      foreign_policy: -5.2,
      social_issues: -6.2,
      media_free_speech: -1.8,
    },
  },
  realdonaldtrump: {
    start: {
      immigration: 7.8,
      economy: 6.0,
      climate: 2.4,
      healthcare: 3.0,
      foreign_policy: 5.6,
      social_issues: 6.8,
      media_free_speech: 5.8,
    },
    end: {
      immigration: 8.4,
      economy: 6.4,
      climate: 3.0,
      healthcare: 3.4,
      foreign_policy: 6.8,
      social_issues: 7.4,
      media_free_speech: 6.2,
    },
  },
};

const HANDLE_WIKI = {
  elonmusk: "Elon_Musk",
  tuckercarlson: "Tucker_Carlson",
  tulsigabbard: "Tulsi_Gabbard",
  billmaher: "Bill_Maher",
  hasanabi: "Hasan_Piker",
  realdonaldtrump: "Donald_Trump",
};

const groundedCache = new Map();

async function fetchWikiSummary(handle) {
  const page = HANDLE_WIKI[handle];
  if (!page) return "";
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page)}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "mind-shift-lens/1.0" },
    });
    if (!res.ok) return "";
    const data = await res.json();
    return String(data.extract || "").slice(0, 2800);
  } catch {
    return "";
  }
}

async function getGroundedProfile(handle, fallbackProfile) {
  const h = normHandle(handle);
  if (groundedCache.has(h)) return groundedCache.get(h);
  if (!process.env.LAVA_API_KEY) return fallbackProfile;

  const wiki = await fetchWikiSummary(h);
  if (!wiki) return fallbackProfile;

  const system = `You are calibrating an approximate ideological mock profile for UI demos.
Return JSON only.
Use scale -10 (left/progressive) to +10 (right/conservative).
Be conservative and avoid exaggeration.
Output schema:
{
  "start":{"immigration":0,"economy":0,"climate":0,"healthcare":0,"foreign_policy":0,"social_issues":0,"media_free_speech":0},
  "end":{"immigration":0,"economy":0,"climate":0,"healthcare":0,"foreign_policy":0,"social_issues":0,"media_free_speech":0}
}`;
  const user = JSON.stringify({ handle: h, evidence: wiki }, null, 2);
  try {
    const resp = await callClaudeJson(system, user, { maxTokens: 1200 });
    const out = {
      start: { ...fallbackProfile.start, ...(resp?.start || {}) },
      end: { ...fallbackProfile.end, ...(resp?.end || {}) },
    };
    groundedCache.set(h, out);
    return out;
  } catch {
    return fallbackProfile;
  }
}

function halfYearKey(d) {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const half = m < 6 ? "H1" : "H2";
  return `${y}-${half}`;
}

function groupByWindow(tweets) {
  const map = new Map();
  for (const tw of tweets) {
    const d = new Date(tw.created_at);
    const key = halfYearKey(d);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(tw);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function hashSeed(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function normHandle(h) {
  return String(h || "").replace(/^@/, "").toLowerCase();
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function overallWeighted(scores) {
  let num = 0;
  let den = 0;
  for (const t of TOPICS) {
    const w = WEIGHTS[t] ?? 0.14;
    num += w * (scores[t] ?? 0);
    den += w;
  }
  return den ? num / den : 0;
}

export async function runMockClassifierAgent(scraperResult, emit) {
  emit({
    stage: "classifier",
    message:
      "Demo mode: grounded mock stance scores (public context + deterministic smoothing).",
    progress: 0.3,
  });
  const { handle, tweets } = scraperResult;
  const windows = groupByWindow(tweets);
  const nh = normHandle(handle);
  const seed = hashSeed(nh);
  const profile = await getGroundedProfile(nh, HANDLE_PROFILES[nh] || HANDLE_PROFILES.billmaher);
  const timeline = [];

  let i = 0;
  for (const [period] of windows) {
    const phase = i / Math.max(windows.length - 1, 1);
    const scores = {};
    for (const topic of TOPICS) {
      const jitter = (((seed + i + topic.length) % 9) - 4) * 0.15;
      const a = profile.start[topic] ?? 0;
      const b = profile.end[topic] ?? 0;
      scores[topic] = Math.max(-9, Math.min(9, lerp(a, b, phase) + jitter));
    }
    timeline.push({
      period,
      scores,
      overall: overallWeighted(scores),
      summary: `Demo window ${period}: synthetic scores from public post volume only — not from live Claude.`,
    });
    i += 1;
  }

  if (!timeline.length) {
    timeline.push({
      period: "2024-H2",
      scores: Object.fromEntries(TOPICS.map((t) => [t, 0])),
      overall: 0,
      summary: "No tweet windows; placeholder demo row.",
    });
  }

  emit({
    stage: "classifier",
    message: "Classifying stances… done (demo).",
    progress: 0.52,
    done: true,
  });
  return { handle, timeline, topics: TOPICS };
}

export async function runMockContextAgent(shiftResult, emit) {
  emit({ stage: "context", message: "Matching to news events… (grounded mock)", progress: 0.7 });
  const topic =
    shiftResult.shifts?.[0]?.topic && shiftResult.shifts[0].topic !== "__overall__"
      ? shiftResult.shifts[0].topic
      : `${shiftResult.handle} politics`;
  const to = new Date().toISOString();
  const from = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();
  let demoHeadlines = [];
  try {
    demoHeadlines = await fetchGdeltHeadlines(topic, from, to);
  } catch {
    demoHeadlines = [];
  }
  const topHeads = demoHeadlines.slice(0, 3);
  const shifts = shiftResult.shifts.map((s) => ({
    ...s,
    news_context: {
      narrative:
        topHeads.length
          ? "Grounded mock mode: recent public headlines were pulled for context; correlations remain tentative and non-causal."
          : "Grounded mock mode: no live headlines returned; add NEWSAPI_KEY for richer context.",
      confidence: topHeads.length ? 0.45 : 0.35,
      headlines: topHeads.length
        ? topHeads
        : [
            {
              title: "No live headlines returned in grounded mock mode.",
              source: "system",
              publishedAt: new Date().toISOString().slice(0, 10),
              url: "",
            },
          ],
    },
  }));
  emit({ stage: "context", message: "Matching to news events… complete (grounded mock).", progress: 0.84, done: true });
  return { ...shiftResult, shifts };
}

export async function runMockNarratorAgent(contextResult, emit) {
  emit({ stage: "narrator", message: "Writing final analysis… (demo)", progress: 0.88 });
  const h = normHandle(contextResult.handle);
  const modelHint = process.env.LAVA_API_KEY
    ? "LAVA_API_KEY"
    : process.env.GEMINI_API_KEY
      ? "GEMINI_API_KEY"
      : "LLM key";
  const out = {
    full_summary: `This dashboard is running in demo mode because ${modelHint} is not set on the server. The timeline, scores, and shifts below are deterministic estimates for UI testing — they are not model judgments of @${h}'s beliefs.\n\nAdd your LLM key to server/.env, restart the API, and run Analyze again for a real multi-agent pass over the scraped corpus. Always treat outputs as AI interpretation of public statements, not private conviction.`,
    most_significant_shift:
      contextResult.shifts[0]?.topic === "__overall__"
        ? "Largest demo swing on overall weighted score between half-year windows."
        : `Demo highlight: ${contextResult.shifts[0]?.topic || "see timeline"}.`,
    current_spectrum_estimate: contextResult.timeline.at(-1)?.overall ?? 0,
    spectrum_three_years_ago: contextResult.timeline[0]?.overall ?? 0,
    surprises_or_inconsistencies:
      "Demo data intentionally smooth; real Claude runs usually surface messier, topic-specific contradictions.",
    overall_confidence: 0.25,
    disclaimer:
      "DEMO / MOCK AI LAYER: illustrative only until ANTHROPIC_API_KEY is configured. This is not factual profiling.",
  };
  emit({ stage: "narrator", message: "Writing final analysis… complete (demo).", progress: 0.96, done: true });
  return out;
}
