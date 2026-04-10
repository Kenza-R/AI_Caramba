/**
 * Live web search for archive discovery (Serper or Brave). Reuses patterns from course marketing_agent (Google-style hits).
 */

async function serperSearch(q) {
  const key = process.env.SERPER_API_KEY;
  if (!key) return null;
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({ q, num: 10 }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const organic = data.organic || [];
  return organic.map((o) => ({ title: o.title || "", link: o.link || "", snippet: o.snippet || "" }));
}

async function braveSearch(q) {
  const key = process.env.BRAVE_API_KEY;
  if (!key) return null;
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=10`;
  const res = await fetch(url, {
    headers: { "X-Subscription-Token": key, Accept: "application/json" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const results = data.web?.results || [];
  return results.map((o) => ({
    title: o.title || "",
    link: o.url || "",
    snippet: o.description || "",
  }));
}

/**
 * @returns {Promise<Array<{title:string,link:string,snippet:string}>>}
 */
export async function searchWeb(query) {
  const s = await serperSearch(query);
  if (s?.length) return s;
  const b = await braveSearch(query);
  if (b?.length) return b;
  return [];
}

export function buildArchiveQueries(handle) {
  const h = handle.replace(/^@/, "");
  return [
    `"@${h}" twitter archive CSV JSON download site:tweetbinder.com OR site:tweetosaurus.com`,
    `"@${h}" twitter export scrape twstalker tinfoleak`,
    `"${h}" tweets archive "Dataverse" OR "Harvard" filetype:csv`,
    `"${h}" Truth Social archive OR export OR scraper`,
  ];
}
