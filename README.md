# AI Caramba — Mind Shift Lens

Mind Shift Lens is a multi-agent analysis app that tracks how a public figure's messaging shifts over time.

It ingests post corpora (live scrape or CSV import), classifies stance by topic, detects anomalous shifts from baselines, correlates shifts to news windows, and renders an interactive dossier UI.

---

## What This Repository Contains

This repository currently includes multiple app/workbench folders:

- `who-changed-app/` - main app used in this project (Node/Express API + React frontend)
- `backend/` - alternative FastAPI backend prototype
- `mind-shift-lens-ref/` - standalone frontend reference scaffold
- `stance_watch/` - Python research tooling used to prototype scraping/normalization patterns

If you are trying to run the project end-to-end, start with **`who-changed-app/`**.

---

## Quick Start (Main App)

### 1) Prerequisites

- Node.js 18+ (recommended: Node 20)
- npm
- macOS/Linux/WSL recommended

### 2) Install

```bash
cd who-changed-app
npm run install:all
```

### 3) Configure Environment

Create `who-changed-app/server/.env` from `who-changed-app/server/.env.example` and set your keys.

Minimum required for full analysis:

- One LLM key:
  - `LAVA_API_KEY` **or**
  - `ANTHROPIC_API_KEY` **or**
  - `GEMINI_API_KEY`

Optional but recommended:

- `NEWSAPI_KEY` (news correlation)
- `SERPER_API_KEY` or `BRAVE_API_KEY` (web-search fallback for news retrieval)
- `TWITTER_BEARER_TOKEN` (profile enrichment)
- `XTIMELINE_CURL_PATH` (authenticated X timeline request source)

### 4) Run

```bash
npm run dev
```

This starts:

- API server: `http://127.0.0.1:3001`
- Frontend: `http://localhost:5173`

---

## How To Use The App

1. Open the homepage.
2. Search/select a profile.
3. Click **Search Info + Analyze**.
4. Wait for pipeline completion.
5. Open the dossier from dashboard cards.

The dossier includes:

- Spectrum movement
- Topic stance grid
- Shift timeline (flagged events, evidence, baseline deltas)
- Summary narrative

---

## Importing TwExportly CSV Data

You can run analysis directly from CSV exports and save results into the live app DB/dashboard:

```bash
cd who-changed-app/server
npm run analyze:csv -- "../../../TwExportly_hasanthehun_tweets_2026_04_30.csv" hasanthehun
```

Notes:

- The script both analyzes and persists:
  - tweets table
  - corpus metadata
  - dossier analysis payload
- Once saved, profiles appear on dashboard and are clickable like normal analyzed profiles.

Script path:

- `who-changed-app/server/tools/analyzeCsvParallel.js`

---

## Pipeline Overview

Main runtime pipeline (`who-changed-app/server/pipeline.js`):

1. **Scraper Agent**
   - Loads cached corpus or fetches source posts
2. **Classifier Agent**
   - Computes per-window topic scores
   - Enforces minimum evidence per topic/window
   - Establishes topic baselines from earliest valid evidence
3. **Shift Detector Agent**
   - Flags anomalous baseline-relative shifts (z-score + threshold logic)
4. **Context Agent (News Correlation)**
   - Attempts date/entity/topic query variants
   - Uses NewsAPI + GDELT + web-search fallback
   - Produces `news_context` per shift
5. **Narrator Agent**
   - Generates final synthesis and confidence

Output is stored in SQLite (`who-changed-app/server/data/app.db`) and served through API endpoints.

---

## Key Endpoints (Main App)

- `GET /api/health`
- `GET /api/profile-search?q=...`
- `POST /api/analyze` (SSE progress stream)
- `GET /api/figures` (dashboard cards)
- `GET /api/figure/:handle` (full dossier payload)
- `POST /api/scrape-export` (corpus scrape + CSV prep)
- `GET /api/export/:handle.csv`

---

## Troubleshooting

### 1) Profile not appearing on dashboard

- Confirm analysis saved:
  - `GET /api/figures`
- Re-run CSV import with explicit handle:
  - `npm run analyze:csv -- "<path>.csv" <handle>`

### 2) No or weak news correlation

- Ensure at least one provider key exists:
  - `NEWSAPI_KEY`, `SERPER_API_KEY`, or `BRAVE_API_KEY`
- Newer context agent logic now tries:
  - person+topic+date
  - person+topic+year
  - entity+topic
  - topic-only fallback
- If no headlines still found, UI shows a correlation note and match context metadata.

### 3) X scraping returns too few posts

- Refresh authenticated request source (`curl.txt`)
- Check `XTIMELINE_CURL_PATH`
- Raise `ANALYSIS_MAX_POSTS` if needed

### 4) Port already in use

- API default port: `3001`
- UI default port: `5173`
- Stop old dev processes and restart `npm run dev`

---

## Development Notes

- Frontend: `who-changed-app/client`
- Backend: `who-changed-app/server`
- SQLite DB: `who-changed-app/server/data/app.db`
- Shift timeline UI: `who-changed-app/client/src/components/ShiftTimeline.tsx`
- News correlation agent: `who-changed-app/server/agents/contextAgent.js`

---

## Security Notes

Do **not** commit local auth/session files such as:

- `who-changed-app/server/curl.txt`
- `who-changed-app/server/.x-session/`
- real API keys in `.env`

Use `.env.example` as template and keep secrets local.

