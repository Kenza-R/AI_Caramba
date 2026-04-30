import { fallbackAvatarUrl } from "./avatars.js";
import { lookupTwitterProfileByUsername } from "./twitterUser.js";
import { searchWeb } from "./webSearch.js";

const KNOWN_PERSONAS = [
  {
    aliases: ["hasan abi", "hasan piker", "hasanabi", "hasanthehun", "hassan abi"],
    platform: "x",
    handle: "hasanthehun",
    displayName: "Hasan Piker",
    bio: "Political commentator and streamer",
  },
  {
    aliases: ["donald trump", "trump", "realdonaldtrump"],
    platform: "truth",
    handle: "realdonaldtrump",
    displayName: "Donald J. Trump",
    bio: "Truth Social account",
  },
  {
    aliases: ["elon musk", "elon", "elonmusk"],
    platform: "x",
    handle: "elonmusk",
    displayName: "Elon Musk",
    bio: "Business leader and owner of X",
  },
  {
    aliases: ["tucker carlson", "tuckercarlson"],
    platform: "x",
    handle: "tuckercarlson",
    displayName: "Tucker Carlson",
    bio: "Political commentator",
  },
];

function norm(s) {
  return String(s || "").trim();
}

function normalizeHandle(s) {
  return String(s || "")
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "")
    .replace(/^https?:\/\/(www\.)?truthsocial\.com\/@?/i, "")
    .replace(/\/+$/, "")
    .replace(/[^\w.]/g, "")
    .toLowerCase();
}

function suggestedManualHandle(q) {
  const cleaned = String(q || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_ ]/g, "")
    .replace(/\s+/g, "");
  return cleaned || "manual";
}

function titleToName(title, fallback) {
  const t = String(title || "").replace(/\s*\|\s*.+$/, "").trim();
  if (!t) return fallback;
  return t;
}

function addCandidate(store, row) {
  const platform = row.platform;
  const handle = normalizeHandle(row.handle);
  if (!platform || !handle) return;
  const key = `${platform}:${handle}`;
  const existing = store.get(key);
  if (!existing || (row.relevanceScore || 0) > (existing.relevanceScore || 0)) {
    store.set(key, {
      id: key,
      platform,
      handle,
      displayName: row.displayName || `@${handle}`,
      avatarUrl: row.avatarUrl || "",
      bio: row.bio || "",
      relevanceScore: Number(row.relevanceScore || 0),
    });
  }
}

function parseXHandleFromLink(link) {
  const m = /^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,32})(?:[/?#]|$)/i.exec(
    String(link || "")
  );
  if (!m) return null;
  const h = String(m[1] || "").toLowerCase();
  if (["home", "explore", "search", "i", "messages", "settings", "compose", "notifications"].includes(h)) {
    return null;
  }
  return h;
}

function parseTruthHandleFromLink(link) {
  const m = /^https?:\/\/(?:www\.)?truthsocial\.com\/@?([A-Za-z0-9_.-]{1,40})(?:[/?#]|$)/i.exec(
    String(link || "")
  );
  if (!m) return null;
  return String(m[1] || "").replace(/[.-]/g, "_").toLowerCase();
}

function queryTokens(query) {
  return String(query || "")
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function scoreRow(query, handle, title, snippet, platform) {
  const q = String(query || "").toLowerCase();
  const h = String(handle || "").toLowerCase();
  const t = String(title || "").toLowerCase();
  const s = String(snippet || "").toLowerCase();
  let score = platform === "x" ? 40 : 32;
  if (q === h || q === `@${h}`) score += 80;
  if (h.includes(q) || q.includes(h)) score += 28;
  for (const tok of queryTokens(q)) {
    if (tok.length < 2) continue;
    if (h.includes(tok)) score += 10;
    if (t.includes(tok)) score += 4;
    if (s.includes(tok)) score += 2;
  }
  return score;
}

export async function searchProfiles(query, opts = {}) {
  const q = norm(query);
  const qLower = q.toLowerCase();
  const limit = Math.max(3, Math.min(12, Number(opts.limit || 8) || 8));
  const candidates = new Map();
  const maybeHandle = normalizeHandle(q);
  const directHandleInput =
    /^@?[A-Za-z0-9_]{2,32}$/.test(q) ||
    /^https?:\/\/(?:www\.)?(?:x|twitter|truthsocial)\.com\//i.test(q);

  if (directHandleInput && maybeHandle) {
    const exactX = await lookupTwitterProfileByUsername(maybeHandle);
    if (exactX) {
      addCandidate(candidates, {
        platform: "x",
        handle: exactX.username,
        displayName: exactX.name || `@${exactX.username}`,
        avatarUrl: exactX.profile_image_url || fallbackAvatarUrl(exactX.username),
        bio: exactX.description || "",
        relevanceScore: 140,
      });
    } else {
      addCandidate(candidates, {
        platform: "x",
        handle: maybeHandle,
        displayName: `@${maybeHandle}`,
        avatarUrl: fallbackAvatarUrl(maybeHandle),
        bio: "Manual X handle",
        relevanceScore: 90,
      });
    }
  }

  for (const p of KNOWN_PERSONAS) {
    const hit = p.aliases.some((a) => qLower.includes(a) || a.includes(qLower));
    if (!hit) continue;
    addCandidate(candidates, {
      platform: p.platform,
      handle: p.handle,
      displayName: p.displayName,
      avatarUrl: fallbackAvatarUrl(p.handle),
      bio: p.bio,
      relevanceScore: 125,
    });
  }

  const searchResults = await searchWeb(
    `${q} (site:x.com OR site:twitter.com OR site:truthsocial.com)`
  ).catch(() => []);

  for (const row of searchResults || []) {
    const link = String(row.link || "");
    const xHandle = parseXHandleFromLink(link);
    if (xHandle) {
      addCandidate(candidates, {
        platform: "x",
        handle: xHandle,
        displayName: titleToName(row.title, `@${xHandle}`),
        avatarUrl: fallbackAvatarUrl(xHandle),
        bio: String(row.snippet || ""),
        relevanceScore: scoreRow(q, xHandle, row.title, row.snippet, "x"),
      });
    }
    const truthHandle = parseTruthHandleFromLink(link);
    if (truthHandle) {
      addCandidate(candidates, {
        platform: "truth",
        handle: truthHandle,
        displayName: titleToName(row.title, `@${truthHandle}`),
        avatarUrl: fallbackAvatarUrl(truthHandle),
        bio: String(row.snippet || ""),
        relevanceScore: scoreRow(q, truthHandle, row.title, row.snippet, "truth"),
      });
    }
  }

  const out = [...candidates.values()]
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit - 1);

  const manualHandle = suggestedManualHandle(q);
  out.push({
    id: `manual:${manualHandle}`,
    platform: "manual",
    handle: manualHandle,
    displayName: `Use manual entry: @${manualHandle}`,
    avatarUrl: fallbackAvatarUrl(manualHandle),
    bio: "Analyze with this handle directly",
    relevanceScore: 1,
  });

  return out;
}

