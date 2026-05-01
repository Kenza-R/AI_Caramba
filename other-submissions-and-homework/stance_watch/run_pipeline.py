"""
Run stance-watch stages in order (no scrape here — run social_profile_scrape.py separately).

  python run_pipeline.py --project projects/demo_voice normalize detect
  python run_pipeline.py --project projects/demo_voice normalize detect news

Subcommands:
  normalize  — posts_normalize.py
  detect     — stance_detect.py
  news       — news_context_agent.py (requires API key)
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def run(cmd: list[str]) -> None:
    print("+", " ".join(cmd), file=sys.stderr, flush=True)
    r = subprocess.run(cmd, cwd=str(ROOT))
    if r.returncode != 0:
        raise SystemExit(r.returncode)


def main() -> None:
    ap = argparse.ArgumentParser(description="Stance watch pipeline driver")
    ap.add_argument("--project", type=Path, required=True, help="Project folder under stance_watch/")
    ap.add_argument(
        "stages",
        nargs="+",
        choices=("normalize", "detect", "news"),
        help="Stages to run in order",
    )
    ap.add_argument("--method", choices=("tfidf", "gemini"), default="tfidf", help="For detect stage")
    ap.add_argument("--window", type=int, default=20)
    ap.add_argument("--import-file", type=Path, action="append", default=[], help="Passed to normalize")
    ap.add_argument("--max-briefs", type=int, default=5, help="For news stage")
    ap.add_argument("--resume-news", action="store_true")
    args = ap.parse_args()

    proj = args.project.resolve() if args.project.is_absolute() else (ROOT / args.project).resolve()

    for stage in args.stages:
        if stage == "normalize":
            cmd = [sys.executable, str(ROOT / "posts_normalize.py"), "--project", str(proj)]
            for f in args.import_file:
                cmd.extend(["--import-file", str(f.resolve())])
            run(cmd)
        elif stage == "detect":
            run(
                [
                    sys.executable,
                    str(ROOT / "stance_detect.py"),
                    "--project",
                    str(proj),
                    "--method",
                    args.method,
                    "--window",
                    str(args.window),
                ]
            )
        elif stage == "news":
            cmd = [
                sys.executable,
                str(ROOT / "news_context_agent.py"),
                "--project",
                str(proj),
                "--max-events",
                str(args.max_briefs),
            ]
            if args.resume_news:
                cmd.append("--resume")
            run(cmd)


if __name__ == "__main__":
    main()
