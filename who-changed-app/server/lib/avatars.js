/**
 * Avatar URLs when Twitter hasn't been scraped yet or image is missing.
 * unavatar resolves many X/Twitter profile photos by handle; ui-avatars is a reliable final fallback.
 */
export function fallbackAvatarUrl(handle) {
  const h = encodeURIComponent(handle.replace(/^@/, "").toLowerCase());
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
  // Request larger variant when Twitter returns _normal
  return url.replace("_normal.", "_400x400.");
}
