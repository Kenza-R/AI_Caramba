import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { analyzeSelection, searchProfiles, type ProfileSearchOption } from "@/data/mockData";

type Step = {
  key: string;
  text: string;
  status: "done" | "running" | "queued";
};

const ORDER = [
  { key: "lookup", text: "> LOOKING UP PROFILES..." },
  { key: "selected", text: "> PROFILE SELECTED..." },
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

const toUiError = (raw: unknown): string => {
  let msg = raw instanceof Error ? raw.message : String(raw || "Analysis failed.");

  try {
    const parsed = JSON.parse(msg);
    if (parsed && typeof parsed === "object" && typeof parsed.message === "string") {
      msg = parsed.message;
    }
  } catch {
    // not json, keep original message
  }

  if (/x-timeline-scraper returned only 0 posts/i.test(msg)) {
    return "Could not fetch posts from X yet. Please refresh authenticated curl in `server/curl.txt` and retry.";
  }
  if (/No LLM key configured/i.test(msg)) {
    return "Missing server LLM key. Add `LAVA_API_KEY`, `GEMINI_API_KEY`, or `ANTHROPIC_API_KEY` in `server/.env`.";
  }
  return msg;
};

const TerminalSearch = () => {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ProfileSearchOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<ProfileSearchOption | null>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [steps, setSteps] = useState<Step[]>(ORDER.map((s) => ({ ...s, status: "queued" })));
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const selectedTop = useMemo(() => selectedOption || options[highlight] || options[0], [options, highlight, selectedOption]);

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

  useEffect(() => {
    if (!query.trim() || loading) {
      setOptions([]);
      setOpen(false);
      setLookupLoading(false);
      return;
    }
    const t = setTimeout(async () => {
      setLookupLoading(true);
      setError("");
      try {
        const rows = await searchProfiles(query);
        setOptions(rows);
        setHighlight(0);
        setOpen(rows.length > 0);
        if (rows.length > 0) {
          const exact = rows.find((r) => r.id === selectedOption?.id);
          setSelectedOption(exact || rows[0]);
        } else {
          setSelectedOption(null);
        }
      } catch (e: any) {
        setError(toUiError(e));
        setOpen(false);
      } finally {
        setLookupLoading(false);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [query, loading]);

  const handleAnalyzeSelection = async (selection?: ProfileSearchOption) => {
    const pick = selection || selectedTop;
    if (!pick || loading) return;
    setLoading(true);
    setOpen(false);
    setError("");
    setProgressPct(2);
    setSteps(ORDER.map((s) => ({ ...s, status: "queued" })));
    updateStep("lookup");
    updateStep("selected");

    try {
      await analyzeSelection(pick, (ev) => {
        const key = stageToKey(ev?.stage, ev?.message);
        if (key) updateStep(key);
        if (typeof ev?.progress === "number" && Number.isFinite(ev.progress)) {
          const pct = Math.max(0, Math.min(100, Math.round(ev.progress * 100)));
          setProgressPct(pct);
        }
        if (ev?.stage === "complete" && ev?.dashboard?.handle) {
          setSteps((prev) =>
            prev.map((s) => (s.key === "complete" ? { ...s, status: "done" } : s)),
          );
          setProgressPct(100);
          navigate(`/dossier/${ev.dashboard.handle}`);
        }
        if (ev?.stage === "error") {
          setError(toUiError(ev?.message || "Analysis failed."));
          setLoading(false);
        }
      });
    } catch (e: any) {
      setError(toUiError(e));
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
                onFocus={() => options.length && setOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setOpen(true);
                    setHighlight((h) => Math.min(h + 1, Math.max(options.length - 1, 0)));
                    return;
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHighlight((h) => Math.max(h - 1, 0));
                    return;
                  }
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (open && selectedTop) {
                      handleAnalyzeSelection(selectedTop);
                    }
                  }
                }}
                placeholder="ENTER TARGET: name or @handle_"
                className="w-full bg-transparent border border-primary/30 rounded px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 focus:glow-cyan transition-all"
                style={{ boxShadow: "inset 0 0 20px hsla(185, 100%, 50%, 0.05)" }}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/30 animate-blink font-mono">
                ▌
              </div>
            </div>
            {lookupLoading && (
              <p className="mt-2 text-xs text-muted-foreground/70 font-mono">Looking up profiles…</p>
            )}
            {open && options.length > 0 && (
              <div className="mt-2 rounded border border-primary/20 bg-card/90 backdrop-blur-sm overflow-hidden">
                {options.map((opt, i) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setSelectedOption(opt);
                      setQuery(opt.handle);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 border-b last:border-b-0 border-primary/10 hover:bg-primary/10 transition ${
                      (selectedTop?.id === opt.id || i === highlight) ? "bg-primary/10" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-xs text-foreground">
                        {opt.platform.toUpperCase()} • @{opt.handle}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[45%]">
                        {opt.displayName}
                      </span>
                    </div>
                    {!!opt.bio && (
                      <p className="font-mono text-[10px] text-muted-foreground mt-1 truncate">{opt.bio}</p>
                    )}
                  </button>
                ))}
              </div>
            )}

            <motion.button
              onClick={() => handleAnalyzeSelection(selectedTop)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={!selectedTop}
              className="mt-4 w-full py-3 border border-primary/40 rounded font-mono text-sm tracking-widest text-primary hover:bg-primary/10 transition-all sweep-animation disabled:opacity-60"
            >
              SEARCH INFO + ANALYZE
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
            <div className="mb-2">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                <span>PROGRESS</span>
                <span>{progressPct}%</span>
              </div>
              <div className="h-2 w-full rounded bg-primary/10 overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
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
