import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import type { Figure } from "@/data/mockData";

interface Props {
  figure: Figure;
  index: number;
}

const ringColor = (intensity: Figure["shiftIntensity"]) => {
  switch (intensity) {
    case "stable":
      return "hsla(185, 100%, 50%, 0.6)";
    case "moderate":
      return "hsla(37, 90%, 55%, 0.7)";
    case "significant":
      return "hsla(0, 75%, 55%, 0.7)";
  }
};

const ringBorder = (intensity: Figure["shiftIntensity"]) => {
  switch (intensity) {
    case "stable":
      return "border-primary/60";
    case "moderate":
      return "border-amber/70";
    case "significant":
      return "border-destructive/70";
  }
};

const avatarFallback = (handle: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(handle.replace(/^@/, ""))}&size=256&background=1a222c&color=6ee7d8&bold=true`;

const FigureCard = ({ figure, index }: Props) => {
  const [hovered, setHovered] = useState(false);
  const navigate = useNavigate();
  const ready = figure.analysisReady !== false;
  const initials = figure.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 + index * 0.15, duration: 0.5 }}
      className={`flex flex-col items-center cursor-pointer group ${ready ? "" : "opacity-75"}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => navigate(`/dossier/${figure.id}`)}
    >
      <div className="relative mb-4">
        <motion.div
          animate={{ y: hovered ? -8 : 0 }}
          transition={{ type: "spring", stiffness: 300 }}
          className="relative"
        >
          <div
            className="absolute -inset-2 rounded-full animate-rotate-ring"
            style={{
              background: ready
                ? `conic-gradient(from 0deg, transparent, ${
                    ringColor(figure.shiftIntensity)
                  }, transparent 40%)`
                : "conic-gradient(from 0deg, transparent, hsla(210, 15%, 40%, 0.35), transparent 40%)",
            }}
          />
          <div
            className={`w-24 h-24 rounded-full border-2 ${
              ready
                ? ringBorder(figure.shiftIntensity)
                : "border-muted-foreground/30"
            } bg-muted flex items-center justify-center overflow-hidden relative z-10`}
          >
            <img
              src={figure.image || avatarFallback(figure.handle)}
              alt={figure.name}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = avatarFallback(figure.handle);
              }}
            />
            {!figure.image && (
              <span className="absolute font-display text-2xl font-bold text-foreground/80">{initials}</span>
            )}
          </div>
        </motion.div>

        <motion.div
          animate={{ opacity: hovered ? 0.4 : 0.15, scale: hovered ? 1.2 : 1 }}
          className="absolute -inset-4 rounded-full blur-xl z-0"
          style={{ background: ringColor(figure.shiftIntensity) }}
        />
      </div>

      <h3 className="font-display text-base font-semibold text-foreground">{figure.name}</h3>
      <p className="font-mono text-xs text-muted-foreground">{figure.handle}</p>
      {!ready && (
        <p className="font-mono text-[10px] text-amber/80 mt-1 tracking-wider">ANALYSIS PENDING</p>
      )}
      {ready && figure.corpusTweetCount != null && figure.corpusTweetCount > 0 && (
        <p className="font-mono text-[9px] text-muted-foreground/50 mt-0.5">
          {figure.corpusTweetCount} posts in corpus
        </p>
      )}

      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 text-center overflow-hidden max-w-[220px]"
          >
            <div className="border-glow rounded p-3 bg-card/80 space-y-1">
              {ready ? (
                <>
                  <p className="font-mono text-xs text-primary">
                    DRIFT: <span className="font-bold">+{figure.driftScore}</span>
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">{figure.biggestShift}</p>
                  <p className="font-mono text-[10px] text-muted-foreground/60">
                    {figure.shiftEvents[0]?.date || "—"}
                  </p>
                </>
              ) : (
                <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
                  Open to run the full pipeline. Scraped posts stay in the database for the next run.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default FigureCard;
