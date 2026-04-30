/**
 * Agent 5 — The Synthesizer: holistic summary for dashboard header.
 */
import { callClaudeJson } from "../lib/anthropic.js";

const SYSTEM = `You are an analyst writing for a research dashboard. Output JSON only, no markdown.
Summarize ideological evolution based ONLY on the structured inputs (window scores, shifts, news context).
Include uncertainty; this is interpretation of public statements, not mind-reading.
Return JSON:
{
  "full_summary": "3-4 paragraphs plain text with newlines allowed",
  "most_significant_shift": "one sentence",
  "current_spectrum_estimate": number between -10 and 10,
  "spectrum_three_years_ago": number between -10 and 10,
  "surprises_or_inconsistencies": "short paragraph",
  "overall_confidence": 0.0-1.0,
  "disclaimer": "required short legal/ethical disclaimer string"
}`;

export async function runNarratorAgent(contextResult, emit) {
  emit({ stage: "narrator", message: "Writing final analysis…", progress: 0.88 });
  if (!contextResult.timeline?.length) {
    const out = {
      full_summary:
        "Not enough timeline data to classify windows. Try again with a handle that returns more posts.",
      most_significant_shift: "—",
      current_spectrum_estimate: 0,
      spectrum_three_years_ago: 0,
      surprises_or_inconsistencies: "—",
      overall_confidence: 0.2,
      disclaimer:
        "AI-generated interpretation of public posts only; insufficient data in this run.",
    };
    emit({ stage: "narrator", message: "Writing final analysis… skipped (no windows).", progress: 0.96, done: true });
    return out;
  }
  const payload = {
    handle: contextResult.handle,
    timeline: contextResult.timeline,
    shifts: contextResult.shifts,
  };
  const user = `Synthesize this analysis:\n${JSON.stringify(payload, null, 2)}`;
  let out;
  try {
    out = await callClaudeJson(SYSTEM, user, { maxTokens: 4096 });
  } catch {
    out = {
      full_summary:
        "Summary generation failed (API error). Raw timeline and shifts are still available below. This tool produces AI-generated interpretation of public posts only.",
      most_significant_shift: "See shift timeline.",
      current_spectrum_estimate: contextResult.timeline.at(-1)?.overall ?? 0,
      spectrum_three_years_ago: contextResult.timeline[0]?.overall ?? 0,
      surprises_or_inconsistencies: "—",
      overall_confidence: 0.35,
      disclaimer:
        "This dashboard is AI-generated commentary on public statements. It is not factual profiling of private beliefs and may contain errors.",
    };
  }
  emit({ stage: "narrator", message: "Writing final analysis… complete.", progress: 0.96, done: true });
  return out;
}
