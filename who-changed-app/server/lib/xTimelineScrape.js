import { access, readFile } from "fs/promises";
import { constants } from "fs";
import { join } from "path";
import { canonicalXHandle } from "./avatars.js";

function extractCurlUrl(curlText) {
  const m = /curl\s+'([^']+)'/.exec(curlText);
  return m?.[1] || "";
}

function extractCurlHeaders(curlText) {
  const out = {};
  for (const m of curlText.matchAll(/-H\s+'([^:]+):\s*([^']*)'/g)) {
    const key = String(m[1] || "").trim();
    const val = String(m[2] || "").trim();
    if (!key) continue;
    out[key] = key.toLowerCase() === "authorization" ? decodeURIComponent(val) : val;
  }
  return out;
}

function parseIsoDate(v) {
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.toISOString() : "";
}

function pickTweetResult(entry) {
  if (!entry || typeof entry !== "object") return null;
  const content = entry?.content;
  const candidates = [
    content?.itemContent?.tweet_results?.result,
    content?.content?.itemContent?.tweet_results?.result,
    content?.tweet_results?.result,
    entry?.itemContent?.tweet_results?.result,
  ];
  for (const c of candidates) {
    if (c && typeof c === "object") return c.tweet || c;
  }
  return null;
}

function extractCursor(entry) {
  const c = entry?.content;
  if (!c) return null;
  if (c?.entryType === "TimelineTimelineCursor" && c?.cursorType === "Bottom") {
    return c?.value || null;
  }
  const inner = c?.content;
  if (inner?.entryType === "TimelineTimelineCursor" && inner?.cursorType === "Bottom") {
    return inner?.value || null;
  }
  if (String(entry?.entryId || "").includes("cursor-bottom")) {
    return c?.value || inner?.value || null;
  }
  return null;
}

function tweetsAndCursorFromResponse(data, targetHandle, startMs) {
  const out = [];
  let nextCursor = null;

  const instructions =
    data?.data?.user?.result?.timeline?.timeline?.instructions ||
    data?.data?.user?.result?.timeline_v2?.timeline?.instructions ||
    [];
  for (const ins of instructions) {
    const entries = [];
    if (Array.isArray(ins?.entries)) entries.push(...ins.entries);
    if (ins?.entry) entries.push(ins.entry);

    for (const entry of entries) {
      const cursor = extractCursor(entry);
      if (cursor) nextCursor = cursor;

      const result = pickTweetResult(entry);
      if (!result) continue;
      const legacy = result?.legacy || {};
      const userLegacy = result?.core?.user_results?.result?.legacy || result?.user_results?.result?.legacy || {};
      const handle = String(userLegacy?.screen_name || "").replace(/^@/, "").toLowerCase();
      if (handle && handle !== targetHandle) continue;

      const createdAt = parseIsoDate(legacy?.created_at || "");
      if (!createdAt) continue;
      if (startMs && new Date(createdAt).getTime() < startMs) continue;

      out.push({
        id: String(result?.rest_id || legacy?.id_str || ""),
        tweet_text: String(legacy?.full_text || legacy?.text || ""),
        created_at: createdAt,
        likes: Number(legacy?.favorite_count || 0),
        retweets: Number(legacy?.retweet_count || 0),
        replies: Number(legacy?.reply_count || 0),
      });
    }
  }

  return { tweets: out, nextCursor };
}

function dedupeAndSort(rows) {
  const seen = new Set();
  const out = [];
  for (const r of rows || []) {
    const id = String(r?.id || "");
    const text = String(r?.tweet_text || "").trim();
    if (!id || !text || seen.has(id)) continue;
    seen.add(id);
    out.push(r);
  }
  out.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  return out;
}

function sampleEvenly(sortedTweets, maxPosts) {
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

async function resolveUserIdByHandle(handle, headers) {
  const h = String(handle || "").replace(/^@/, "").trim().toLowerCase();
  if (!h) return null;
  try {
    const url = "https://api.x.com/graphql/G3KGOASz96M-Qu0nwmGXNg/UserByScreenName";
    const variables = JSON.stringify({
      screen_name: h,
      withSafetyModeUserFields: true,
    });
    const res = await fetch(`${url}?variables=${encodeURIComponent(variables)}`, {
      method: "GET",
      headers,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const rest = data?.data?.user?.result?.rest_id;
    if (rest) return String(rest);
  } catch {
    // fallback below
  }
  try {
    const res = await fetch(`https://x.com/${encodeURIComponent(h)}`, {
      headers: { "user-agent": "Mozilla/5.0" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m = /"rest_id"\s*:\s*"(\d+)"/.exec(html);
    return m?.[1] || null;
  } catch {
    return null;
  }
}

function buildRequestUrl(baseUrl, userId, cursor) {
  const u = new URL(baseUrl);
  const varsRaw = u.searchParams.get("variables");
  if (!varsRaw) return u.toString();
  let vars;
  try {
    vars = JSON.parse(varsRaw);
  } catch {
    return u.toString();
  }
  if (userId) vars.userId = String(userId);
  if (cursor) vars.cursor = String(cursor);
  else delete vars.cursor;
  u.searchParams.set("variables", JSON.stringify(vars));
  return u.toString();
}

export async function fetchViaXTimelineScraper({ handle, startIso, maxPosts }) {
  const curlPath =
    process.env.XTIMELINE_CURL_PATH || join(process.cwd(), "server", "curl.txt");
  await access(curlPath, constants.R_OK);
  const raw = await readFile(curlPath, "utf8");

  const canonical = canonicalXHandle(handle);
  const targetHandle = String(canonical || handle || "").replace(/^@/, "").toLowerCase();
  const baseUrl = extractCurlUrl(raw);
  const headers = extractCurlHeaders(raw);
  if (!baseUrl) throw new Error("curl.txt missing request URL");
  if (!headers.authorization) throw new Error("curl.txt missing authorization header");
  const userId = await resolveUserIdByHandle(targetHandle, headers);

  const startMs = startIso ? new Date(startIso).getTime() : 0;
  const timeoutMs = Math.max(10000, Number(process.env.XTIMELINE_TIMEOUT_MS || 45000) || 45000);
  const maxPages = Math.max(5, Math.min(300, Math.ceil((maxPosts || 3200) / 20) + 12));

  let cursor = null;
  let pages = 0;
  const all = [];
  while (pages < maxPages) {
    pages += 1;
    const reqUrl = buildRequestUrl(baseUrl, userId, cursor);
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(reqUrl, {
        method: "GET",
        headers,
        signal: ctl.signal,
      });
    } finally {
      clearTimeout(t);
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`X GraphQL fetch failed (${res.status}): ${txt.slice(0, 220)}`);
    }
    const data = await res.json();
    const { tweets, nextCursor } = tweetsAndCursorFromResponse(data, targetHandle, startMs);
    all.push(...tweets);
    if (!nextCursor || nextCursor === cursor) break;
    cursor = nextCursor;
    if (all.length >= (maxPosts || 3200)) break;
  }

  const sorted = dedupeAndSort(all);
  return sampleEvenly(sorted, maxPosts || 3200);
}

