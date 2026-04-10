/**
 * Agent 3 — The Cartographer: detect shifts between consecutive windows.
 */

const TOPIC_DELTA = 3;
const OVERALL_DELTA = 2;

export function runShiftDetectorAgent(classifierResult, emit) {
  emit({ stage: "shiftDetector", message: "Detecting ideological shifts…", progress: 0.56 });
  const { handle, timeline, topics } = classifierResult;
  const shifts = [];

  for (let i = 1; i < timeline.length; i++) {
    const prev = timeline[i - 1];
    const cur = timeline[i];
    for (const topic of topics) {
      const a = prev.scores[topic] ?? 0;
      const b = cur.scores[topic] ?? 0;
      const delta = b - a;
      if (Math.abs(delta) >= TOPIC_DELTA) {
        shifts.push({
          topic,
          direction: delta > 0 ? "right" : "left",
          magnitude: Math.abs(delta),
          date_range: `${cur.period} (vs ${prev.period})`,
          period_after: cur.period,
          period_before: prev.period,
          before_summary: `${topic}: ${prev.summary?.slice(0, 400) || "prior window"}`,
          after_summary: `${topic}: ${cur.summary?.slice(0, 400) || "later window"}`,
          scores_before: prev.scores[topic],
          scores_after: cur.scores[topic],
        });
      }
    }
    const oa = prev.overall ?? 0;
    const ob = cur.overall ?? 0;
    const od = ob - oa;
    if (Math.abs(od) >= OVERALL_DELTA) {
      const exists = shifts.some(
        (s) => s.period_after === cur.period && s.topic === "__overall__"
      );
      if (!exists) {
        shifts.push({
          topic: "__overall__",
          direction: od > 0 ? "right" : "left",
          magnitude: Math.abs(od),
          date_range: `${cur.period} (vs ${prev.period})`,
          period_after: cur.period,
          period_before: prev.period,
          before_summary: prev.summary?.slice(0, 500) || "",
          after_summary: cur.summary?.slice(0, 500) || "",
          scores_before: oa,
          scores_after: ob,
        });
      }
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
