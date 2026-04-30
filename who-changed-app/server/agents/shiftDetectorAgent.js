/**
 * Agent 3 — The Cartographer: detect shifts from oldest baseline over time.
 */

const TOPIC_BASELINE_DELTA = 2;
const OVERALL_BASELINE_DELTA = 1.5;
const FALLBACK_SHIFT_COUNT = 4;

export function runShiftDetectorAgent(classifierResult, emit) {
  emit({ stage: "shiftDetector", message: "Detecting ideological shifts…", progress: 0.56 });
  const { handle, timeline, topics } = classifierResult;
  const shifts = [];

  const baseline = timeline[0];
  if (!baseline) {
    emit({
      stage: "shiftDetector",
      message: "Detecting ideological shifts… flagged 0 event(s).",
      progress: 0.62,
      done: true,
    });
    return { handle, timeline, topics, shifts: [] };
  }

  for (let i = 1; i < timeline.length; i++) {
    const cur = timeline[i];
    for (const topic of topics) {
      const a = baseline.scores[topic] ?? 0;
      const b = cur.scores[topic] ?? 0;
      const delta = b - a;
      if (Math.abs(delta) >= TOPIC_BASELINE_DELTA) {
        shifts.push({
          topic,
          direction: delta > 0 ? "right" : "left",
          magnitude: Math.abs(delta),
          date_range: `${cur.period} (vs baseline ${baseline.period})`,
          period_after: cur.period,
          period_before: baseline.period,
          before_summary: `${topic}: ${baseline.summary?.slice(0, 400) || "baseline window"}`,
          after_summary: `${topic}: ${cur.summary?.slice(0, 400) || "later window"}`,
          scores_before: baseline.scores[topic],
          scores_after: cur.scores[topic],
          baseline_reference: true,
        });
      }
    }
    const oa = baseline.overall ?? 0;
    const ob = cur.overall ?? 0;
    const od = ob - oa;
    if (Math.abs(od) >= OVERALL_BASELINE_DELTA) {
      const exists = shifts.some(
        (s) => s.period_after === cur.period && s.topic === "__overall__"
      );
      if (!exists) {
        shifts.push({
          topic: "__overall__",
          direction: od > 0 ? "right" : "left",
          magnitude: Math.abs(od),
          date_range: `${cur.period} (vs baseline ${baseline.period})`,
          period_after: cur.period,
          period_before: baseline.period,
          before_summary: baseline.summary?.slice(0, 500) || "",
          after_summary: cur.summary?.slice(0, 500) || "",
          scores_before: oa,
          scores_after: ob,
          baseline_reference: true,
        });
      }
    }
  }

  // If strict baseline thresholds detect nothing, still surface largest observed
  // movement from the baseline so timeline/evidence remains useful.
  if (!shifts.length && timeline.length >= 2) {
    const candidates = [];
    for (const topic of topics) {
      let best = null;
      for (let i = 1; i < timeline.length; i++) {
        const cur = timeline[i];
        const a = baseline.scores[topic] ?? 0;
        const b = cur.scores[topic] ?? 0;
        const delta = b - a;
        if (!best || Math.abs(delta) > Math.abs(best.delta)) {
          best = { i, baseline, cur, delta };
        }
      }
      if (!best) continue;
      candidates.push({
        topic,
        direction: best.delta > 0 ? "right" : "left",
        magnitude: Math.abs(best.delta),
        date_range: `${best.cur.period} (vs baseline ${best.baseline.period})`,
        period_after: best.cur.period,
        period_before: best.baseline.period,
        before_summary: `${topic}: ${best.baseline.summary?.slice(0, 400) || "baseline window"}`,
        after_summary: `${topic}: ${best.cur.summary?.slice(0, 400) || "later window"}`,
        scores_before: best.baseline.scores[topic],
        scores_after: best.cur.scores[topic],
        fallback_detected: true,
        baseline_reference: true,
      });
    }
    candidates.sort((a, b) => b.magnitude - a.magnitude);
    shifts.push(...candidates.slice(0, FALLBACK_SHIFT_COUNT));
    const hasImmigration = shifts.some((s) => s.topic === "immigration");
    const immigrationCandidate = candidates.find((c) => c.topic === "immigration");
    if (!hasImmigration && immigrationCandidate) {
      shifts.push({ ...immigrationCandidate, forced_topic_focus: true });
    }
  }

  shifts.sort((a, b) => b.magnitude - a.magnitude);

  emit({
    stage: "shiftDetector",
    message: `Detecting ideological shifts… flagged ${shifts.length} event(s).`,
    progress: 0.62,
    done: true,
  });

  return { handle, timeline, topics, shifts };
}
