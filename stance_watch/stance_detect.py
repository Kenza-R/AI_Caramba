"""
Compute per-post distance from a rolling baseline (TF-IDF or Gemini embeddings), z-score,
and emit shift_events.json (local maxima above threshold).

Requires posts.json from posts_normalize.py.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
from dotenv import load_dotenv
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import normalize

from stance_project import StanceWatchProject

load_dotenv()


def _resolve_gemini_key() -> str | None:
    return os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")


def embed_tfidf(texts: list[str]) -> np.ndarray:
    vec = TfidfVectorizer(
        max_features=8192,
        ngram_range=(1, 2),
        min_df=1,
        max_df=0.95,
        sublinear_tf=True,
    )
    X = vec.fit_transform(texts)
    X = X.toarray().astype(np.float64)
    normalize(X, norm="l2", copy=False)
    return X


def embed_gemini(texts: list[str], *, model_id: str = "models/text-embedding-004") -> np.ndarray:
    import google.generativeai as genai

    key = _resolve_gemini_key()
    if not key:
        raise RuntimeError("Set GOOGLE_API_KEY or GEMINI_API_KEY for --method gemini")
    genai.configure(api_key=key)
    rows: list[list[float]] = []
    for i, t in enumerate(texts):
        t = (t or "").strip()[:8000]
        if not t:
            rows.append([0.0] * 768)
            continue
        r = genai.embed_content(model=model_id, content=t, task_type="retrieval_document")
        emb = r.get("embedding") if isinstance(r, dict) else getattr(r, "embedding", None)
        if not emb:
            raise RuntimeError(f"No embedding for index {i}")
        rows.append(list(emb))
        if (i + 1) % 32 == 0:
            time.sleep(0.2)
    X = np.array(rows, dtype=np.float64)
    normalize(X, norm="l2", copy=False)
    return X


def rolling_distance(X: np.ndarray, window: int) -> np.ndarray:
    """Per index i, distance = 1 - cos(sim) between X[i] and mean(X[i-window:i])."""
    n = X.shape[0]
    dist = np.zeros(n, dtype=np.float64)
    dist[:window] = np.nan
    for i in range(window, n):
        baseline = X[i - window : i].mean(axis=0, keepdims=True)
        normalize(baseline, norm="l2", copy=False)
        sim = cosine_similarity(X[i : i + 1], baseline)[0, 0]
        dist[i] = float(1.0 - np.clip(sim, -1.0, 1.0))
    return dist


def zscores(x: np.ndarray) -> np.ndarray:
    valid = np.isfinite(x)
    mu = float(np.nanmean(x[valid]))
    sigma = float(np.nanstd(x[valid]))
    if sigma < 1e-9:
        return np.zeros_like(x)
    return (x - mu) / sigma


def pick_peaks(z: np.ndarray, dist: np.ndarray, min_gap: int, z_threshold: float) -> list[int]:
    n = len(z)
    peaks: list[int] = []
    for i in range(1, n - 1):
        if not np.isfinite(z[i]):
            continue
        if z[i] < z_threshold:
            continue
        if z[i] < z[i - 1] or z[i] < z[i + 1]:
            continue
        if peaks and i - peaks[-1] < min_gap:
            if z[i] > z[peaks[-1]]:
                peaks[-1] = i
            continue
        peaks.append(i)
    return peaks


def merge_posts_for_series(posts: list[dict[str, Any]], dist: np.ndarray, z: np.ndarray) -> list[dict[str, Any]]:
    series: list[dict[str, Any]] = []
    for i, p in enumerate(posts):
        series.append(
            {
                "id": p["id"],
                "iso_date": p.get("iso_date"),
                "text_preview": (p.get("text") or "")[:240],
                "distance_from_rolling_baseline": float(dist[i]) if np.isfinite(dist[i]) else None,
                "z_score": float(z[i]) if np.isfinite(z[i]) else None,
            }
        )
    return series


def build_shift_events(
    posts: list[dict[str, Any]],
    peak_indices: list[int],
    dist: np.ndarray,
    z: np.ndarray,
) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    for rank, i in enumerate(peak_indices):
        p = posts[i]
        events.append(
            {
                "rank": rank + 1,
                "post_index": i,
                "post_id": p["id"],
                "iso_date": p.get("iso_date"),
                "z_score": float(z[i]),
                "distance": float(dist[i]),
                "exemplar_text": (p.get("text") or "")[:800],
                "note": "Rhetorical shift vs rolling baseline — not proof of belief change or motive.",
            }
        )
    return events


def main() -> None:
    ap = argparse.ArgumentParser(description="Rolling baseline stance distance + shift peaks")
    ap.add_argument("--project", type=Path, required=True)
    ap.add_argument("--posts", type=Path, default=None, help="Default: <project>/outputs/posts.json")
    ap.add_argument("--method", choices=("tfidf", "gemini"), default="tfidf")
    ap.add_argument("--window", type=int, default=20, help="Prior posts in rolling baseline (min 3)")
    ap.add_argument("--z-threshold", type=float, default=2.0, help="Peak detection z minimum")
    ap.add_argument("--min-gap", type=int, default=5, help="Minimum posts between peaks")
    args = ap.parse_args()

    proj = StanceWatchProject.from_path(args.project)
    posts_path = (args.posts or proj.posts_json).resolve()
    if not posts_path.is_file():
        print(f"Missing {posts_path}", file=sys.stderr)
        raise SystemExit(1)

    data = json.loads(posts_path.read_text(encoding="utf-8"))
    posts = data.get("posts") if isinstance(data, dict) else data
    if not isinstance(posts, list) or not posts:
        print("No posts in file.", file=sys.stderr)
        raise SystemExit(1)

    texts = [str(p.get("text") or "") for p in posts]
    window = max(3, min(args.window, len(posts) - 1))

    if args.method == "tfidf":
        X = embed_tfidf(texts)
    else:
        X = embed_gemini(texts)

    dist = rolling_distance(X, window)
    z = zscores(dist)
    peaks = pick_peaks(z, dist, min_gap=max(1, args.min_gap), z_threshold=args.z_threshold)

    series = merge_posts_for_series(posts, dist, z)
    events = build_shift_events(posts, peaks, dist, z)

    meta = {
        "built_at_utc": datetime.now(timezone.utc).isoformat(),
        "method": args.method,
        "window": window,
        "z_threshold": args.z_threshold,
        "min_gap_posts": args.min_gap,
        "n_posts": len(posts),
        "n_peaks": len(peaks),
    }

    proj.ensure_layout()
    proj.stance_series_json.write_text(
        json.dumps({"meta": meta, "series": series}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    proj.shift_events_json.write_text(
        json.dumps({"meta": meta, "shift_events": events}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(
        f"Wrote {proj.stance_series_json} and {proj.shift_events_json} ({len(events)} events)",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
