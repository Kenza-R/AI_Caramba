import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { analyzeHandle } from "@/data/mockData";

type Step = {
  key: string;
  text: string;
  status: "done" | "running" | "queued";
};

const ORDER = [
  { key: "scraper_archive", text: "> SEARCHING FOR TWEET ARCHIVES ONLINE..." },
  { key: "scraper_api", text: "> FETCHING VIA API..." },
  { key: "scraper_vision", text: "> CAPTURING SCREENSHOTS..." },
  { key: "classifier", text: "> CLASSIFYING STANCES..." },
  { key: "shiftDetector", text: "> DETECTING IDEOLOGICAL SHIFTS..." },
  { key: "context", text: "> MATCHING TO NEWS EVENTS..." },
  { key: "narrator", text: "> WRITING FINAL ANALYSIS..." },
  { key: "complete", text: "> ANALYSIS COMPLETE." },
];

const stageToKey = (stage?: string, msg?: string) => {
  const m = (msg || "").toLowerCase();
  if (stage === "scraper") {
    if (m.includes("searching for tweet archives")) return "scraper_archive";
    if (m.includes("fetching via api")) return "scraper_api";
    if (m.includes("capturing screenshots")) return "scraper_vision";
    return "scraper_api";
  }
  if (stage === "classifier") return "classifier";
  if (stage === "shiftDetector") return "shiftDetector";
  if (stage === "context") return "context";
  if (stage === "narrator") return "narrator";
  if (stage === "complete") return "complete";
  return undefined;
};

const TerminalSearch = () => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<Step[]>(ORDER.map((s) => ({ ...s, status: "queued" })));
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const updateStep = (activeKey: string) => {
    const idx = ORDER.findIndex((s) => s.key === activeKey);
    if (idx < 0) return;
    setSteps((prev) =>
      prev.map((s, i) => ({
        ...s,
        status: i < idx ? "done" : i === idx ? "running" : "queued",
      })),
    );
  };

  const handleAnalyze = async () => {
    if (!query.trim() || loading) return;
    setLoading(true);
    setError("");
    setSteps(ORDER.map((s) => ({ ...s, status: "queued" })));

    try {
      await analyzeHandle(query, (ev) => {
        const key = stageToKey(ev?.stage, ev?.message);
        if (key) updateStep(key);
        if (ev?.stage === "complete" && ev?.dashboard?.handle) {
          setSteps((prev) =>
            prev.map((s) => (s.key === "complete" ? { ...s, status: "done" } : s)),
          );
          navigate(`/dossier/${ev.dashboard.handle}`);
        }
        if (ev?.stage === "error") {
          setError(String(ev?.message || "Analysis failed."));
          setLoading(false);
        }
      });
    } catch (e: any) {
      setError(String(e?.message || e));
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <AnimatePresence mode="wait">
        {!loading ? (
          <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                placeholder="ENTER TARGET: name or @handle_"
                className="w-full bg-transparent border border-primary/30 rounded px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 focus:glow-cyan transition-all"
                style={{ boxShadow: "inset 0 0 20px hsla(185, 100%, 50%, 0.05)" }}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/30 animate-blink font-mono">
                ▌
              </div>
            </div>

            <motion.button
              onClick={handleAnalyze}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="mt-4 w-full py-3 border border-primary/40 rounded font-mono text-sm tracking-widest text-primary hover:bg-primary/10 transition-all sweep-animation"
            >
              ANALYZE
            </motion.button>
            {error && <p className="mt-3 text-xs text-destructive font-mono">{error}</p>}
          </motion.div>
        ) : (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="border-glow rounded p-6 bg-card/50 font-mono text-sm space-y-2"
          >
            {steps.map((step, i) => (
              <motion.div
                key={step.key}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex justify-between"
              >
                <span className={step.status === "queued" ? "text-muted-foreground/40" : "text-foreground/80"}>
                  {step.text}
                </span>
                <span
                  className={
                    step.status === "done"
                      ? "text-secondary"
                      : step.status === "running"
                        ? "text-amber animate-pulse"
                        : "text-muted-foreground/30"
                  }
                >
                  [{step.status === "done" ? "DONE" : step.status === "running" ? "RUNNING" : "QUEUED"}]
                </span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TerminalSearch;
