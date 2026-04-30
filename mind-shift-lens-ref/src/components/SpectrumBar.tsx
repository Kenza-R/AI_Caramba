import { motion } from "framer-motion";

interface Props {
  score2022: number; // 0-100
  scoreNow: number;  // 0-100
  drift: number;
}

const labels = ["Far Left", "Left", "Center-Left", "Center", "Center-Right", "Right", "Far Right"];

const SpectrumBar = ({ score2022, scoreNow, drift }: Props) => {
  return (
    <div className="w-full">
      {/* Bar */}
      <div className="relative h-8 rounded-sm overflow-hidden mb-2">
        {/* Gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(90deg, hsl(220, 80%, 40%), hsl(260, 50%, 35%), hsl(0, 70%, 40%))",
          }}
        />

        {/* 2022 marker (ghost) */}
        <motion.div
          initial={{ left: "50%" }}
          animate={{ left: `${score2022}%` }}
          transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }}
          className="absolute top-0 h-full w-0.5 z-10"
          style={{ borderLeft: "2px dashed hsla(0, 0%, 100%, 0.4)" }}
        >
          <span className="absolute -top-6 left-1/2 -translate-x-1/2 font-mono text-[10px] text-muted-foreground">
            2022
          </span>
        </motion.div>

        {/* NOW marker */}
        <motion.div
          initial={{ left: "50%" }}
          animate={{ left: `${scoreNow}%` }}
          transition={{ delay: 0.8, duration: 1.2, ease: "easeOut" }}
          className="absolute top-0 h-full z-20"
        >
          <div className="w-3 h-full bg-foreground rounded-sm shadow-lg animate-pulse-glow relative">
            <span className="absolute -top-6 left-1/2 -translate-x-1/2 font-mono text-[10px] text-primary font-bold whitespace-nowrap">
              NOW
            </span>
          </div>
        </motion.div>

        {/* Arrow connection */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="absolute top-1/2 -translate-y-1/2 z-15"
          style={{
            left: `${Math.min(score2022, scoreNow)}%`,
            width: `${Math.abs(scoreNow - score2022)}%`,
          }}
        >
          <div className="h-0.5 bg-primary/40 w-full" />
        </motion.div>
      </div>

      {/* Labels */}
      <div className="flex justify-between px-1">
        {labels.map(l => (
          <span key={l} className="font-mono text-[9px] text-muted-foreground/50">{l}</span>
        ))}
      </div>

      {/* Drift label */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.2 }}
        className="text-center mt-3"
      >
        <span className="font-mono text-xs text-amber">
          Drifted {drift > 0 ? "+" : ""}{drift.toFixed(1)} pts →
        </span>
      </motion.div>
    </div>
  );
};

export default SpectrumBar;
