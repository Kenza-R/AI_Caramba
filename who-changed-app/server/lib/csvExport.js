function csvCell(value) {
  const s = String(value ?? "");
  const escaped = s.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function tweetsToCsv(rows, handle) {
  const safeHandle = String(handle || "").replace(/^@/, "").toLowerCase();
  const headers = [
    "id",
    "handle",
    "text",
    "created_at",
    "likes",
    "retweets",
    "replies",
    "url",
  ];
  const lines = [headers.join(",")];

  for (const row of rows || []) {
    const id = String(row?.id || "");
    const url =
      /^\d+$/.test(id) && safeHandle
        ? `https://x.com/${safeHandle}/status/${id}`
        : "";
    lines.push(
      [
        csvCell(id),
        csvCell(safeHandle),
        csvCell(row?.tweet_text || ""),
        csvCell(row?.created_at || ""),
        csvCell(row?.likes ?? 0),
        csvCell(row?.retweets ?? 0),
        csvCell(row?.replies ?? 0),
        csvCell(url),
      ].join(","),
    );
  }
  return lines.join("\n");
}

