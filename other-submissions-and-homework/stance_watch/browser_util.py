"""Shared Playwright launch helpers (pattern from marketing_agent / tiktok_search)."""
from __future__ import annotations

from pathlib import Path

_IGNORE_PLAYWRIGHT_DEFAULTS = ["--enable-automation"]
_EXTRA_BROWSER_ARGS = ["--disable-blink-features=AutomationControlled"]
_DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)


def open_browser_context(
    p,
    *,
    headed: bool,
    persistent_profile: Path | None,
    bundled_chromium_only: bool,
):
    """Return (browser_or_none, context, page, channel_label)."""
    headless = not headed
    context_opts: dict = {
        "locale": "en-US",
        "user_agent": _DEFAULT_USER_AGENT,
        "viewport": {"width": 1280, "height": 900},
    }

    if bundled_chromium_only:
        channel_attempts: list[str | None] = [None]
    elif persistent_profile is not None:
        channel_attempts = ["chrome", None]
    else:
        channel_attempts = ["chrome", "msedge", None]

    last_err: Exception | None = None
    for channel in channel_attempts:
        try:
            if persistent_profile is not None:
                persistent_profile.mkdir(parents=True, exist_ok=True)
                kw: dict = {
                    "user_data_dir": str(persistent_profile.resolve()),
                    "headless": headless,
                    "ignore_default_args": _IGNORE_PLAYWRIGHT_DEFAULTS,
                    "args": _EXTRA_BROWSER_ARGS,
                    **context_opts,
                }
                if channel:
                    kw["channel"] = channel
                context = p.chromium.launch_persistent_context(**kw)
                page = context.pages[0] if context.pages else context.new_page()
                return None, context, page, channel or "chromium"

            launch_kw: dict = {
                "headless": headless,
                "ignore_default_args": _IGNORE_PLAYWRIGHT_DEFAULTS,
                "args": _EXTRA_BROWSER_ARGS,
            }
            if channel:
                launch_kw["channel"] = channel
            browser = p.chromium.launch(**launch_kw)
            context = browser.new_context(**context_opts)
            page = context.new_page()
            return browser, context, page, channel or "chromium"
        except Exception as e:
            last_err = e
            continue

    raise RuntimeError(
        "Could not start a browser. Install Google Chrome, or run: playwright install chromium\n"
        f"Last error: {last_err}"
    ) from last_err
