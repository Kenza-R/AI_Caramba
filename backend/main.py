import asyncio
import uuid
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import cache as analysis_cache
from models import AnalysisJob, Figure
from scraper import fetch_user_tweets, get_user_info, resolve_handle

app = FastAPI(title="Mind Shift Lens API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory job store (persists for the life of the process)
_jobs: dict[str, dict] = {}


class AnalyzeRequest(BaseModel):
    handle: str
    limit: int = 3000


@app.post("/api/analyze", response_model=dict)
async def start_analysis(req: AnalyzeRequest):
    handle = await resolve_handle(req.handle)
    if not handle:
        raise HTTPException(400, "Handle cannot be empty")

    # Return cached result immediately — no need to re-scrape
    cached = analysis_cache.load(handle)
    if cached:
        job_id = str(uuid.uuid4())
        _jobs[job_id] = {
            "job_id": job_id,
            "status": "done",
            "step": 4,
            "tweet_count": cached.get("_tweet_count", 0),
            "result": cached,
            "error": None,
            "handle": handle,
        }
        return {"job_id": job_id, "cached": True}

    job_id = str(uuid.uuid4())
    _jobs[job_id] = {
        "job_id": job_id,
        "status": "queued",
        "step": 0,
        "tweet_count": 0,
        "result": None,
        "error": None,
        "handle": handle,
    }

    asyncio.create_task(_run_analysis(job_id, handle, req.limit))
    return {"job_id": job_id, "cached": False}


@app.post("/api/reanalyze", response_model=dict)
async def reanalyze(req: AnalyzeRequest):
    """Force a fresh analysis, ignoring the cache."""
    handle = await resolve_handle(req.handle)
    if not handle:
        raise HTTPException(400, "Handle cannot be empty")

    analysis_cache.delete(handle)

    job_id = str(uuid.uuid4())
    _jobs[job_id] = {
        "job_id": job_id,
        "status": "queued",
        "step": 0,
        "tweet_count": 0,
        "result": None,
        "error": None,
        "handle": handle,
    }

    asyncio.create_task(_run_analysis(job_id, handle, req.limit))
    return {"job_id": job_id, "cached": False}


@app.get("/api/status/{job_id}")
async def get_status(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job


@app.get("/api/figure/{handle}")
async def get_figure(handle: str):
    """Return a cached figure by handle — used by Dossier on page reload."""
    handle = handle.lstrip("@").lower()
    figure = analysis_cache.load(handle)
    if figure:
        return figure
    # Also check in-memory jobs
    for job in _jobs.values():
        if job.get("handle", "").lower() == handle and job.get("status") == "done" and job.get("result"):
            return job["result"]
    raise HTTPException(404, "No completed analysis for this handle")


@app.get("/api/cached")
async def list_cached():
    """Return all cached analyses — for the homepage featured figures."""
    return analysis_cache.list_cached()


@app.get("/api/health")
async def health():
    return {"ok": True}


async def _run_analysis(job_id: str, handle: str, limit: int) -> None:
    job = _jobs[job_id]
    try:
        # ── Step 1: Resolve profile ───────────────────────────────────────
        job["status"] = "scraping"
        job["step"] = 1
        user_info = await get_user_info(handle)

        # ── Step 2: Fetch tweets (streams count in real time) ─────────────
        job["step"] = 2

        def on_progress(n: int):
            job["tweet_count"] = n

        tweets = await fetch_user_tweets(handle, limit=limit, on_progress=on_progress)
        job["tweet_count"] = len(tweets)

        if len(tweets) == 0:
            raise ValueError(f"No tweets found for @{handle}")

        # ── Step 3: AI analysis ───────────────────────────────────────────
        job["status"] = "analyzing"
        job["step"] = 3

        from analyzer import analyze_tweets
        figure = await asyncio.to_thread(analyze_tweets, handle, user_info, tweets)

        # ── Done — save to disk cache ─────────────────────────────────────
        result = figure.model_dump()
        result["_tweet_count"] = len(tweets)  # store for display on re-load
        analysis_cache.save(handle, result)

        job["status"] = "done"
        job["step"] = 4
        job["result"] = result

    except Exception as exc:
        job["status"] = "error"
        job["error"] = str(exc)
