"""
Scroll a public profile URL (X, Truth Social, etc.), save viewport screenshots, and try to
harvest visible timeline text from ``article`` elements (layout-specific; best-effort).

  pip install playwright
  playwright install chromium

Write manifest to project outputs when using --project, or a custom --json-out.

This does not bypass logins or paywalls; use --headed and --profile for session cookies if needed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from browser_util import open_browser_context

WAIT_AFTER_LOAD_S = 5.0
WAIT_AFTER_SCROLL_S = 2.5
DEFAULT_SCREENSHOT_PARENT = Path("profile_shots")

_SCROLL_METRICS_JS = r"""() => {
  const r = document.documentElement;
  const b = document.body;
  return {
    scrollTop: r.scrollTop || b.scrollTop || 0,
    clientHeight: r.clientHeight || 0,
    scrollHeight: Math.max(r.scrollHeight || 0, b.scrollHeight || 0),
  };
}"""

_SCROLL_BY_JS = r"""(delta) => { window.scrollBy(0, delta); return true; }"""

_EXTRACT_TIMELINE_JS = r"""
() => {
  const chunks = [];
  const seen = new Set();
  const articles = document.querySelectorAll('article');
  for (const a of articles) {
    const t = (a.innerText || "").replace(/\s+/g, " ").trim();
    if (t.length < 15) continue;
    const key = t.slice(0, 120);
    if (seen.has(key)) continue;
    seen.add(key);
    chunks.push(t.slice(0, 4000));
  }
  if (chunks.length === 0) {
    const nodes = document.querySelectorAll('[data-testid="tweetText"], [lang]');
    for (const n of nodes) {
      const t = (n.innerText || "").replace(/\s+/g, " ").trim();
      if (t.length < 15) continue;
      const key = t.slice(0, 120);
      if (seen.has(key)) continue;
      seen.add(key);
      chunks.push(t.slice(0, 4000));
    }
  }
  return chunks;
}
"""


def _slug_from_url(url: str) -> str:
    h = hashlib.sha256(url.encode("utf-8")).hexdigest()[:12]
    host = re.sub(r"[^\w.-]+", "_", url.split("//")[-1].split("/")[0])[:40]
    return f"{host}_{h}"


def capture_scroll_screenshots(
    page,
    out_dir: Path,
    prefix: str,
    *,
    scroll_pixels: int,
    max_screenshots: int,
    pause_s: float,
    shot_timeout_ms: int,
    initial_wait_s: float,
) -> list[str]:
    out_dir.mkdir(parents=True, exist_ok=True)
    saved: list[str] = []
    no_progress = 0
    if initial_wait_s > 0:
        time.sleep(initial_wait_s)

    for i in range(max_screenshots):
        path = out_dir / f"{prefix}_{i:04d}.png"
        page.screenshot(path=str(path), full_page=False, timeout=min(shot_timeout_ms, 60_000))
        saved.append(str(path.resolve()))

        before = page.evaluate(_SCROLL_METRICS_JS)
        page.evaluate(_SCROLL_BY_JS, scroll_pixels)
        time.sleep(pause_s)
        after = page.evaluate(_SCROLL_METRICS_JS)

        moved = after["scrollTop"] > before["scrollTop"] + 0.5
        taller = after["scrollHeight"] > before["scrollHeight"] + 8
        if moved or taller:
            no_progress = 0
        else:
            no_progress += 1
            if no_progress >= 2:
                break

    return saved


def scrape_profile(
    profile_url: str,
    *,
    headed: bool,
    timeout_ms: int,
    persistent_profile: Path | None,
    bundled_chromium_only: bool,
    screenshot_dir: Path | None,
    screenshot_scroll_px: int,
    max_screenshots: int,
    screenshot_pause_s: float,
    extract_text: bool,
) -> dict:
    from playwright.sync_api import sync_playwright

    prefix = _slug_from_url(profile_url)
    screenshot_paths: list[str] = []
    timeline_texts: list[str] = []
    final_url = profile_url.strip()

    with sync_playwright() as p:
        browser, context, page, channel = open_browser_context(
            p,
            headed=headed,
            persistent_profile=persistent_profile,
            bundled_chromium_only=bundled_chromium_only,
        )
        try:
            page.goto(profile_url, wait_until="domcontentloaded", timeout=timeout_ms)
            if screenshot_dir is not None:
                shot_folder = screenshot_dir.resolve() / prefix
                screenshot_paths = capture_scroll_screenshots(
                    page,
                    shot_folder,
                    prefix,
                    scroll_pixels=max(200, screenshot_scroll_px),
                    max_screenshots=max(1, max_screenshots),
                    pause_s=max(0.1, screenshot_pause_s),
                    shot_timeout_ms=min(timeout_ms, 60_000),
                    initial_wait_s=WAIT_AFTER_LOAD_S,
                )
            else:
                time.sleep(WAIT_AFTER_LOAD_S)

            if extract_text:
                for _ in range(5):
                    chunk = page.evaluate(_EXTRACT_TIMELINE_JS)
                    if isinstance(chunk, list):
                        for t in chunk:
                            if isinstance(t, str) and t.strip():
                                timeline_texts.append(t.strip())
                    try:
                        page.mouse.wheel(0, 1200)
                    except Exception:
                        break
                    time.sleep(WAIT_AFTER_SCROLL_S)
                # dedupe preserve order
                seen: set[str] = set()
                uniq: list[str] = []
                for t in timeline_texts:
                    k = t[:100]
                    if k in seen:
                        continue
                    seen.add(k)
                    uniq.append(t)
                timeline_texts = uniq

            final_url = page.url
        finally:
            context.close()
            if browser is not None:
                browser.close()

    return {
        "requested_url": profile_url,
        "final_url": final_url,
        "scraped_at_utc": datetime.now(timezone.utc).isoformat(),
        "browser_channel": channel,
        "screenshots": screenshot_paths,
        "screenshot_folder": str((screenshot_dir.resolve() / prefix)) if screenshot_dir else None,
        "timeline_text_snippets": timeline_texts if extract_text else [],
        "note": "Timeline text is best-effort; sites change DOM often. Prefer API export or manual posts.json for research-grade series.",
    }


def main() -> None:
    from stance_project import StanceWatchProject

    ap = argparse.ArgumentParser(description="Scroll a social profile; screenshots + optional text snippets.")
    ap.add_argument("url", help="Profile or timeline URL (https://…)")
    ap.add_argument(
        "--project",
        type=Path,
        default=None,
        help="StanceWatch project folder (writes outputs/scrape_manifest.json)",
    )
    ap.add_argument("--headed", action="store_true", help="Show browser window.")
    ap.add_argument("--timeout", type=int, default=90_000, help="Navigation timeout (ms).")
    ap.add_argument("--profile", type=Path, default=None, metavar="DIR", help="Persistent browser profile dir.")
    ap.add_argument("--bundled-chromium", action="store_true", help="Use Playwright Chromium only.")
    ap.add_argument(
        "--screenshot-dir",
        type=Path,
        default=DEFAULT_SCREENSHOT_PARENT,
        help=f"Parent folder for PNGs (default {DEFAULT_SCREENSHOT_PARENT})",
    )
    ap.add_argument("--no-screenshots", action="store_true", help="Skip PNG capture.")
    ap.add_argument("--screenshot-scroll-pixels", type=int, default=850)
    ap.add_argument("--max-screenshots", type=int, default=80)
    ap.add_argument("--screenshot-pause", type=float, default=WAIT_AFTER_SCROLL_S)
    ap.add_argument("--no-text-extract", action="store_true", help="Skip DOM text harvest.")
    ap.add_argument("-o", "--json-out", type=Path, default=None, help="Write manifest JSON here.")
    ap.add_argument("--stdout-only", action="store_true", help="Print JSON to stdout only.")
    args = ap.parse_args()

    shot_parent = None if args.no_screenshots else args.screenshot_dir
    payload = scrape_profile(
        args.url,
        headed=args.headed,
        timeout_ms=args.timeout,
        persistent_profile=args.profile,
        bundled_chromium_only=args.bundled_chromium,
        screenshot_dir=shot_parent,
        screenshot_scroll_px=args.screenshot_scroll_pixels,
        max_screenshots=args.max_screenshots,
        screenshot_pause_s=args.screenshot_pause,
        extract_text=not args.no_text_extract,
    )
    text = json.dumps(payload, indent=2, ensure_ascii=False)

    out_path = args.json_out
    if args.project is not None:
        proj = StanceWatchProject.from_path(args.project)
        proj.ensure_layout()
        out_path = proj.scrape_manifest_json
    if args.stdout_only:
        print(text)
    elif out_path is not None:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(text, encoding="utf-8")
        print(f"Saved: {out_path.resolve()}", file=sys.stderr)
    else:
        print(text)

    if shot_parent and payload.get("screenshots"):
        print(f"Screenshots: {len(payload['screenshots'])} files under {payload.get('screenshot_folder')}", file=sys.stderr)


if __name__ == "__main__":
    main()
