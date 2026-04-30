import { motion } from "framer-motion";
import type { TopicStance } from "@/data/mockData";

interface Props {
  topics: TopicStance[];
}

const trendTag = (trend: TopicStance["trend"]) => {
  switch (trend) {
    case "right": return <span className="text-amber font-mono text-[10px]">▲ SHIFTED RIGHT</span>;
    case "left": return <span className="text-primary font-mono text-[10px]">▼ SHIFTED LEFT</span>;
    case "stable": return <span className="text-muted-foreground/50 font-mono text-[10px]">— STABLE</span>;
  }
};

const IssuesGrid = ({ topics }: Props) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {topics.map((topic, i) => (
        <motion.div
          key={topic.topic}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, duration: 0.4 }}
          viewport={{ once: true }}
          className="border-glow border-glow-hover rounded p-4 bg-card/40 transition-all"
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
        </motion.div>
      ))}
    </div>
  );
};

export default IssuesGrid;
