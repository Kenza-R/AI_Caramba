/**
 * Agent 3 — The Cartographer: detect shifts from oldest baseline over time.
 */

const TOPIC_BASELINE_DELTA = 2;
const OVERALL_BASELINE_DELTA = 1.5;
const ANOMALY_Z_THRESHOLD = 2;

function periodRank(period) {
  const p = String(period || "");
  const hm = /^(\d{4})-H([12])$/.exec(p);
  if (hm) return Number(hm[1]) * 10 + Number(hm[2]) * 5;
  const qm = /^(\d{4})-Q([1-4])$/.exec(p);
  if (qm) return Number(qm[1]) * 10 + Number(qm[2]);
  return Number.MAX_SAFE_INTEGER;
}

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr, mu) {
  if (arr.length <= 1) return 0;
  const v = arr.reduce((acc, x) => acc + (x - mu) ** 2, 0) / arr.length;
  return Math.sqrt(v);
}

export function runShiftDetectorAgent(classifierResult, emit) {
  emit({ stage: "shiftDetector", message: "Detecting ideological shifts…", progress: 0.56 });
  const { handle, timeline, topics, analysis_meta } = classifierResult;
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

  const baselines = analysis_meta?.topic_baselines || {};
  const minHitsPerWindow = Number(analysis_meta?.min_topic_hits_per_window || 1);

  // Topic-level anomaly detection: compare each future window to prior trend from oldest baseline.
  for (const topic of topics) {
    const rows = timeline
      .map((w, idx) => ({
        idx,
        period: w.period,
        score: Number(w.scores?.[topic] ?? 0),
        hits: Number(w.topic_hits?.[topic] || 0),
        summary: w.summary || "",
      }))
      .filter((r) => r.hits >= minHitsPerWindow);

    if (rows.length < 2) continue;

    const baselineMeta = baselines[topic];
    const baselineRow = baselineMeta
      ? rows.find((r) => r.period === baselineMeta.period) || rows[0]
      : rows[0];

    for (const cur of rows) {
      if (cur.idx <= baselineRow.idx) continue;
      const prev = rows.filter((r) => r.idx < cur.idx);
      if (!prev.length) continue;

      const prevScores = prev.map((r) => r.score);
      const mu = mean(prevScores);
      const sd = stddev(prevScores, mu);
      const z = sd > 0 ? (cur.score - mu) / sd : 0;
      const baselineDelta = cur.score - baselineRow.score;
      const anomaly =
        (sd > 0 && Math.abs(z) >= ANOMALY_Z_THRESHOLD) ||
        (sd === 0 && Math.abs(baselineDelta) >= TOPIC_BASELINE_DELTA);

      if (!anomaly) continue;
      shifts.push({
        topic,
        direction: baselineDelta > 0 ? "right" : "left",
        magnitude: Math.abs(baselineDelta),
        date_range: `${cur.period} (vs baseline ${baselineRow.period})`,
        period_after: cur.period,
        period_before: baselineRow.period,
        before_summary: `${topic}: ${baselineRow.summary.slice(0, 400) || "baseline window"}`,
        after_summary: `${topic}: ${cur.summary.slice(0, 400) || "later window"}`,
        scores_before: baselineRow.score,
        scores_after: cur.score,
        baseline_reference: true,
        anomaly_flag: true,
        anomaly_stats: {
          z_score: Number(z.toFixed(3)),
          prior_mean: Number(mu.toFixed(3)),
          prior_stddev: Number(sd.toFixed(3)),
          threshold: ANOMALY_Z_THRESHOLD,
        },
      });
    }
  }

  // Overall drift anomalies in chronological order.
  for (let i = 1; i < timeline.length; i++) {
    const cur = timeline[i];
    const prior = timeline.slice(0, i).map((w) => Number(w.overall ?? 0));
    const mu = mean(prior);
    const sd = stddev(prior, mu);
    const score = Number(cur.overall ?? 0);
    const z = sd > 0 ? (score - mu) / sd : 0;
    const deltaFromBaseline = score - Number(baseline.overall ?? 0);
    const isOverallAnomaly =
      (sd > 0 && Math.abs(z) >= ANOMALY_Z_THRESHOLD) ||
      (sd === 0 && Math.abs(deltaFromBaseline) >= OVERALL_BASELINE_DELTA);
    if (!isOverallAnomaly) continue;
    shifts.push({
      topic: "__overall__",
      direction: deltaFromBaseline > 0 ? "right" : "left",
      magnitude: Math.abs(deltaFromBaseline),
      date_range: `${cur.period} (vs baseline ${baseline.period})`,
      period_after: cur.period,
      period_before: baseline.period,
      before_summary: baseline.summary?.slice(0, 500) || "",
      after_summary: cur.summary?.slice(0, 500) || "",
      scores_before: baseline.overall ?? 0,
      scores_after: cur.overall ?? 0,
      baseline_reference: true,
      anomaly_flag: true,
      anomaly_stats: {
        z_score: Number(z.toFixed(3)),
        prior_mean: Number(mu.toFixed(3)),
        prior_stddev: Number(sd.toFixed(3)),
        threshold: ANOMALY_Z_THRESHOLD,
      },
    });
  }

  shifts.sort((a, b) => {
    const d = periodRank(a.period_after) - periodRank(b.period_after);
    if (d !== 0) return d;
    return b.magnitude - a.magnitude;
  });

  emit({
    stage: "shiftDetector",
    message: `Detecting ideological shifts… flagged ${shifts.length} anomaly event(s).`,
    progress: 0.62,
    done: true,
  });

  return { handle, timeline, topics, shifts };
}
