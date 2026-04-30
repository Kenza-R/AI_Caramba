import { mkdir, writeFile, rm } from "fs/promises";
import { dirname, join } from "path";

function shQuote(s) {
  return `'${String(s || "").replace(/'/g, `'\"'\"'`)}'`;
}

function boolEnv(name, fallback = false) {
  const v = String(process.env[name] || "").toLowerCase();
  if (!v) return fallback;
  return v === "1" || v === "true" || v === "yes";
}

function resolveCapturePath() {
  return (
    process.env.XTIMELINE_CURL_PATH ||
    join(process.cwd(), "server", "curl.txt")
  );
}

function cookieHeaderFromList(cookies) {
  return (cookies || [])
    .filter((c) => c?.name && c?.value)
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

function buildCurlFromRequest(req, cookieHeader = "") {
  const url = req.url();
  const method = req.method();
  const headers = req.headers() || {};
  const lines = [`curl ${shQuote(url)} -X ${shQuote(method)}`];
  for (const [k, v] of Object.entries(headers)) {
    const lk = String(k || "").toLowerCase();
    if (!v) continue;
    if (lk === "content-length" || lk.startsWith(":") || lk === "cookie") continue;
    lines.push(`  -H ${shQuote(`${k}: ${v}`)}`);
  }
  if (cookieHeader) {
    lines.push(`  -H ${shQuote(`cookie: ${cookieHeader}`)}`);
  }
  const body = req.postData();
  if (body) lines.push(`  --data-raw ${shQuote(body)}`);
  return lines.join(" \\\n");
}

export async function captureXTimelineCurl(handle) {
  const { chromium } = await import("playwright");
  const savePath = resolveCapturePath();
  const timeoutMs = Math.max(
    15000,
    Number(process.env.XTIMELINE_CAPTURE_TIMEOUT_MS || 60000) || 60000
  );
  const headless = boolEnv("XTIMELINE_HEADLESS", true);
  const browserChannel = process.env.XTIMELINE_BROWSER_CHANNEL || "chrome";
  const userDataDir =
    process.env.XTIMELINE_USER_DATA_DIR ||
    join(process.cwd(), "server", ".x-session");

  // Best-effort cleanup for stale singleton lock artifacts from crashed runs.
  await Promise.all(
    ["SingletonLock", "SingletonSocket", "SingletonCookie"].map((name) =>
      rm(join(userDataDir, name), { force: true }).catch(() => {})
    )
  );

  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: browserChannel,
    headless,
    viewport: { width: 1280, height: 900 },
    ignoreDefaultArgs: ["--enable-automation"],
  });
  try {
    const page = context.pages()[0] || (await context.newPage());
    const reqPromise = page.waitForRequest(
      (r) =>
        /graphql/i.test(r.url()) &&
        /(UserTweets|UserTweetsAndReplies|UserMedia)/i.test(
          r.url()
        ) &&
        r.method() === "GET",
      { timeout: timeoutMs }
    );

    await page.goto(`https://x.com/${String(handle || "").replace(/^@/, "")}`, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    // Trigger timeline request on lazy loads.
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.scrollBy(0, 900));
    await page.waitForTimeout(1000);
    const req = await reqPromise;
    let cookies = await context.cookies("https://x.com");
    let cookieHeader = cookieHeaderFromList(cookies);
    let hasAuth = /(?:^|;\s*)auth_token=/.test(cookieHeader) && /(?:^|;\s*)ct0=/.test(cookieHeader);
    if (!hasAuth && !headless) {
      // Give user a chance to log in interactively in visible mode.
      await page.goto("https://x.com/i/flow/login", {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs,
      });
      const waitUntil = Date.now() + 120000;
      while (Date.now() < waitUntil) {
        await page.waitForTimeout(2000);
        cookies = await context.cookies("https://x.com");
        cookieHeader = cookieHeaderFromList(cookies);
        hasAuth =
          /(?:^|;\s*)auth_token=/.test(cookieHeader) &&
          /(?:^|;\s*)ct0=/.test(cookieHeader);
        if (hasAuth) break;
      }
    }
    if (!hasAuth) {
      throw new Error(
        "Captured browser session is unauthenticated. Log into X in this browser profile, then retry."
      );
    }
    const curlText = buildCurlFromRequest(req, cookieHeader);
    await mkdir(dirname(savePath), { recursive: true });
    await writeFile(savePath, `${curlText}\n`, "utf8");
    return { savePath };
  } finally {
    await context.close();
  }
}

