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
  setFeaturedHandles,
  listAllAnalyses,
} from "./db/database.js";
import { fallbackAvatarUrl, upgradeTwitterImageUrl } from "./lib/avatars.js";
import { lookupTwitterProfileByUsername } from "./lib/twitterUser.js";

const PORT = Number(process.env.PORT || 3001);
const FEATURED_DEFAULT = ["elonmusk", "tuckercarlson", "tulsigabbard", "billmaher"];
const FEATURED_LABELS = {
  elonmusk: "Elon Musk",
  tuckercarlson: "Tucker Carlson",
  tulsigabbard: "Tulsi Gabbard",
  billmaher: "Bill Maher",
};

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));
const refreshInFlight = new Set();

function hasLlmProvider() {
  return Boolean(process.env.LAVA_API_KEY || process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY);
}

function isDemoAnalysis(a) {
  return Boolean(a?.meta?.demo_mode);
}

function ensureRealAnalysisInBackground(handle) {
  const h = String(handle || "").replace(/^@/, "").toLowerCase();
  if (!h || !hasLlmProvider() || refreshInFlight.has(h)) return;
  refreshInFlight.add(h);
  runPipeline(h, () => {})
    .catch((err) => console.error(`Auto-refresh failed for @${h}:`, err.message))
    .finally(() => refreshInFlight.delete(h));
}

function sseWrite(res, obj) {
  res.write(`data: ${JSON.stringify(obj)}\n\n`);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
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
    name: a.profile?.name || FEATURED_LABELS[h] || `@${h}`,
    username: a.profile?.username || h,
    profile_image_url: pic || avatarFallback,
    ring: a.meta?.shift_stability_ring || "stable",
    blurb,
    dateRange: a.dateRange,
    demo_mode: Boolean(a.meta?.demo_mode),
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
    const a = row.data;
    if (hasLlmProvider() && isDemoAnalysis(a)) {
      ensureRealAnalysisInBackground(h);
      continue;
    }
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
          name: tw?.name || FEATURED_LABELS[h] || `@${h}`,
          username: tw?.username || h,
          profile_image_url: pic || avatarFallback,
          ring: "stable",
          blurb: tw?.description
            ? String(tw.description).slice(0, 220)
            : "Analysis not ready yet — search below or wait for background jobs.",
          demo_mode: false,
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
        if (hasLlmProvider() && isDemoAnalysis(a)) {
          ensureRealAnalysisInBackground(h);
          const tw = await lookupTwitterProfileByUsername(h);
          const pic = tw?.profile_image_url || avatarFallback;
          return {
            handle: h,
            ready: false,
            name: tw?.name || FEATURED_LABELS[h] || `@${h}`,
            username: tw?.username || h,
            profile_image_url: pic || avatarFallback,
            ring: "stable",
            blurb: "Refreshing from old demo snapshot to real analysis…",
            demo_mode: false,
            corpus_tweet_count: null,
            updated_at: a.cachedAt ?? null,
          };
        }
        const raw = a.profile?.profile_image_url || "";
        const pic = raw
          ? upgradeTwitterImageUrl(raw) || raw
          : avatarFallback;
        return {
          handle: a.handle,
          ready: true,
          name: a.profile?.name || FEATURED_LABELS[h] || `@${a.handle}`,
          username: a.profile?.username || a.handle,
          profile_image_url: pic || avatarFallback,
          ring: a.meta?.shift_stability_ring || "stable",
          blurb: (a.narrative?.most_significant_shift || "").slice(0, 220),
          dateRange: a.dateRange,
          demo_mode: Boolean(a.meta?.demo_mode),
          corpus_tweet_count: a.meta?.corpus_tweet_count ?? null,
          updated_at: a.cachedAt ?? null,
        };
      }

      const tw = await lookupTwitterProfileByUsername(h);
      const pic = tw?.profile_image_url || avatarFallback;
      return {
        handle: h,
        ready: false,
        name: tw?.name || FEATURED_LABELS[h] || `@${h}`,
        username: tw?.username || h,
        profile_image_url: pic || avatarFallback,
        ring: "stable",
        blurb: tw?.description
          ? String(tw.description).slice(0, 220)
          : "Analysis not ready yet — click Analyze or wait for background jobs.",
        demo_mode: false,
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
  if (hasLlmProvider() && isDemoAnalysis(a)) {
    ensureRealAnalysisInBackground(h);
    return res.status(409).json({
      error: "refreshing",
      message: "Old demo snapshot detected; refreshing real analysis now. Retry shortly.",
      handle: h,
    });
  }
  res.json(a);
});

app.post("/api/analyze", async (req, res) => {
  const handle = (req.body?.handle || "").replace(/^@/, "").trim().toLowerCase();
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

  try {
    await runPipeline(handle, emit, { forceRescrape });
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

function queueFeaturedBackfill() {
  let handles = getFeaturedHandles();
  if (!handles.length) {
    setFeaturedHandles(FEATURED_DEFAULT);
    handles = FEATURED_DEFAULT;
  }
  handles.forEach((h, i) => {
    const existing = getAnalysis(h);
    if (existing && !(hasLlmProvider() && isDemoAnalysis(existing))) return;
    setTimeout(() => {
      runPipeline(h, () => {}).catch((err) =>
        console.error(`Featured backfill failed for @${h}:`, err.message)
      );
    }, 4000 + i * 25000);
  });
}

const BIND = process.env.BIND_HOST || "0.0.0.0";
app.listen(PORT, BIND, () => {
  console.log(`API: http://127.0.0.1:${PORT}  (Vite UI: http://localhost:5173 — run both: npm run dev from who-changed-app)`);
  if (!(process.env.LAVA_API_KEY || process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY)) {
    console.warn("No LLM key configured — pipeline uses demo scores (set LAVA_API_KEY for real analysis).");
  }
  queueFeaturedBackfill();
});
