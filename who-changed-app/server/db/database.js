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
`);

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
