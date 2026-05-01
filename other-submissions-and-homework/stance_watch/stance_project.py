"""
Per-project paths for the stance-watch pipeline (Python prototype).
The unified browser app for this course/repo lives in ../who-changed-app/ (React + Express + SQLite).

  <project>/
    templates/   — person_profile.json, agent_hints.json (optional)
    outputs/     — scrape_manifest.json, posts.json, stance_series.json, shift_events.json, news_briefs.json
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class StanceWatchProject:
    root: Path

    @classmethod
    def from_path(cls, path: str | Path) -> StanceWatchProject:
        r = Path(path).expanduser().resolve()
        if not r.is_dir():
            raise FileNotFoundError(f"Project directory not found: {r}")
        return cls(root=r)

    @property
    def templates(self) -> Path:
        return self.root / "templates"

    @property
    def outputs(self) -> Path:
        return self.root / "outputs"

    @property
    def person_profile_json(self) -> Path:
        return self.templates / "person_profile.json"

    @property
    def agent_hints_json(self) -> Path:
        return self.templates / "agent_hints.json"

    @property
    def scrape_manifest_json(self) -> Path:
        return self.outputs / "scrape_manifest.json"

    @property
    def posts_json(self) -> Path:
        return self.outputs / "posts.json"

    @property
    def stance_series_json(self) -> Path:
        return self.outputs / "stance_series.json"

    @property
    def shift_events_json(self) -> Path:
        return self.outputs / "shift_events.json"

    @property
    def news_briefs_json(self) -> Path:
        return self.outputs / "news_briefs.json"

    def ensure_layout(self) -> None:
        self.templates.mkdir(parents=True, exist_ok=True)
        self.outputs.mkdir(parents=True, exist_ok=True)
