/**
 * Deterministic "demo" stance timeline + narrative when ANTHROPIC_API_KEY is missing.
 */
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
      "Demo mode: illustrative stance scores (set ANTHROPIC_API_KEY in server/.env for real Claude analysis).",
    progress: 0.3,
  });
  const { handle, tweets } = scraperResult;
  const windows = groupByWindow(tweets);
  const seed = hashSeed(handle);
  const timeline = [];

  let i = 0;
  for (const [period] of windows) {
    const drift = (i / Math.max(windows.length - 1, 1)) * 4 - 2;
    const scores = {};
    for (const t of TOPICS) {
      const jitter = ((seed + i + t.length) % 7) - 3;
      scores[t] = Math.max(-9, Math.min(9, drift + jitter * 0.6));
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
  emit({ stage: "context", message: "Matching to news events… (demo — enable NEWSAPI_KEY / Claude for full context)", progress: 0.7 });
  const shifts = shiftResult.shifts.map((s) => ({
    ...s,
    news_context: {
      narrative:
        "Demo mode: no live news correlation was run. In production, headlines from NewsAPI and GDELT are merged and summarized by Claude with explicit uncertainty.",
      confidence: 0.35,
      headlines: [
        {
          title: "Configure NEWSAPI_KEY and ANTHROPIC_API_KEY for real headlines + narratives.",
          source: "Political Shift Tracker",
          publishedAt: new Date().toISOString().slice(0, 10),
          url: "",
        },
      ],
    },
  }));
  emit({ stage: "context", message: "Matching to news events… complete (demo).", progress: 0.84, done: true });
  return { ...shiftResult, shifts };
}

export async function runMockNarratorAgent(contextResult, emit) {
  emit({ stage: "narrator", message: "Writing final analysis… (demo)", progress: 0.88 });
  const h = contextResult.handle;
  const out = {
    full_summary: `This dashboard is running in demo mode because ANTHROPIC_API_KEY is not set on the server. The timeline, scores, and shifts below are produced with deterministic math for UI testing — they are not Claude judgments of @${h}'s beliefs.\n\nAdd your Anthropic key to server/.env, restart the API, and run Analyze again for a real multi-agent pass over the scraped tweet corpus. Always treat outputs as AI interpretation of public statements, not private conviction.`,
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
