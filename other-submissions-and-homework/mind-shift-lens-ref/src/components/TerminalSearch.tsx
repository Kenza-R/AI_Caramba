import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { featuredFigures } from "@/data/mockData";

// Maps backend step number → display label
const STEP_LABELS: Record<number, string> = {
  0: "> QUEUED...",
  1: "> RESOLVING TWITTER PROFILE...",
  2: "> FETCHING TWEET HISTORY (up to 3yr range)...",
  3: "> RUNNING AI IDEOLOGICAL ANALYSIS...",
  4: "> SYNTHESIZING FINAL DOSSIER...",
};

type StepStatus = "done" | "running" | "queued";

interface Step {
  text: string;
  status: StepStatus;
}

function buildSteps(currentStep: number): Step[] {
  return Object.entries(STEP_LABELS).map(([key, text]) => {
    const k = Number(key);
    return {
      text,
      status: k < currentStep ? "done" : k === currentStep ? "running" : "queued",
    };
  });
}

const TerminalSearch = () => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [tweetCount, setTweetCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleAnalyze = async () => {
    const q = query.trim();
    if (!q) return;

    setErrorMsg(null);

    // Fast path: if it matches a pre-built figure, use mock data + fake animation
    const mockMatch = featuredFigures.find(
      (f) =>
        f.name.toLowerCase().includes(q.toLowerCase()) ||
        f.handle.toLowerCase().includes(q.toLowerCase().replace("@", ""))
    );
    if (mockMatch) {
      runFakeAnimation(() => navigate(`/dossier/${mockMatch.id}`));
      return;
    }

    // Real path: call backend
    setLoading(true);
    setSteps(buildSteps(0));

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: q.replace("@", "") }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server error ${res.status}`);
      }

      const { job_id } = await res.json();
      await pollJob(job_id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setErrorMsg(msg);
      setLoading(false);
    }
  };

  const pollJob = async (job_id: string) => {
    while (true) {
      await new Promise((r) => setTimeout(r, 2000));

      const res = await fetch(`/api/status/${job_id}`);
      if (!res.ok) {
        setErrorMsg("Lost connection to analysis server");
        setLoading(false);
        return;
      }

      const job = await res.json();

      setSteps(buildSteps(job.step));
      if (job.tweet_count > 0) setTweetCount(job.tweet_count);

      if (job.status === "done" && job.result) {
        // Mark all steps done, then navigate
        setSteps(buildSteps(99));
        await new Promise((r) => setTimeout(r, 600));
        navigate(`/dossier/${job.result.id}`, { state: { figure: job.result } });
        return;
      }

      if (job.status === "error") {
        setErrorMsg(job.error || "Analysis failed");
        setLoading(false);
        return;
      }
    }
  };

  const runFakeAnimation = (onDone: () => void) => {
    const fakeSteps = [
      { text: "> CONNECTING TO ARCHIVE DATABASE...", delay: 400 },
      { text: "> FETCHING TWEET HISTORY (3yr range)...", delay: 800 },
      { text: "> CLASSIFYING IDEOLOGICAL STANCES...", delay: 1200 },
      { text: "> DETECTING SHIFT EVENTS...", delay: 600 },
      { text: "> CROSS-REFERENCING NEWS TIMELINE...", delay: 1000 },
      { text: "> SYNTHESIZING FINAL ANALYSIS...", delay: 800 },
    ];

    setLoading(true);
    setSteps(fakeSteps.map((s) => ({ text: s.text, status: "queued" })));

    let cumDelay = 0;
    fakeSteps.forEach((step, i) => {
      cumDelay += step.delay;
      setTimeout(() => {
        setSteps((prev) =>
          prev.map((s, j) => ({
            ...s,
            status: j < i ? "done" : j === i ? "running" : "queued",
          }))
        );
      }, cumDelay - step.delay);
      setTimeout(() => {
        setSteps((prev) =>
          prev.map((s, j) => ({ ...s, status: j <= i ? "done" : "queued" }))
        );
      }, cumDelay);
    });

    setTimeout(onDone, cumDelay + 500);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <AnimatePresence mode="wait">
        {!loading ? (
          <motion.div
            key="search"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
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

            {errorMsg && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-2 font-mono text-xs text-destructive"
              >
                ERROR: {errorMsg}
              </motion.p>
            )}

            <motion.button
              onClick={handleAnalyze}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="mt-4 w-full py-3 border border-primary/40 rounded font-mono text-sm tracking-widest text-primary hover:bg-primary/10 transition-all sweep-animation"
            >
              ANALYZE
            </motion.button>
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
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex justify-between"
              >
                <span
                  className={
                    step.status === "queued"
                      ? "text-muted-foreground/40"
                      : "text-foreground/80"
                  }
                >
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
                  [
                  {step.status === "done"
                    ? "DONE"
                    : step.status === "running"
                    ? "RUNNING"
                    : "QUEUED"}
                  ]
                </span>
              </motion.div>
            ))}
            {tweetCount > 0 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-muted-foreground/50 pt-1"
              >
                {tweetCount.toLocaleString()} tweets fetched
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TerminalSearch;
