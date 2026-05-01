/**
 * Agent 4 — The Journalist: NewsAPI + GDELT headlines + Claude correlation narrative.
 */
import { callClaudeJson } from "../lib/anthropic.js";
import { fetchGdeltHeadlines } from "../lib/gdelt.js";
import { withRetries } from "../lib/retry.js";
import { searchWeb } from "../lib/webSearch.js";

async function fetchNewsHeadlines(query, fromDate, toDate) {
  const key = process.env.NEWSAPI_KEY;
  if (!key) return [];
  const q = encodeURIComponent(String(query || "").replace(/_/g, " "));
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

async function fetchHeadlinesMerged(query, fromDate, toDate) {
  const [news, gdelt] = await Promise.all([
    fetchNewsHeadlines(query, fromDate, toDate),
    fetchGdeltHeadlines(query, fromDate, toDate).catch(() => []),
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
  return out.slice(0, 12);
}

function parseDateFromWebSnippet(snippet) {
  const txt = String(snippet || "");
  const m = /\b(\w+\s+\d{1,2},\s+\d{4})\b/.exec(txt);
  if (!m) return "";
  const d = new Date(m[1]);
  return Number.isFinite(d.getTime()) ? d.toISOString() : "";
}

async function fetchWebSearchHeadlines(query, fromDate, toDate) {
  const rows = await searchWeb(query).catch(() => []);
  const fromMs = new Date(fromDate).getTime();
  const toMs = new Date(toDate).getTime();
  const out = [];
  for (const r of rows || []) {
    const published = parseDateFromWebSnippet(r.snippet);
    if (published) {
      const ms = new Date(published).getTime();
      if (Number.isFinite(fromMs) && Number.isFinite(toMs) && (ms < fromMs || ms > toMs)) {
        continue;
      }
    }
    out.push({
      title: String(r.title || ""),
      source: (() => {
        try {
          return new URL(String(r.link || "")).hostname.replace(/^www\./, "");
        } catch {
          return "web";
        }
      })(),
      publishedAt: published || "",
      url: String(r.link || ""),
    });
  }
  return out.slice(0, 10);
}

function periodToApproxDates(periodRaw) {
  const token = (periodRaw || "").trim().split(/\s+/)[0];
  const q = /^(\d{4})-Q([1-4])$/.exec(token);
  if (q) {
    const year = parseInt(q[1], 10);
    const quarter = parseInt(q[2], 10);
    const startMonth = (quarter - 1) * 3;
    const start = new Date(Date.UTC(year, startMonth, 1));
    const end = new Date(Date.UTC(year, startMonth + 3, 0));
    return { from: start.toISOString(), to: end.toISOString() };
  }
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

function dateWindowAround(isoLike, daysRadius = 7) {
  const d = new Date(String(isoLike || ""));
  if (!Number.isFinite(d.getTime())) return null;
  const from = new Date(d.getTime() - daysRadius * 24 * 60 * 60 * 1000);
  const to = new Date(d.getTime() + daysRadius * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString(), anchor: d.toISOString().slice(0, 10) };
}

function extractDateHint(shift) {
  const candidates = [
    shift?.flagged_tweet_date,
    shift?.tweet_date,
    shift?.period_after,
    shift?.date_range,
    shift?.after_summary,
    shift?.before_summary,
  ]
    .map((x) => String(x || ""))
    .join(" ");
  const m = /(\d{4}-\d{2}-\d{2})/.exec(candidates);
  return m?.[1] || null;
}

function extractEntityHints(text) {
  const src = String(text || "");
  const out = new Set();
  for (const m of src.matchAll(/@([A-Za-z0-9_]{2,32})/g)) {
    out.add(m[1].toLowerCase());
  }
  for (const m of src.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g)) {
    const v = String(m[1] || "").trim();
    if (v.length >= 4 && !["Quote", "Baseline", "Current", "Topic"].includes(v)) out.add(v);
  }
  return [...out].slice(0, 6);
}

async function gatherHeadlinesWithFallbacks(queries, fromDate, toDate, minHeadlines = 4) {
  const seen = new Set();
  const merged = [];
  let queryUsed = "";
  const diagnostics = [];
  for (const q of queries) {
    if (!q) continue;
    const key = String(q).trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const hPrimary = await fetchHeadlinesMerged(q, fromDate, toDate);
    const h = hPrimary.length ? hPrimary : await fetchWebSearchHeadlines(q, fromDate, toDate);
    diagnostics.push({ query: q, hits: h.length, used_web_fallback: !hPrimary.length && !!h.length });
    if (!queryUsed && h.length) queryUsed = q;
    for (const row of h) merged.push(row);
    if (merged.length >= minHeadlines) break;
  }
  return { headlines: merged.slice(0, 12), queryUsed, diagnostics };
}

const SYSTEM = `You are a careful journalist assistant. Output JSON only, no markdown.
Given a public figure's detected rhetorical shift and a list of news headlines from the same era, you must:
- Propose which news themes plausibly correlate in time (NOT causal claims).
- Write a 2-3 sentence narrative using cautious language: "coincided with", "overlapped with".
Return JSON:
{"headlines_used":[{"title":"","source":"","publishedAt":"","url":""}],"narrative":"","confidence":0.0-1.0}`;

export async function runContextAgent(shiftResult, emit) {
  emit({ stage: "context", message: "Matching to news events…", progress: 0.66 });
  const { shifts, handle, timeline, profile } = shiftResult;
  const enriched = [];
  const personName = String(profile?.name || profile?.display_name || handle || "").replace(/^@/, "");

  let idx = 0;
  for (const s of shifts.slice(0, 12)) {
    const period = s.period_after || s.date_range?.split(/\s+/)[0] || timeline[timeline.length - 1]?.period;
    const periodWindow = periodToApproxDates(period);
    const dateHint = extractDateHint(s);
    const dateWindow = dateHint ? dateWindowAround(dateHint, 10) : null;
    const from = dateWindow?.from || periodWindow.from;
    const to = dateWindow?.to || periodWindow.to;
    const anchorDate = dateWindow?.anchor || from.slice(0, 10);
    const anchorYear = String(anchorDate).slice(0, 4);
    const topicTerm = s.topic === "__overall__" ? "politics" : String(s.topic || "").replace(/_/g, " ");
    const entityHints = extractEntityHints(`${s.before_summary || ""}\n${s.after_summary || ""}`);
    const queries = [
      `${personName} ${topicTerm} ${anchorDate}`,
      `${personName} ${anchorDate}`,
      ...entityHints.map((e) => `${e} ${topicTerm} ${anchorDate}`),
      ...entityHints.map((e) => `${e} ${topicTerm}`),
      `${handle} ${topicTerm}`,
      `${personName} ${topicTerm} ${anchorYear}`,
      `${topicTerm} ${anchorYear}`,
      `${topicTerm} ${anchorDate}`,
      `${topicTerm}`,
    ];
    emit({
      stage: "context",
      message: `Matching to news events… (${idx + 1}/${Math.min(shifts.length, 12)})`,
      progress: 0.66 + 0.18 * (idx / Math.max(shifts.length, 1)),
    });
    const { headlines, queryUsed, diagnostics } = await gatherHeadlinesWithFallbacks(queries, from, to, 4);

    const user = JSON.stringify(
      {
        handle,
        person_name: personName,
        query_used: queryUsed,
        date_anchor: anchorDate,
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
    const selectedHeadlines =
      Array.isArray(ctx.headlines_used) && ctx.headlines_used.length
        ? ctx.headlines_used
        : headlines;
    const providerNote =
      !selectedHeadlines.length
        ? `No relevant headlines found for ${anchorDate}. Tried ${diagnostics.length} query variants.`
        : "";
    const narrativeOut = ctx.narrative || providerNote;

    enriched.push({
      ...s,
      news_context: {
        narrative: narrativeOut,
        confidence: ctx.confidence,
        headlines: selectedHeadlines.slice(0, 5),
        query_used: queryUsed || queries[0],
        date_anchor: anchorDate,
        diagnostics,
        providers: {
          newsapi_enabled: Boolean(process.env.NEWSAPI_KEY),
          websearch_enabled: Boolean(process.env.SERPER_API_KEY || process.env.BRAVE_API_KEY),
        },
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
