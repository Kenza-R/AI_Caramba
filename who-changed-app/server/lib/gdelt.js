/**
 * GDELT DOC2.0 API — no key required for many endpoints.
 * @see https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/
 */

function toGdeltDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

/**
 * @returns {Promise<Array<{title:string,source:string,publishedAt:string,url:string}>>}
 */
export async function fetchGdeltHeadlines(query, fromIso, toIso) {
  const start = toGdeltDate(fromIso);
  const end = toGdeltDate(toIso);
  if (!start || !end) return [];
  const q = encodeURIComponent(query.replace(/_/g, " ").slice(0, 300));
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=ArtList&format=json&maxrecords=15&startdatetime=${start}&enddatetime=${end}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  const data = await res.json();
  const arts = data.articles || data.artList || data.docs || [];
  return arts.map((a) => ({
    title: a.title || a.seendoc || "",
    source: a.domain || a.source || "",
    publishedAt: a.seendate ? String(a.seendate) : "",
    url: a.url || "",
  }));
}
