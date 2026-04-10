import Database from "better-sqlite3";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "..", "data");
mkdirSync(dataDir, { recursive: true });
const dbPath = join(dataDir, "app.db");

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS analyses (
    handle TEXT PRIMARY KEY COLLATE NOCASE,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tweets (
    id TEXT PRIMARY KEY,
    handle TEXT NOT NULL COLLATE NOCASE,
    tweet_text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    likes INTEGER DEFAULT 0,
    retweets INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_tweets_handle ON tweets(handle);

  CREATE TABLE IF NOT EXISTS featured (
    sort_order INTEGER PRIMARY KEY,
    handle TEXT NOT NULL COLLATE NOCASE UNIQUE
  );

  CREATE TABLE IF NOT EXISTS corpus_meta (
    handle TEXT PRIMARY KEY COLLATE NOCASE,
    source TEXT NOT NULL,
    tweet_count INTEGER NOT NULL,
    oldest_at TEXT,
    newest_at TEXT,
    updated_at INTEGER NOT NULL
  );
`);

try {
  db.prepare(
    `
    INSERT INTO corpus_meta (handle, source, tweet_count, oldest_at, newest_at, updated_at)
    SELECT
      handle,
      'legacy_import',
      COUNT(*),
      MIN(created_at),
      MAX(created_at),
      CAST(strftime('%s','now') AS INTEGER) * 1000
    FROM tweets
    WHERE NOT EXISTS (SELECT 1 FROM corpus_meta c WHERE c.handle = tweets.handle COLLATE NOCASE)
    GROUP BY handle
  `,
  ).run();
} catch {
  // ignore if tweets empty or schema edge cases
}

export function getAnalysis(handle) {
  const row = db
    .prepare("SELECT data, updated_at FROM analyses WHERE handle = ? COLLATE NOCASE")
    .get(handle);
  if (!row) return null;
  return { ...JSON.parse(row.data), cachedAt: row.updated_at };
}

export function saveAnalysis(handle, dataObj) {
  const data = JSON.stringify(dataObj);
  const now = Date.now();
  db.prepare(
    `INSERT INTO analyses (handle, data, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(handle) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
  ).run(handle.toLowerCase(), data, now);
}

export function clearTweetsForHandle(handle) {
  db.prepare("DELETE FROM tweets WHERE handle = ? COLLATE NOCASE").run(handle);
}

export function insertTweet(row) {
  db.prepare(
    `INSERT OR REPLACE INTO tweets (id, handle, tweet_text, created_at, likes, retweets, replies)
     VALUES (@id, @handle, @tweet_text, @created_at, @likes, @retweets, @replies)`
  ).run(row);
}

export function getTweetsForHandle(handle) {
  return db
    .prepare(
      "SELECT id, handle, tweet_text, created_at, likes, retweets, replies FROM tweets WHERE handle = ? COLLATE NOCASE ORDER BY created_at ASC"
    )
    .all(handle);
}

export function getTweetStatsForHandle(handle) {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n, MIN(created_at) AS oldest, MAX(created_at) AS newest
       FROM tweets WHERE handle = ? COLLATE NOCASE`,
    )
    .get(handle);
  return {
    count: row?.n ?? 0,
    oldest: row?.oldest ?? null,
    newest: row?.newest ?? null,
  };
}

/** @param {string} handle @param {{ source: string, tweet_count: number, oldest_at?: string|null, newest_at?: string|null }} meta */
export function saveCorpusMeta(handle, meta) {
  const now = Date.now();
  const h = handle.toLowerCase();
  db.prepare(
    `INSERT INTO corpus_meta (handle, source, tweet_count, oldest_at, newest_at, updated_at)
     VALUES (@handle, @source, @tweet_count, @oldest_at, @newest_at, @updated_at)
     ON CONFLICT(handle) DO UPDATE SET
       source = excluded.source,
       tweet_count = excluded.tweet_count,
       oldest_at = excluded.oldest_at,
       newest_at = excluded.newest_at,
       updated_at = excluded.updated_at`,
  ).run({
    handle: h,
    source: meta.source,
    tweet_count: meta.tweet_count,
    oldest_at: meta.oldest_at ?? null,
    newest_at: meta.newest_at ?? null,
    updated_at: now,
  });
}

export function getCorpusMeta(handle) {
  return db
    .prepare("SELECT * FROM corpus_meta WHERE handle = ? COLLATE NOCASE")
    .get(handle.toLowerCase());
}

/**
 * All completed analyses as lightweight dashboard rows (newest first).
 * @returns {Array<{ handle: string, updated_at: number, data: object }>}
 */
export function listAllAnalyses() {
  return db
    .prepare("SELECT handle, data, updated_at FROM analyses ORDER BY updated_at DESC")
    .all()
    .map((row) => ({
      handle: row.handle,
      updated_at: row.updated_at,
      data: JSON.parse(row.data),
    }));
}

export function getFeaturedHandles() {
  const rows = db.prepare("SELECT handle FROM featured ORDER BY sort_order ASC").all();
  return rows.map((r) => r.handle);
}

export function setFeaturedHandles(handles) {
  const del = db.prepare("DELETE FROM featured");
  const ins = db.prepare("INSERT INTO featured (sort_order, handle) VALUES (?, ?)");
  db.transaction(() => {
    del.run();
    handles.forEach((h, i) => ins.run(i, h.toLowerCase()));
  })();
}

export { db };
