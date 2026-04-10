/** Empty in dev → same-origin + Vite `/api` proxy. Set in client/.env when the API runs elsewhere. */
export function apiUrl(path: string): string {
  const base = String(import.meta.env.VITE_API_URL || "")
    .trim()
    .replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!base) return p;
  return `${base}${p}`;
}

export function explainApiNetworkError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(raw)) {
    return [
      "Cannot reach the Mind Shift Lens API.",
      "Start the server (port 3001), then reload. From the who-changed-app folder run: npm run dev",
      "Or run API and UI together from the repo root: npm run dev",
    ].join(" ");
  }
  return raw;
}
