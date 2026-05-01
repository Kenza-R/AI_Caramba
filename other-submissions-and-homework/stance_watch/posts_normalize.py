"""
Build outputs/posts.json from:
  - scrape_manifest.json (timeline_text_snippets → synthetic post records), and/or
  - an existing JSON/JSONL file of posts you provide.

Each post: id, iso_date (optional), text, source (scrape|import|manual), raw_ref (optional).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from stance_project import StanceWatchProject


def _stable_id(text: str, idx: int) -> str:
    h = hashlib.sha256(f"{idx}:{text[:200]}".encode()).hexdigest()[:16]
    return f"p_{h}"


def load_posts_file(path: Path) -> list[dict[str, Any]]:
    suf = path.suffix.lower()
    if suf == ".jsonl":
        rows: list[dict[str, Any]] = []
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
        return rows
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]
    if isinstance(data, dict) and isinstance(data.get("posts"), list):
        return [x for x in data["posts"] if isinstance(x, dict)]
    raise ValueError(f"Unsupported JSON shape in {path}")


def normalize_post(raw: dict[str, Any], idx: int, source: str) -> dict[str, Any]:
    text = (raw.get("text") or raw.get("body") or raw.get("content") or "").strip()
    if not text:
        raise ValueError(f"Post {idx} missing text")
    pid = str(raw.get("id") or raw.get("post_id") or _stable_id(text, idx))
    iso = raw.get("iso_date") or raw.get("date") or raw.get("timestamp")
    if iso is not None and not isinstance(iso, str):
        iso = str(iso)
    return {
        "id": pid,
        "iso_date": iso,
        "text": text,
        "source": raw.get("source") or source,
        "raw_ref": raw.get("url") or raw.get("link"),
    }


def snippets_from_manifest(manifest: dict[str, Any]) -> list[dict[str, Any]]:
    snippets = manifest.get("timeline_text_snippets") or []
    if not isinstance(snippets, list):
        return []
    out: list[dict[str, Any]] = []
    for i, s in enumerate(snippets):
        if not isinstance(s, str) or not s.strip():
            continue
        out.append(
            {
                "id": _stable_id(s, i),
                "iso_date": None,
                "text": s.strip(),
                "source": "scrape",
                "raw_ref": manifest.get("final_url") or manifest.get("requested_url"),
            }
        )
    return out


def merge_posts(*groups: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    merged: list[dict[str, Any]] = []
    for g in groups:
        for p in g:
            key = p["id"]
            if key in seen:
                continue
            seen.add(key)
            merged.append(p)
    return merged


def main() -> None:
    ap = argparse.ArgumentParser(description="Merge scrape manifest + imports into outputs/posts.json")
    ap.add_argument("--project", type=Path, required=True, help="StanceWatch project path")
    ap.add_argument(
        "--manifest",
        type=Path,
        default=None,
        help="scrape_manifest.json (default: <project>/outputs/scrape_manifest.json)",
    )
    ap.add_argument(
        "--import-file",
        type=Path,
        action="append",
        default=[],
        help="JSON array or JSONL of posts (repeatable)",
    )
    ap.add_argument(
        "-o",
        "--out",
        type=Path,
        default=None,
        help="Output path (default: <project>/outputs/posts.json)",
    )
    args = ap.parse_args()

    proj = StanceWatchProject.from_path(args.project)
    proj.ensure_layout()
    manifest_path = (args.manifest or proj.scrape_manifest_json).resolve()

    groups: list[list[dict[str, Any]]] = []
    if manifest_path.is_file():
        man = json.loads(manifest_path.read_text(encoding="utf-8"))
        groups.append(snippets_from_manifest(man))
    for imp in args.import_file:
        loaded = load_posts_file(imp.resolve())
        groups.append([normalize_post(x, i, "import") for i, x in enumerate(loaded)])

    if not groups:
        print("No inputs: add --import-file or create scrape_manifest.json", file=sys.stderr)
        raise SystemExit(1)

    posts = merge_posts(*groups)
    if not posts:
        print("No posts after merge.", file=sys.stderr)
        raise SystemExit(1)

    # Sort: dated first (ISO string sort works for YYYY-MM-DD), then undated at end
    def sort_key(p: dict[str, Any]) -> tuple[int, str]:
        d = p.get("iso_date")
        if d:
            return (0, d)
        return (1, p["id"])

    posts.sort(key=sort_key)

    out_path = (args.out or proj.posts_json).resolve()
    payload = {
        "meta": {
            "built_at_utc": datetime.now(timezone.utc).isoformat(),
            "count": len(posts),
            "manifest_used": manifest_path.is_file(),
            "import_files": [str(p) for p in args.import_file],
        },
        "posts": posts,
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {out_path} ({len(posts)} posts)", file=sys.stderr)


if __name__ == "__main__":
    main()
