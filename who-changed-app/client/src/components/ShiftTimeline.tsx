import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ShiftEvent } from "@/data/mockData";

interface Props {
  events: ShiftEvent[];
}

const ShiftTimeline = ({ events }: Props) => {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!events.length) {
    return (
      <div className="border border-primary/15 rounded-lg p-4 bg-card/30">
        <p className="font-mono text-xs tracking-wider text-muted-foreground/80">
          No timeline shifts detected yet.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          We need multiple time windows of posts to compare before/after changes. Try re-running analysis on a handle with a longer post history.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto pb-4">
      {/* Desktop: horizontal */}
      <div className="hidden md:block relative min-w-[700px]">
        {/* Spine */}
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-primary/40" style={{ boxShadow: "0 0 12px hsla(185, 100%, 50%, 0.3)" }} />

        <div className="flex justify-around items-center py-20 relative">
          {events.map((event, i) => {
            const isUp = event.direction === "right";
            const height = Math.min(event.magnitude * 12, 100);
            const isOpen = expanded === event.id;

            return (
              <div key={event.id} className="flex flex-col items-center relative cursor-pointer" onClick={() => setExpanded(isOpen ? null : event.id)}>
                {/* Spike */}
                <motion.div
                  initial={{ scaleY: 0 }}
                  whileInView={{ scaleY: 1 }}
                  transition={{ delay: i * 0.2, duration: 0.5, ease: "easeOut" }}
                  viewport={{ once: true }}
                  className="w-0.5 origin-bottom"
                  style={{
                    height: `${height}px`,
                    background: isUp ? "hsl(37, 90%, 55%)" : "hsl(185, 100%, 50%)",
                    transform: isUp ? "translateY(-50%)" : "translateY(50%) scaleY(-1)",
                    position: "absolute",
                    top: isUp ? undefined : "50%",
                    bottom: isUp ? "50%" : undefined,
                  }}
                />

                {/* Diamond node */}
                <motion.div
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  transition={{ delay: i * 0.2 + 0.3, type: "spring" }}
                  viewport={{ once: true }}
                  className={`w-4 h-4 rotate-45 border-2 z-10 ${isOpen ? "bg-primary border-primary" : "bg-card border-primary/60"} transition-colors`}
                  style={{
                    position: "absolute",
                    top: isUp ? `calc(50% - ${height}px - 8px)` : `calc(50% + ${height}px - 8px)`,
                  }}
                />

                {/* Date label */}
                <span className="font-mono text-[10px] text-muted-foreground absolute" style={{ top: isUp ? `calc(50% - ${height}px - 28px)` : `calc(50% + ${height}px + 12px)` }}>
                  {event.date}
                </span>

                {/* Expanded card */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="absolute z-30 w-80 frosted-glass border-glow rounded p-4 text-left"
                      style={{ top: isUp ? `calc(50% - ${height}px - 200px)` : `calc(50% + ${height}px + 30px)` }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-amber">⚡</span>
                        <span className="font-mono text-xs text-amber font-semibold">SHIFT DETECTED — {event.date}</span>
                      </div>
                      <div className="flex gap-4 font-mono text-[11px] text-muted-foreground mb-3">
                        <span>Topic: <span className="text-foreground">{event.topic}</span></span>
                        <span>Magnitude: <span className={event.direction === "right" ? "text-amber" : "text-primary"}>
                          {event.direction === "right" ? "+" : "-"}{event.magnitude}
                        </span></span>
                      </div>
                      <div className="border-t border-primary/10 pt-2 space-y-2 text-sm">
                        <div><span className="font-mono text-[10px] text-muted-foreground/60">BEFORE:</span><p className="text-muted-foreground">{event.before}</p></div>
                        <div><span className="font-mono text-[10px] text-amber/60">THE FISSURE:</span><p className="text-foreground/90">{event.fissure}</p></div>
                        <div><span className="font-mono text-[10px] text-secondary/60">AFTER:</span><p className="text-muted-foreground">{event.after}</p></div>
                      </div>
                      {event.news.length > 0 && (
                        <div className="border-t border-primary/10 pt-2 mt-2">
                          <span className="font-mono text-[10px] text-muted-foreground/50">📰 NEWS AT THE TIME:</span>
                          {event.news.map((n, ni) => (
                            <p key={ni} className="font-mono text-[11px] text-muted-foreground mt-1">
                              {n.headline} <span className="text-muted-foreground/40">• {n.source}</span>
                            </p>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile: vertical */}
      <div className="md:hidden space-y-6">
        {events.map((event, i) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            viewport={{ once: true }}
            className="border-l-2 border-primary/30 pl-4 cursor-pointer"
            onClick={() => setExpanded(expanded === event.id ? null : event.id)}
          >
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rotate-45 bg-primary/60 -ml-[22px]" />
              <span className="font-mono text-xs text-amber">{event.date}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{event.topic} ({event.direction === "right" ? "+" : "-"}{event.magnitude})</span>
            </div>
            <AnimatePresence>
              {expanded === event.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mt-2 border-glow rounded p-3 bg-card/40 text-sm space-y-2"
                >
                  <p className="text-muted-foreground"><span className="font-mono text-[10px] text-muted-foreground/50">BEFORE: </span>{event.before}</p>
                  <p className="text-foreground/90"><span className="font-mono text-[10px] text-amber/60">FISSURE: </span>{event.fissure}</p>
                  <p className="text-muted-foreground"><span className="font-mono text-[10px] text-secondary/60">AFTER: </span>{event.after}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default ShiftTimeline;
