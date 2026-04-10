/**
 * Fetch and parse tweet-like rows from CSV/JSON URLs discovered via search.
 */
import { buildArchiveQueries } from "./webSearch.js";

const MIN_ROWS = 35;

function parseIsoish(s) {
  if (!s) return null;
  const t = String(s).trim();
  if (!t) return null;
  const d = new Date(t);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  return null;
}

function rowToTweet(row, idx) {
  const text =
    row.full_text ||
    row.text ||
    row.tweet ||
    row.content ||
    row.body ||
    row.Tweet ||
    row["Tweet Text"] ||
    "";
  const created =
    parseIsoish(row.created_at || row.date || row.timestamp || row.time || row["Created At"] || row.posted_at) ||
    new Date().toISOString();
  const id = String(row.id || row.tweet_id || row.status_id || `arch_${idx}_${created}`);
  const likes = Number(row.likes || row.favorite_count || row.like_count || 0) || 0;
  const retweets = Number(row.retweets || row.retweet_count || 0) || 0;
  const replies = Number(row.replies || row.reply_count || 0) || 0;
  if (!String(text).trim()) return null;
  return {
    id,
    tweet_text: String(text).trim(),
    created_at: created,
    likes,
    retweets,
    replies,
  };
}

export function parseTweetJson(text) {
  const data = JSON.parse(text);
  const arr = Array.isArray(data) ? data : data.tweets || data.statuses || data.data || [];
  if (!Array.isArray(arr)) return [];
  const out = [];
  arr.forEach((row, i) => {
    if (typeof row === "string") return;
    const t = rowToTweet(row, i);
    if (t) out.push(t);
  });
  return out;
}

/** Minimal CSV parser (handles quoted fields). */
export function parseTweetCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const obj = {};
    header.forEach((h, j) => {
      obj[h] = (cols[j] || "").replace(/^"|"$/g, "").trim();
    });
    rows.push(obj);
  }
  const out = [];
  rows.forEach((row, idx) => {
    const t = rowToTweet(row, idx);
    if (t) out.push(t);
  });
  return out;
}

export async function tryFetchArchiveUrl(url, { timeoutMs = 20000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "PoliticalShiftTracker/1.0 (research; +https://localhost)",
        Accept: "text/csv,application/json,text/plain,*/*",
      },
    });
    if (!res.ok) return [];
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const buf = await res.arrayBuffer();
    const text = new TextDecoder("utf-8").decode(buf);
    if (ct.includes("json") || url.toLowerCase().endsWith(".json")) {
      try {
        return parseTweetJson(text);
      } catch {
        return [];
      }
    }
    if (ct.includes("csv") || url.toLowerCase().endsWith(".csv")) {
      return parseTweetCsv(text);
    }
    if (text.trim().startsWith("{") || text.trim().startsWith("[")) {
      try {
        return parseTweetJson(text);
      } catch {
        /* fall through */
      }
    }
    if (text.includes(",") && text.split("\n").length > 5) {
      return parseTweetCsv(text);
    }
    return [];
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

export async function discoverAndIngestArchives(handle, searchWebFn, emit) {
  const queries = buildArchiveQueries(handle);
  const seen = new Set();
  const merged = [];

  for (const q of queries) {
    emit?.({ detail: `archive query: ${q.slice(0, 80)}…` });
    const hits = await searchWebFn(q);
    for (const h of hits) {
      const link = h.link;
      if (!link || seen.has(link)) continue;
      seen.add(link);
      const lower = link.toLowerCase();
      const looksArchive =
        /\.(csv|json)(\?|$)/i.test(lower) ||
        /tweet|binder|osaurus|stalker|foleak|dataverse|kaggle/i.test(lower);
      if (!looksArchive) continue;
      const rows = await tryFetchArchiveUrl(link);
      if (rows.length >= MIN_ROWS) {
        emit?.({ detail: `archive hit: ${link} (${rows.length} rows)` });
        merged.push(...rows);
        if (merged.length >= 3200) return merged.slice(0, 3200);
      }
    }
  }
  return merged;
}
