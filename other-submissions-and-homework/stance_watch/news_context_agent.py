"""
For each shift_event, run Gemini + Google Search grounding (PydanticAI WebSearchTool)
and produce schema-locked news context briefs with citations and caveats.

Reads: templates/person_profile.json, outputs/shift_events.json
Writes: outputs/news_briefs.json (merge / resume by post_id)
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from collections.abc import AsyncIterable
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from pydantic import BaseModel, Field
from pydantic_ai import Agent
from pydantic_ai.builtin_tools import WebSearchTool
from pydantic_ai.messages import (
    BuiltinToolCallPart,
    BuiltinToolReturnPart,
    FinalResultEvent,
    ModelResponse,
    PartStartEvent,
)
from pydantic_ai.models.google import GoogleModel, GoogleModelSettings
from pydantic_ai.providers.google import GoogleProvider

from stance_project import StanceWatchProject

load_dotenv()
DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")


class SourceRef(BaseModel):
    title: str = ""
    url: str = ""
    why_relevant: str = ""


class Hypothesis(BaseModel):
    label: str = Field(description="Short name, e.g. 'Career move', 'Breaking news'")
    strength: str = Field(description="weak | moderate | strong (evidence-based, not causal certainty)")
    explanation: str = Field(description="What the sources suggest; avoid defamation.")


class ShiftNewsBrief(BaseModel):
    post_id: str
    iso_date: str | None = None
    summary: str = Field(description="2-4 sentences; uncertainty explicit.")
    hypotheses: list[Hypothesis] = Field(default_factory=list)
    sources: list[SourceRef] = Field(default_factory=list)
    caveats: list[str] = Field(
        default_factory=list,
        description="e.g. correlation not causation; pay speculation needs reporting-grade evidence.",
    )


def _resolve_gemini_key() -> str:
    key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not key:
        raise RuntimeError("Set GOOGLE_API_KEY or GEMINI_API_KEY")
    return key


def _make_stream_progress(verbose: bool) -> Any:
    if not verbose:
        return None
    n = 0

    async def _progress(_ctx: Any, events: AsyncIterable[Any]) -> None:
        nonlocal n
        async for ev in events:
            if isinstance(ev, PartStartEvent) and isinstance(ev.part, BuiltinToolCallPart):
                if ev.part.tool_name == "web_search":
                    n += 1
                    print(f"  [web_search #{n}] …", file=sys.stderr, flush=True)
            elif isinstance(ev, FinalResultEvent):
                print("  [model] assembling result …", file=sys.stderr, flush=True)

    return _progress


def _grounding_urls_from_messages(messages: list[Any]) -> list[str]:
    urls: list[str] = []
    for msg in messages:
        if not isinstance(msg, ModelResponse):
            continue
        for part in msg.parts:
            if isinstance(part, BuiltinToolReturnPart) and part.tool_name == "web_search":
                content = part.content
                if not isinstance(content, list):
                    continue
                for chunk in content:
                    if isinstance(chunk, dict):
                        u = chunk.get("uri") or chunk.get("url")
                        if u:
                            urls.append(str(u))
    return list(dict.fromkeys(urls))


def build_agent(*, model_name: str) -> Agent[None, ShiftNewsBrief]:
    provider = GoogleProvider(api_key=_resolve_gemini_key())
    model = GoogleModel(model_name, provider=provider)
    settings = GoogleModelSettings(temperature=0.2, max_tokens=8192)
    return Agent(
        model,
        output_type=ShiftNewsBrief,
        model_settings=settings,
        builtin_tools=[WebSearchTool()],
        instructions=(
            "You are a careful research assistant. For a public figure's social post, use web_search to find "
            "credible news from roughly the same period about them and major world events. "
            "You MUST NOT assert bribery, crimes, or hidden paymasters without strong published reporting; "
            "if unsupported, list that as a low-strength hypothesis or omit. "
            "Prefer mainstream outlets and primary documents. "
            "Output must match the ShiftNewsBrief schema fields exactly."
        ),
    )


def run_one_brief(
    agent: Agent[None, ShiftNewsBrief],
    person: dict[str, Any],
    hints: dict[str, Any],
    event: dict[str, Any],
    *,
    verbose: bool,
) -> ShiftNewsBrief:
    ctx = {
        "person": person,
        "agent_hints": hints,
        "shift_event": {
            "post_id": event.get("post_id"),
            "iso_date": event.get("iso_date"),
            "z_score": event.get("z_score"),
            "exemplar_text": event.get("exemplar_text"),
        },
    }
    user = (
        "Produce a ShiftNewsBrief for this shift. Use web_search with queries that combine the person's name, "
        "the approximate date if present, and topics visible in the exemplar text. "
        "Include 3-8 sources when possible. "
        "JSON context:\n"
        + json.dumps(ctx, indent=2, ensure_ascii=False)
    )
    stream = _make_stream_progress(verbose)
    run = agent.run_sync(user, event_stream_handler=stream)
    out = run.output
    if not isinstance(out, ShiftNewsBrief):
        raise TypeError("Unexpected agent output type")
    # Ensure post_id matches
    out.post_id = str(event.get("post_id") or out.post_id)
    out.iso_date = event.get("iso_date") if event.get("iso_date") else out.iso_date
    extra_urls = _grounding_urls_from_messages(run.all_messages())
    existing = {s.url for s in out.sources if s.url}
    for u in extra_urls:
        if u not in existing:
            out.sources.append(SourceRef(title="", url=u, why_relevant="Grounding chunk"))
            existing.add(u)
    return out


def load_existing_briefs(path: Path) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    if not path.is_file():
        return {"meta": {}}, []
    data = json.loads(path.read_text(encoding="utf-8"))
    briefs = data.get("briefs") if isinstance(data, dict) else None
    if not isinstance(briefs, list):
        briefs = []
    return data if isinstance(data, dict) else {"meta": {}}, briefs


def main() -> None:
    ap = argparse.ArgumentParser(description="News context briefs for stance shift events")
    ap.add_argument("--project", type=Path, required=True)
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--max-events", type=int, default=10, help="Cap briefs per run (cost control)")
    ap.add_argument("--resume", action="store_true", help="Skip post_ids already in news_briefs.json")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    proj = StanceWatchProject.from_path(args.project)
    proj.ensure_layout()
    if not proj.person_profile_json.is_file():
        print(f"Missing {proj.person_profile_json}", file=sys.stderr)
        raise SystemExit(1)
    if not proj.shift_events_json.is_file():
        print(f"Missing {proj.shift_events_json}; run stance_detect.py first.", file=sys.stderr)
        raise SystemExit(1)

    person = json.loads(proj.person_profile_json.read_text(encoding="utf-8"))
    hints: dict[str, Any] = {}
    if proj.agent_hints_json.is_file():
        hints = json.loads(proj.agent_hints_json.read_text(encoding="utf-8"))

    shifts_data = json.loads(proj.shift_events_json.read_text(encoding="utf-8"))
    events = shifts_data.get("shift_events") or []
    if not isinstance(events, list):
        events = []

    _, existing_briefs = load_existing_briefs(proj.news_briefs_json)
    done_ids = {str(b.get("post_id")) for b in existing_briefs if isinstance(b, dict) and b.get("post_id")}

    agent = build_agent(model_name=args.model)
    verbose = not args.quiet
    new_briefs: list[dict[str, Any]] = []
    count = 0

    for ev in events:
        if count >= args.max_events:
            break
        pid = str(ev.get("post_id") or "")
        if not pid:
            continue
        if args.resume and pid in done_ids:
            continue
        if verbose:
            print(f"Brief for {pid} …", file=sys.stderr, flush=True)
        t0 = time.monotonic()
        brief = run_one_brief(agent, person, hints, ev, verbose=verbose)
        new_briefs.append(json.loads(brief.model_dump_json()))
        done_ids.add(pid)
        count += 1
        if verbose:
            print(f"  done in {time.monotonic() - t0:.1f}s", file=sys.stderr, flush=True)

    merged = [b for b in existing_briefs if isinstance(b, dict)]
    merged.extend(new_briefs)
    # Dedupe by post_id keeping last
    by_id: dict[str, dict[str, Any]] = {}
    for b in merged:
        pid = str(b.get("post_id") or "")
        if pid:
            by_id[pid] = b
    final_list = list(by_id.values())

    payload = {
        "meta": {
            "built_at_utc": datetime.now(timezone.utc).isoformat(),
            "model": args.model,
            "n_briefs": len(final_list),
            "n_new_this_run": len(new_briefs),
        },
        "briefs": final_list,
    }
    proj.news_briefs_json.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {proj.news_briefs_json} ({len(new_briefs)} new, {len(final_list)} total)", file=sys.stderr)


if __name__ == "__main__":
    main()