<p align="center">
  <img src="./logo.png" alt="Mind Shift Lens Logo" width="220" />
</p>

<h1 align="center">AI Caramba — Mind Shift Lens</h1>
<p align="center"><em>Track ideological drift from public posts, detect anomalous shifts, and explain them with evidence + news context.</em></p>

<p align="center">
  <img alt="Node" src="https://img.shields.io/badge/Node-18%2B-339933?logo=node.js&logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB?logo=react&logoColor=0B0F19" />
  <img alt="Express" src="https://img.shields.io/badge/API-Express-000000?logo=express&logoColor=white" />
  <img alt="SQLite" src="https://img.shields.io/badge/DB-SQLite-003B57?logo=sqlite&logoColor=white" />
  <img alt="License" src="https://img.shields.io/badge/License-Private-blue" />
</p>

---

## Table of Contents

- [Overview](#overview)
- [Repository Layout](#repository-layout)
- [Quick Start (Main App)](#quick-start-main-app)
- [Configuration](#configuration)
- [How to Use](#how-to-use)
- [Importing TwExportly CSV Data](#importing-twexportly-csv-data)
- [Architecture and Pipeline](#architecture-and-pipeline)
- [API Endpoints](#api-endpoints)
- [Troubleshooting](#troubleshooting)
- [Development Notes](#development-notes)
- [Security Notes](#security-notes)

---

## Overview

Mind Shift Lens is a multi-agent analysis app that:

1. ingests post corpora (scraped or imported),
2. scores stance by topic over time windows,
3. flags anomalous shifts from baseline,
4. correlates flagged shifts with date/entity/topic-based news retrieval,
5. renders an interactive dossier UI with evidence.

---

## Repository Layout

This repo includes multiple work areas. For end-to-end use, start with `who-changed-app`.

- `who-changed-app/` - **main app** (Express API + React frontend)
- `backend/` - alternative FastAPI prototype
- `mind-shift-lens-ref/` - frontend reference scaffold
- `stance_watch/` - Python research tooling

---

## Quick Start (Main App)

### Prerequisites

- Node.js 18+ (Node 20 recommended)
- npm
- macOS/Linux/WSL recommended

### Install

```bash
cd who-changed-app
npm run install:all
```

### Run

```bash
npm run dev
```

After startup:

- API: `http://127.0.0.1:3001`
- UI: `http://localhost:5173`

---

## Configuration

Copy:

- `who-changed-app/server/.env.example` -> `who-changed-app/server/.env`

### Minimum required

At least one LLM key:

- `LAVA_API_KEY` **or**
- `ANTHROPIC_API_KEY` **or**
- `GEMINI_API_KEY`

### Recommended (improves quality)

- `NEWSAPI_KEY` (primary event headlines)
- `SERPER_API_KEY` or `BRAVE_API_KEY` (web-search fallback)
- `TWITTER_BEARER_TOKEN` (profile enrichment)
- `XTIMELINE_CURL_PATH` (authenticated X timeline request source)

---

## How to Use

1. Open the homepage.
2. Search/select a profile.
3. Click **Search Info + Analyze**.
4. Wait for pipeline completion.
5. Click the profile card to open the dossier.

Dossier sections include:

- spectrum movement,
- issue stance analysis,
- shift timeline (flagged events, tweet evidence, baseline deltas),
- analyst summary.

---

## Importing TwExportly CSV Data

You can analyze CSV exports and persist them directly to dashboard/dossiers:

```bash
cd who-changed-app/server
npm run analyze:csv -- "../../../TwExportly_hasanthehun_tweets_2026_04_30.csv" hasanthehun
```

The importer:

- parses/normalizes CSV rows,
- runs full analysis pipeline,
- saves tweets + corpus metadata + dossier payload to SQLite,
- makes profile visible as a clickable dashboard card.

Script:

- `who-changed-app/server/tools/analyzeCsvParallel.js`

---

## Architecture and Pipeline

Main runtime pipeline: `who-changed-app/server/pipeline.js`

1. **Scraper Agent**
   - loads cached corpus or fetches source posts
2. **Classifier Agent**
   - computes topic scores per time window
   - enforces minimum topic/window evidence
   - establishes topic baselines from earliest valid evidence
3. **Shift Detector Agent**
   - detects baseline-relative anomalies (z-score + threshold logic)
4. **Context Agent (News Correlation)**
   - tries date/entity/topic query variants
   - uses NewsAPI + GDELT + web-search fallback
   - returns `news_context` per shift with diagnostics metadata
5. **Narrator Agent**
   - produces final synthesis and confidence

Data is stored in:

- `who-changed-app/server/data/app.db`

---

## API Endpoints

- `GET /api/health`
- `GET /api/profile-search?q=...`
- `POST /api/analyze` (SSE progress stream)
- `GET /api/figures`
- `GET /api/figure/:handle`
- `POST /api/scrape-export`
- `GET /api/export/:handle.csv`

---

## Troubleshooting

### Profile does not appear on dashboard

- Check: `GET /api/figures`
- Re-import/re-analyze:
  - `npm run analyze:csv -- "<path>.csv" <handle>`

### News correlation is weak or empty

- Ensure at least one provider key is set:
  - `NEWSAPI_KEY`, `SERPER_API_KEY`, or `BRAVE_API_KEY`
- The context agent attempts:
  - person+topic+date
  - person+topic+year
  - entity+topic
  - topic-only fallback
- If still empty, UI now shows correlation notes and match context metadata.

### X scrape returns too few posts

- refresh authenticated request source (`curl.txt`)
- verify `XTIMELINE_CURL_PATH`
- increase `ANALYSIS_MAX_POSTS` if needed

### Port already in use

- API: `3001`
- UI: `5173`
- stop stale dev processes, then rerun `npm run dev`

---

## Development Notes

- Frontend: `who-changed-app/client`
- Backend: `who-changed-app/server`
- DB: `who-changed-app/server/data/app.db`
- Timeline UI: `who-changed-app/client/src/components/ShiftTimeline.tsx`
- News correlation: `who-changed-app/server/agents/contextAgent.js`

---

## Security Notes

Do **not** commit local auth/session or raw secret files:

- `who-changed-app/server/curl.txt`
- `who-changed-app/server/.x-session/`
- real API keys in `.env`

Use `.env.example` as template and keep secrets local.

