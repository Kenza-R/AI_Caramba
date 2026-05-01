"""
Disk-based cache for completed analyses.
Results are stored as backend/cache/{handle}.json and survive server restarts.
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path

CACHE_DIR = Path(__file__).parent / "cache"
CACHE_DIR.mkdir(exist_ok=True)


def _path(handle: str) -> Path:
    return CACHE_DIR / f"{handle.lower().lstrip('@')}.json"


def save(handle: str, figure: dict) -> None:
    data = {"figure": figure, "cached_at": datetime.now(timezone.utc).isoformat()}
    _path(handle).write_text(json.dumps(data, indent=2))


def load(handle: str) -> dict | None:
    p = _path(handle)
    if not p.exists():
        return None
    try:
        data = json.loads(p.read_text())
        return data.get("figure")
    except Exception:
        return None


def list_cached() -> list[dict]:
    """Return all cached figures (for the homepage featured list)."""
    results = []
    for p in sorted(CACHE_DIR.glob("*.json")):
        try:
            data = json.loads(p.read_text())
            if "figure" in data:
                results.append(data["figure"])
        except Exception:
            pass
    return results


def delete(handle: str) -> bool:
    p = _path(handle)
    if p.exists():
        p.unlink()
        return True
    return False
