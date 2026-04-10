/**
 * Last-resort capture: Playwright scroll + Claude Vision per viewport.
 * Ported from stance_watch/social_profile_scrape.py scroll metrics pattern.
 */
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { callClaudeVisionExtractPosts } from "../lib/anthropic.js";

const SCROLL_METRICS_JS = `() => {
  const r = document.documentElement;
  const b = document.body;
  return {
    scrollTop: r.scrollTop || b.scrollTop || 0,
    clientHeight: r.clientHeight || 0,
    scrollHeight: Math.max(r.scrollHeight || 0, b.scrollHeight || 0),
  };
}`;

const SCROLL_BY_JS = `(delta) => { window.scrollBy(0, delta); return true; }`;

function normalizeVisionPosts(arr, handle, shotIndex) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((row, i) => {
      const text = row.text || row.content || row.tweet || "";
      if (!String(text).trim()) return null;
      let created = row.date || row.posted_at || row.created_at;
      if (created && typeof created === "string") {
        const d = new Date(created);
        created = Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
      } else {
        created = new Date().toISOString();
      }
      return {
        id: `vision_${handle}_${shotIndex}_${i}`,
        tweet_text: String(text).trim(),
        created_at: created,
        likes: Number(row.likes || row.like_count || 0) || 0,
        retweets: Number(row.retweets || row.retweet_count || 0) || 0,
        replies: Number(row.replies || row.reply_count || 0) || 0,
      };
    })
    .filter(Boolean);
}

/**
 * @param {string} handle
 * @param {{ profileUrl: string, emit: Function, maxShots?: number }} opts
 */
export async function runScreenshotVisionScrape(handle, { profileUrl, emit, maxShots }) {
  const { chromium } = await import("playwright");
  const cap = Math.min(maxShots ?? Number(process.env.VISION_SCREENSHOT_MAX || 16), 40);
  const tmp = join(tmpdir(), `pstv_${handle}_${Date.now()}`);
  mkdirSync(tmp, { recursive: true });
  const merged = [];

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();
    await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
    await new Promise((r) => setTimeout(r, 4000));

    let noProgress = 0;
    for (let i = 0; i < cap; i++) {
      emit?.({ shot: i + 1, total: cap, message: `screenshot ${i + 1}/${cap}` });
      const png = await page.screenshot({ type: "png", fullPage: false });
      writeFileSync(join(tmp, `shot_${i}.png`), png);
      try {
        const raw = await callClaudeVisionExtractPosts(Buffer.from(png));
        merged.push(...normalizeVisionPosts(raw, handle, i));
      } catch (e) {
        emit?.({ visionError: String(e.message || e) });
      }

      const before = await page.evaluate(SCROLL_METRICS_JS);
      await page.evaluate(SCROLL_BY_JS, 850);
      await new Promise((r) => setTimeout(r, 2200));
      const after = await page.evaluate(SCROLL_METRICS_JS);
      const moved = after.scrollTop > before.scrollTop + 0.5;
      const taller = after.scrollHeight > before.scrollHeight + 8;
      if (moved || taller) noProgress = 0;
      else {
        noProgress += 1;
        if (noProgress >= 2) break;
      }
    }
    await context.close();
  } finally {
    await browser.close();
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }

  return merged;
}
