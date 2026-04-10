/**
 * Agent 4 — The Journalist: NewsAPI + GDELT headlines + Claude correlation narrative.
 */
import { callClaudeJson } from "../lib/anthropic.js";
import { fetchGdeltHeadlines } from "../lib/gdelt.js";
import { withRetries } from "../lib/retry.js";

async function fetchNewsHeadlines(topic, fromDate, toDate) {
  const key = process.env.NEWSAPI_KEY;
  if (!key) return [];
  const q = encodeURIComponent(topic.replace(/_/g, " "));
  const from = fromDate.slice(0, 10);
  const to = toDate.slice(0, 10);
  const url = `https://newsapi.org/v2/everything?q=${q}&from=${from}&to=${to}&sortBy=relevancy&pageSize=8&language=en`;
  try {
    return await withRetries(async () => {
      const res = await fetch(url, { headers: { "X-Api-Key": key } });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`NewsAPI ${res.status}: ${t.slice(0, 200)}`);
      }
      const data = await res.json();
      return (data.articles || []).map((a) => ({
        title: a.title || "",
        source: a.source?.name || "",
        publishedAt: a.publishedAt || "",
        url: a.url || "",
      }));
    });
  } catch {
    return [];
  }
}

async function fetchHeadlinesMerged(topic, fromDate, toDate) {
  const [news, gdelt] = await Promise.all([
    fetchNewsHeadlines(topic, fromDate, toDate),
    fetchGdeltHeadlines(topic, fromDate, toDate).catch(() => []),
  ]);
  const merged = [...news, ...gdelt];
  const seen = new Set();
  const out = [];
  for (const h of merged) {
    const k = (h.url || h.title || "").slice(0, 220);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(h);
  }
  if (!out.length) {
    return [
      {
        title: "No headlines retrieved for this window (check NEWSAPI_KEY or GDELT availability).",
        source: "system",
        publishedAt: fromDate,
        url: "",
      },
    ];
  }
  return out.slice(0, 12);
}

function periodToApproxDates(periodRaw) {
  const token = (periodRaw || "").trim().split(/\s+/)[0];
  const m = /^(\d{4})-(H[12])$/.exec(token);
  if (!m) {
    const to = new Date();
    const from = new Date(to.getTime() - 180 * 24 * 60 * 60 * 1000);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  const year = parseInt(m[1], 10);
  const half = m[2];
  const startMonth = half === "H1" ? 0 : 6;
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, startMonth + 6, 0));
  return { from: start.toISOString(), to: end.toISOString() };
}

const SYSTEM = `You are a careful journalist assistant. Output JSON only, no markdown.
Given a public figure's detected rhetorical shift and a list of news headlines from the same era, you must:
- Propose which news themes plausibly correlate in time (NOT causal claims).
- Write a 2-3 sentence narrative using cautious language: "coincided with", "overlapped with".
Return JSON:
{"headlines_used":[{"title":"","source":"","publishedAt":"","url":""}],"narrative":"","confidence":0.0-1.0}`;

export async function runContextAgent(shiftResult, emit) {
  emit({ stage: "context", message: "Matching to news events…", progress: 0.66 });
  const { shifts, handle, timeline } = shiftResult;
  const enriched = [];

  let idx = 0;
  for (const s of shifts.slice(0, 12)) {
    const period =
      s.period_after || s.date_range?.split(/\s+/)[0] || timeline[timeline.length - 1]?.period;
    const { from, to } = periodToApproxDates(period);
    const queryTopic = s.topic === "__overall__" ? `${handle} politics` : `${handle} ${s.topic}`;
    emit({
      stage: "context",
      message: `Matching to news events… (${idx + 1}/${Math.min(shifts.length, 12)})`,
      progress: 0.66 + 0.18 * (idx / Math.max(shifts.length, 1)),
    });
    const headlines = await fetchHeadlinesMerged(queryTopic, from, to);

    const user = JSON.stringify(
      {
        handle,
        shift: s,
        headlines,
      },
      null,
      2
    );

    let ctx = { headlines_used: headlines.slice(0, 3), narrative: "", confidence: 0.4 };
    try {
      ctx = await callClaudeJson(SYSTEM, user, { maxTokens: 1500 });
    } catch {
      ctx.narrative =
        "Automated news correlation failed; headlines are shown for manual interpretation. This is not a causal claim.";
    }

    enriched.push({
      ...s,
      news_context: {
        narrative: ctx.narrative,
        confidence: ctx.confidence,
        headlines: (ctx.headlines_used || headlines).slice(0, 5),
      },
    });
    idx += 1;
  }

  emit({
    stage: "context",
    message: "Matching to news events… complete.",
    progress: 0.84,
    done: true,
  });
  return { ...shiftResult, shifts: enriched };
}
