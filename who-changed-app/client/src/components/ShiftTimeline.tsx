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
    <div className="w-full">
      <div className="relative space-y-4 pl-4 md:pl-6">
        <div className="absolute left-1 md:left-2 top-2 bottom-2 w-px bg-primary/25" />

        {events.map((event, i) => {
          const isOpen = expanded === event.id;
          const isFlagged = event.anomalyFlag ?? event.magnitude >= 3;
          const delta =
            typeof event.currentScore === "number" && typeof event.baselineScore === "number"
              ? event.currentScore - event.baselineScore
              : null;

          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              viewport={{ once: true }}
              className="relative"
            >
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : event.id)}
                className={`w-full text-left rounded border px-3 py-3 transition-colors ${
                  isOpen ? "border-primary/40 bg-card/60" : "border-primary/20 bg-card/30 hover:border-primary/35"
                }`}
              >
                <span className="absolute -left-[15px] md:-left-[19px] top-4 inline-flex h-3 w-3 rotate-45 border border-primary/50 bg-background" />

                <div className="flex flex-wrap items-center gap-2">
                  {isFlagged ? <span className="text-sm">⚠️</span> : <span className="text-sm">⚡</span>}
                  <span className="font-mono text-xs text-amber">{event.date}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">{event.topic}</span>
                  <span
                    className={`font-mono text-[11px] ${
                      event.direction === "right" ? "text-amber" : "text-primary"
                    }`}
                  >
                    {event.direction === "right" ? "+" : "-"}
                    {event.magnitude}
                  </span>
                  {(event.baselinePeriod || event.currentPeriod) && (
                    <span className="font-mono text-[10px] text-muted-foreground/70">
                      {event.baselinePeriod || "baseline"} → {event.currentPeriod || "current"}
                    </span>
                  )}
                  {delta !== null && (
                    <span className={`font-mono text-[10px] ${delta >= 0 ? "text-amber" : "text-primary"}`}>
                      Δ {delta >= 0 ? "+" : ""}
                      {delta.toFixed(2)}
                    </span>
                  )}
                </div>
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mt-2"
                  >
                    <div className="rounded border border-primary/20 bg-card/40 px-3 py-3 space-y-3">
                      {event.flaggedTweetText && (
                        <div className="rounded border border-amber/25 bg-amber/5 p-2">
                          <p className="font-mono text-[10px] text-amber/90 mb-1">
                            {isFlagged ? "⚠️ FLAGGED TWEET EVIDENCE" : "TWEET EVIDENCE"}
                            {event.flaggedTweetDate ? ` • ${event.flaggedTweetDate}` : ""}
                          </p>
                          <p className="text-sm text-foreground/90 leading-relaxed">"{event.flaggedTweetText}"</p>
                        </div>
                      )}

                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-mono text-[10px] text-muted-foreground/60">BEFORE:</span>
                          <p className="text-muted-foreground">{event.before}</p>
                        </div>
                        <div>
                          <span className="font-mono text-[10px] text-amber/60">THE FISSURE:</span>
                          <p className="text-foreground/90">{event.fissure}</p>
                        </div>
                        <div>
                          <span className="font-mono text-[10px] text-secondary/60">AFTER:</span>
                          <p className="text-muted-foreground">{event.after}</p>
                        </div>
                      </div>

                      {event.news.length > 0 && (
                        <div className="border-t border-primary/10 pt-2">
                          <span className="font-mono text-[10px] text-muted-foreground/50">📰 NEWS AT THE TIME:</span>
                          {event.news.map((n, ni) => (
                            <p key={ni} className="font-mono text-[11px] text-muted-foreground mt-1">
                              {n.headline} <span className="text-muted-foreground/40">• {n.source}</span>
                            </p>
                          ))}
                          {(event.newsDateAnchor || event.newsQueryUsed) && (
                            <p className="font-mono text-[10px] text-muted-foreground/50 mt-2">
                              Match context: {event.newsDateAnchor || "n/a"}
                              {event.newsQueryUsed ? ` • query: ${event.newsQueryUsed}` : ""}
                            </p>
                          )}
                        </div>
                      )}
                      {event.news.length === 0 && event.newsNarrative && (
                        <div className="border-t border-primary/10 pt-2">
                          <span className="font-mono text-[10px] text-muted-foreground/50">📰 NEWS CORRELATION NOTE:</span>
                          <p className="text-xs text-muted-foreground mt-1">{event.newsNarrative}</p>
                          {(event.newsDateAnchor || event.newsQueryUsed) && (
                            <p className="font-mono text-[10px] text-muted-foreground/50 mt-2">
                              Match context: {event.newsDateAnchor || "n/a"}
                              {event.newsQueryUsed ? ` • query: ${event.newsQueryUsed}` : ""}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default ShiftTimeline;
