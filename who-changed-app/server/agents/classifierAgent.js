/**
 * Agent 2 — The Analyst: 6-month windows, batched Claude classification.
 */
import { callClaudeJson } from "../lib/anthropic.js";

const TOPICS = [
  "immigration",
  "economy",
  "climate",
  "healthcare",
  "foreign_policy",
  "social_issues",
  "media_free_speech",
];

/** Weighted emphasis for overall score (sums to 1). */
const TOPIC_WEIGHTS = {
  immigration: 0.14,
  economy: 0.18,
  climate: 0.12,
  healthcare: 0.14,
  foreign_policy: 0.16,
  social_issues: 0.14,
  media_free_speech: 0.12,
};

const SYSTEM = `You are a political text analyst. You ONLY output valid JSON, no markdown, no preamble.
Score each topic from -10 (far left) to +10 (far right) based on the figure's expressed views in the tweets provided.
Use US political spectrum conventions as a rough anchor but describe stance relative to those tweets only.
Return JSON shape:
{"scores":{${TOPICS.map((t) => `"${t}": number`).join(",")}},"summary":"one or two sentences"}`;

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

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function classifyBatch(handle, period, batchTweets) {
  const lines = batchTweets.map(
    (t, i) => `${i + 1}. [${t.created_at}] ${t.tweet_text.replace(/\s+/g, " ").slice(0, 500)}`
  );
  const user = `Public figure @${handle}, time window ${period}. Tweets:\n${lines.join("\n")}\n\nReturn JSON only.`;
  return callClaudeJson(SYSTEM, user, { maxTokens: 2048 });
}

function averageScores(parts) {
  const acc = Object.fromEntries(TOPICS.map((t) => [t, []]));
  for (const p of parts) {
    const sc = p.scores || {};
    for (const t of TOPICS) {
      const v = sc[t];
      if (typeof v === "number" && Number.isFinite(v)) acc[t].push(v);
    }
  }
  const scores = {};
  for (const t of TOPICS) {
    const arr = acc[t];
    scores[t] = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  }
  const summaries = parts.map((p) => p.summary).filter(Boolean);
  return {
    scores,
    summary: summaries.join(" ").slice(0, 800),
  };
}

function overallScoreWeighted(scores) {
  let num = 0;
  let den = 0;
  for (const t of TOPICS) {
    const w = TOPIC_WEIGHTS[t] ?? 1 / TOPICS.length;
    const v = scores[t] ?? 0;
    num += w * v;
    den += w;
  }
  return den ? num / den : 0;
}

export async function runClassifierAgent(scraperResult, emit) {
  emit({ stage: "classifier", message: "Classifying stances…", progress: 0.28 });
  const { handle, tweets } = scraperResult;
  const windows = groupByWindow(tweets);
  const timeline = [];

  for (const [period, tws] of windows) {
    const batches = chunk(tws, 50);
    const parts = [];
    let b = 0;
    for (const batch of batches) {
      emit({
        stage: "classifier",
        message: `Window ${period}: batch ${b + 1}/${batches.length}…`,
        progress: 0.28 + 0.25 * (timeline.length / Math.max(windows.length, 1)),
      });
      const json = await classifyBatch(handle, period, batch);
      parts.push(json);
      b += 1;
    }
    const merged = averageScores(parts);
    timeline.push({
      period,
      scores: merged.scores,
      overall: overallScoreWeighted(merged.scores),
      summary: merged.summary,
    });
  }

  emit({
    stage: "classifier",
    message: `Classifying stances… done (${timeline.length} half-year windows).`,
    progress: 0.52,
    done: true,
  });
  return { handle, timeline, topics: TOPICS };
}
