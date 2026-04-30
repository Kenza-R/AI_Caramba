import asyncio
import uuid
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

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
    """Start an async analysis job. Returns job_id immediately."""
    handle = await resolve_handle(req.handle)
    if not handle:
        raise HTTPException(400, "Handle cannot be empty")

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
    return {"job_id": job_id}


@app.get("/api/status/{job_id}")
async def get_status(job_id: str):
    """Poll job status. Returns full Figure in result field when done."""
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job


@app.get("/api/figure/{handle}")
async def get_figure(handle: str):
    """
    Return the cached analysis result for a handle if one exists,
    so Dossier can refetch after a page reload.
    """
    handle = handle.lstrip("@").lower()
    for job in _jobs.values():
        if (
            job.get("handle", "").lower() == handle
            and job.get("status") == "done"
            and job.get("result")
        ):
            return job["result"]
    raise HTTPException(404, "No completed analysis for this handle")


async def _run_analysis(job_id: str, handle: str, limit: int) -> None:
    job = _jobs[job_id]
    try:
        # ── Step 1: Resolve user profile ──────────────────────────────────
        job["status"] = "scraping"
        job["step"] = 1

        user_info = await get_user_info(handle)

        # ── Step 2: Fetch tweets ──────────────────────────────────────────
        job["step"] = 2
        tweets = await fetch_user_tweets(handle, limit=limit)
        job["tweet_count"] = len(tweets)

        if len(tweets) == 0:
            raise ValueError(f"No tweets found for @{handle}")

        # ── Step 3: AI analysis ───────────────────────────────────────────
        job["status"] = "analyzing"
        job["step"] = 3

        # Import here to avoid circular at module load time
        from analyzer import analyze_tweets

        figure = await asyncio.to_thread(analyze_tweets, handle, user_info, tweets)

        # ── Done ──────────────────────────────────────────────────────────
        job["status"] = "done"
        job["step"] = 4
        job["result"] = figure.model_dump()

    except Exception as exc:
        job["status"] = "error"
        job["error"] = str(exc)


@app.get("/api/health")
async def health():
    return {"ok": True}
