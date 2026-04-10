import "dotenv/config";
import express from "express";
import cors from "cors";
import { runPipeline } from "./pipeline.js";
import {
  getAnalysis,
  getFeaturedHandles,
  setFeaturedHandles,
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

function sseWrite(res, obj) {
  res.write(`data: ${JSON.stringify(obj)}\n\n`);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/featured", async (req, res) => {
  let handles = getFeaturedHandles();
  if (!handles.length) {
    setFeaturedHandles(FEATURED_DEFAULT);
    handles = FEATURED_DEFAULT;
  }

  const cards = await Promise.all(
    handles.map(async (h) => {
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
          name: a.profile?.name || FEATURED_LABELS[h] || `@${a.handle}`,
          username: a.profile?.username || a.handle,
          profile_image_url: pic || avatarFallback,
          ring: a.meta?.shift_stability_ring || "stable",
          blurb: (a.narrative?.most_significant_shift || "").slice(0, 220),
          dateRange: a.dateRange,
          demo_mode: Boolean(a.meta?.demo_mode),
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

  try {
    await runPipeline(handle, emit);
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
    if (getAnalysis(h)) return;
    setTimeout(() => {
      runPipeline(h, () => {}).catch((err) =>
        console.error(`Featured backfill failed for @${h}:`, err.message)
      );
    }, 4000 + i * 25000);
  });
}

app.listen(PORT, () => {
  console.log(`API: http://localhost:${PORT}  (open the Vite app at http://127.0.0.1:5173)`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("ANTHROPIC_API_KEY missing — pipeline uses demo scores (set key for real Claude).");
  }
  queueFeaturedBackfill();
});
