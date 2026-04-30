import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import type { EvidenceTweet, ShiftEvent, TopicStance } from "@/data/mockData";
import { useNavigate } from "react-router-dom";

interface Props {
  topics: TopicStance[];
  evidence?: EvidenceTweet[];
  shifts?: ShiftEvent[];
  focusTopic?: string;
  figureId?: string;
}

const trendTag = (trend: TopicStance["trend"]) => {
  switch (trend) {
    case "right": return <span className="text-amber font-mono text-[10px]">▲ SHIFTED RIGHT</span>;
    case "left": return <span className="text-primary font-mono text-[10px]">▼ SHIFTED LEFT</span>;
    case "stable": return <span className="text-muted-foreground/50 font-mono text-[10px]">— STABLE</span>;
  }
};

const topicKeywords: Record<string, string[]> = {
  Immigration: ["immigration", "border", "migrant", "deport", "asylum", "sanctuary", "illegal alien"],
};

function relatedEvidence(topic: string, evidence: EvidenceTweet[]) {
  const kws = topicKeywords[topic] || [topic.toLowerCase()];
  return evidence
    .map((t) => {
      const txt = String(t.text || "").toLowerCase();
      const hits = kws.reduce((n, k) => n + (txt.includes(k) ? 1 : 0), 0);
      return { t, hits };
    })
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits || b.t.likes - a.t.likes)
    .slice(0, 6)
    .map((x) => x.t);
}

const IssuesGrid = ({ topics, evidence = [], shifts = [], focusTopic, figureId }: Props) => {
  const navigate = useNavigate();
  const defaultTopic = focusTopic && topics.some((t) => t.topic === focusTopic) ? focusTopic : topics[0]?.topic;
  const [selectedTopic, setSelectedTopic] = useState<string | undefined>(defaultTopic);
  const selected = topics.find((t) => t.topic === selectedTopic) || topics[0];
  const selectedEvidence = useMemo(
    () => (selected ? relatedEvidence(selected.topic, evidence) : []),
    [selected, evidence],
  );
  const selectedShifts = useMemo(
    () => shifts.filter((s) => s.topic.toLowerCase() === String(selected?.topic || "").toLowerCase()),
    [selected, shifts],
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {topics.map((topic, i) => (
          <motion.button
            key={topic.topic}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.4 }}
            viewport={{ once: true }}
            type="button"
            onClick={() => {
              if (topic.topic === "Immigration" && figureId) {
                navigate(`/dossier/${figureId}/immigration`);
                return;
              }
              setSelectedTopic(topic.topic);
            }}
            className={`border-glow border-glow-hover rounded p-4 bg-card/40 transition-all text-left ${
              selected?.topic === topic.topic ? "ring-1 ring-primary/40" : ""
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{topic.icon}</span>
              <span className="font-mono text-xs tracking-widest text-foreground/80 uppercase">{topic.topic}</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">{topic.stance}</p>

            {/* Score bar */}
            <div className="relative h-2 bg-muted rounded-full mb-2 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${((topic.score + 10) / 20) * 100}%` }}
                transition={{ delay: i * 0.08 + 0.3, duration: 0.6 }}
                viewport={{ once: true }}
                className="absolute h-full rounded-full"
                style={{
                  background: topic.score > 3 ? "hsl(37, 90%, 55%)" :
                    topic.score < -3 ? "hsl(185, 100%, 50%)" :
                    "hsl(215, 15%, 55%)",
                }}
              />
              {/* Center mark */}
              <div className="absolute left-1/2 top-0 w-px h-full bg-foreground/20" />
            </div>

            <div className="flex justify-between items-center">
              <span className="font-mono text-[10px] text-muted-foreground/40">-10</span>
              {trendTag(topic.trend)}
              <span className="font-mono text-[10px] text-muted-foreground/40">+10</span>
            </div>
          </motion.button>
        ))}
      </div>

      {selected && (
        <div className="border border-primary/15 rounded p-4 bg-card/30">
          <p className="font-mono text-[11px] tracking-wider text-primary/80 mb-2">
            {selected.topic.toUpperCase()} DRILL-DOWN
          </p>
          <p className="text-sm text-muted-foreground mb-3">
            Score moved from{" "}
            <span className="text-foreground">{Number(selected.previousScore ?? selected.score).toFixed(1)}</span>
            {" "}to{" "}
            <span className="text-foreground">{Number(selected.score).toFixed(1)}</span>
            {" "}on the -10 to +10 scale.
          </p>

          <div className="space-y-2 mb-4">
            <p className="font-mono text-[10px] text-muted-foreground/60">WHERE IT CHANGED</p>
            {selectedShifts.length ? (
              selectedShifts.slice(0, 3).map((s) => (
                <div key={s.id} className="border border-primary/10 rounded p-3">
                  <p className="font-mono text-[10px] text-muted-foreground/70">{s.date} • {s.direction === "right" ? "+" : "-"}{s.magnitude}</p>
                  <p className="text-sm text-muted-foreground mt-1">{s.before}</p>
                  <p className="text-sm text-foreground/90 mt-1">{s.after}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No discrete shift event was flagged for this topic in the current run.</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="font-mono text-[10px] text-muted-foreground/60">RELATED POSTS</p>
            {selectedEvidence.length ? (
              selectedEvidence.map((t) => (
                <article key={t.id} className="border border-primary/10 rounded p-3 bg-card/40">
                  <p className="text-sm text-muted-foreground leading-relaxed">"{t.text}"</p>
                  <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-muted-foreground/70">
                    <span>{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "Unknown date"}</span>
                    {t.url ? (
                      <a href={t.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">OPEN POST</a>
                    ) : (
                      <span>RT {t.retweets} | Likes {t.likes}</span>
                    )}
                  </div>
                </article>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No topic-matched posts found in sampled evidence.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default IssuesGrid;
