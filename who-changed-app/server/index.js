import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import express from "express";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env"), override: true });
import cors from "cors";
import { runPipeline } from "./pipeline.js";
import {
  getAnalysis,
  getFeaturedHandles,
  getTweetsForHandle,
  setFeaturedHandles,
  listAllAnalyses,
} from "./db/database.js";
import { fallbackAvatarUrl, upgradeTwitterImageUrl } from "./lib/avatars.js";
import { lookupTwitterProfileByUsername } from "./lib/twitterUser.js";
import { searchProfiles } from "./lib/profileSearch.js";
import { runScraperAgent } from "./agents/scraperAgent.js";
import { tweetsToCsv } from "./lib/csvExport.js";

const PORT = Number(process.env.PORT || 3001);
const FEATURED_DEFAULT = [];

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

function sseWrite(res, obj) {
  res.write(`data: ${JSON.stringify(obj)}\n\n`);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/profile-search", async (req, res) => {
  const q = String(req.query?.q || "").trim();
  const limit = Number(req.query?.limit);
  if (!q) return res.json({ query: q, options: [] });
  try {
    const options = await searchProfiles(q, {
      limit: Number.isFinite(limit) ? limit : 8,
    });
    res.json({ query: q, options });
  } catch (e) {
    res.status(500).json({
      error: "profile_search_failed",
      message: String(e?.message || e),
    });
  }
});

function figureCardFromAnalysisRow(row) {
  const a = row.data;
  const h = String(row.handle || a.handle || "").toLowerCase();
  const avatarFallback = fallbackAvatarUrl(h);
  const raw = a.profile?.profile_image_url || "";
  const pic = raw ? upgradeTwitterImageUrl(raw) || raw : avatarFallback;
  const blurb =
    (a.narrative?.most_significant_shift || a.narrative?.full_summary || "").slice(0, 220) ||
    "Analysis complete — open dossier for full breakdown.";
  return {
    handle: h,
    ready: true,
    name: a.profile?.name || `@${h}`,
    username: a.profile?.username || h,
    profile_image_url: pic || avatarFallback,
    ring: a.meta?.shift_stability_ring || "stable",
    blurb,
    dateRange: a.dateRange,
    corpus_tweet_count: a.meta?.corpus_tweet_count ?? null,
    updated_at: row.updated_at,
  };
}

/** All saved analyses (newest first) plus featured handles still pending. */
app.get("/api/figures", async (req, res) => {
  let featured = getFeaturedHandles();
  if (!featured.length) {
    setFeaturedHandles(FEATURED_DEFAULT);
    featured = FEATURED_DEFAULT;
  }

  const seen = new Set();
  const ready = [];

  for (const row of listAllAnalyses()) {
    const h = String(row.handle).toLowerCase();
    if (seen.has(h)) continue;
    seen.add(h);
    ready.push(figureCardFromAnalysisRow(row));
  }

  const pending = await Promise.all(
    featured
      .filter((h) => !seen.has(h.toLowerCase()))
      .map(async (h) => {
        const avatarFallback = fallbackAvatarUrl(h);
        const tw = await lookupTwitterProfileByUsername(h);
        const pic = tw?.profile_image_url || avatarFallback;
        return {
          handle: h,
          ready: false,
          name: tw?.name || `@${h}`,
          username: tw?.username || h,
          profile_image_url: pic || avatarFallback,
          ring: "stable",
          blurb: tw?.description
            ? String(tw.description).slice(0, 220)
            : "Analysis not ready yet — search below or wait for background jobs.",
          corpus_tweet_count: null,
          updated_at: null,
        };
      }),
  );

  res.json({ figures: [...ready, ...pending] });
});

/** @deprecated Use GET /api/figures — kept for older clients. */
app.get("/api/featured", async (_req, res) => {
  let featured = getFeaturedHandles();
  if (!featured.length) {
    setFeaturedHandles(FEATURED_DEFAULT);
    featured = FEATURED_DEFAULT;
  }

  const cards = await Promise.all(
    featured.map(async (h) => {
      const a = getAnalysis(h);
      const avatarFallback = fallbackAvatarUrl(h);

      if (a) {
        const raw = a.profile?.profile_image_url || "";
        const pic = raw
          ? upgradeTwitterImageUrl(raw) || raw
          : avatarFallback;
        return {
          handle: a.handle,
          ready: true,
          name: a.profile?.name || `@${a.handle}`,
          username: a.profile?.username || a.handle,
          profile_image_url: pic || avatarFallback,
          ring: a.meta?.shift_stability_ring || "stable",
          blurb: (a.narrative?.most_significant_shift || "").slice(0, 220),
          dateRange: a.dateRange,
          corpus_tweet_count: a.meta?.corpus_tweet_count ?? null,
          updated_at: a.cachedAt ?? null,
        };
      }

      const tw = await lookupTwitterProfileByUsername(h);
      const pic = tw?.profile_image_url || avatarFallback;
      return {
        handle: h,
        ready: false,
        name: tw?.name || `@${h}`,
        username: tw?.username || h,
        profile_image_url: pic || avatarFallback,
        ring: "stable",
        blurb: tw?.description
          ? String(tw.description).slice(0, 220)
          : "Analysis not ready yet — click Analyze or wait for background jobs.",
        corpus_tweet_count: null,
        updated_at: null,
      };
    })
  );

  res.json({ figures: cards });
});

app.get("/api/figure/:handle", (req, res) => {
  const h = req.params.handle.replace(/^@/, "").toLowerCase();
  const a = getAnalysis(h);
  if (!a) {
    return res.status(404).json({ error: "not_found", message: "Run analysis first." });
  }
  res.json(a);
});

app.post("/api/analyze", async (req, res) => {
  const selected = req.body?.selection && typeof req.body.selection === "object"
    ? req.body.selection
    : null;
  const selectedHandle = selected?.handle ? String(selected.handle) : "";
  const handle = (selectedHandle || req.body?.handle || "").replace(/^@/, "").trim().toLowerCase();
  if (!handle) {
    return res.status(400).json({ error: "handle_required" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (res.flushHeaders) res.flushHeaders();

  const emit = (ev) => sseWrite(res, ev);
  const forceRescrape = req.body?.forceRescrape === true;
  const maxPosts = Number(req.body?.maxPosts);
  const allowXCapture = req.body?.allowXCapture === true;
  const preferredPlatform = selected?.platform ? String(selected.platform) : undefined;

  try {
    await runPipeline(handle, emit, {
      forceRescrape,
      maxPosts: Number.isFinite(maxPosts) ? maxPosts : undefined,
      allowXCapture,
      preferredPlatform,
    });
  } catch (e) {
    sseWrite(res, {
      stage: "error",
      message: String(e.message || e),
      progress: 1,
    });
  } finally {
    res.end();
  }
});

app.post("/api/scrape-export", async (req, res) => {
  const selected = req.body?.selection && typeof req.body.selection === "object"
    ? req.body.selection
    : null;
  const selectedHandle = selected?.handle ? String(selected.handle) : "";
  const handle = (selectedHandle || req.body?.handle || "")
    .replace(/^@/, "")
    .trim()
    .toLowerCase();
  if (!handle) {
    return res.status(400).json({ error: "handle_required" });
  }

  const maxPostsRaw = Number(req.body?.maxPosts ?? process.env.EXPORT_MAX_POSTS ?? 10000);
  const maxPosts = Math.max(500, Math.min(50000, Number.isFinite(maxPostsRaw) ? maxPostsRaw : 10000));

  try {
    const events = [];
    await runScraperAgent(
      handle,
      (ev) => events.push(ev),
      {
        forceRescrape: req.body?.forceRescrape !== false,
        maxPosts,
        allowXCapture: req.body?.allowXCapture === true,
        preferredPlatform: selected?.platform ? String(selected.platform) : undefined,
      },
    );
    const rows = getTweetsForHandle(handle);
    return res.json({
      ok: true,
      handle,
      tweet_count: rows.length,
      date_range: {
        start: rows[0]?.created_at || null,
        end: rows[rows.length - 1]?.created_at || null,
      },
      download_url: `/api/export/${encodeURIComponent(handle)}.csv`,
      events,
    });
  } catch (e) {
    return res.status(500).json({
      error: "scrape_export_failed",
      message: String(e?.message || e),
    });
  }
});

app.get("/api/export/:handle.csv", (req, res) => {
  const handle = String(req.params.handle || "").replace(/^@/, "").toLowerCase();
  if (!handle) {
    return res.status(400).json({ error: "handle_required" });
  }
  const rows = getTweetsForHandle(handle);
  if (!rows.length) {
    return res.status(404).json({
      error: "not_found",
      message: "No scraped tweets found for this handle yet. Run scrape export first.",
    });
  }
  const csv = tweetsToCsv(rows, handle);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${handle}-tweets-3y.csv"`);
  res.status(200).send(csv);
});

const BIND = process.env.BIND_HOST || "0.0.0.0";
app.listen(PORT, BIND, () => {
  console.log(`API: http://127.0.0.1:${PORT}  (Vite UI: http://localhost:5173 — run both: npm run dev from who-changed-app)`);
});
