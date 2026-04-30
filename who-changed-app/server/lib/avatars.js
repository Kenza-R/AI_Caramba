/**
 * Avatar URLs when Twitter hasn't been scraped yet or image is missing.
 * unavatar resolves many X/Twitter profile photos by handle; ui-avatars is a reliable final fallback.
 */
const X_HANDLE_ALIASES = {
  // App search handle -> canonical X username
  hasanabi: "hasanthehun",
};

export function canonicalXHandle(handle) {
  const h = String(handle || "").replace(/^@/, "").toLowerCase();
  return X_HANDLE_ALIASES[h] || h;
}

export function fallbackAvatarUrl(handle) {
  const canonical = canonicalXHandle(handle);
  const h = encodeURIComponent(canonical);
  const initials = handle
    .replace(/^@/, "")
    .slice(0, 2)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "") || "??";
  const ui = encodeURIComponent(
    `https://ui-avatars.com/api/?name=${initials}&size=256&background=1a222c&color=6ee7d8&bold=true`
  );
  return `https://unavatar.io/x/${h}?fallback=${ui}`;
}

export function upgradeTwitterImageUrl(url) {
  if (!url || typeof url !== "string") return url;
  // If this is an unavatar X URL, normalize known aliases to canonical handles.
  if (url.includes("unavatar.io/x/")) {
    return url.replace(/unavatar\.io\/x\/([^?]+)/i, (_m, h) => {
      const canonical = canonicalXHandle(decodeURIComponent(String(h || "")));
      return `unavatar.io/x/${encodeURIComponent(canonical)}`;
    });
  }
  // Request larger variant when Twitter returns _normal
  return url.replace("_normal.", "_400x400.");
}
