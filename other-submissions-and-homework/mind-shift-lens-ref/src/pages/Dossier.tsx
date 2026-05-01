import { useParams, Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import SpectrumBar from "@/components/SpectrumBar";
import IssuesGrid from "@/components/IssuesGrid";
import ShiftTimeline from "@/components/ShiftTimeline";
import TypewriterText from "@/components/TypewriterText";
import { getFigureById } from "@/data/mockData";
import { useState } from "react";

const Dossier = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  // Prefer live analysis result passed via router state; fall back to mock data
  const figure = (location.state as { figure?: ReturnType<typeof getFigureById> } | null)?.figure
    ?? getFigureById(id || "");
  const [showRaw, setShowRaw] = useState(false);

  if (!figure) {
    return (
      <div className="min-h-screen bg-background grid-bg flex items-center justify-center">
        <div className="text-center">
          <p className="font-mono text-destructive text-lg animate-pulse">ERROR: TARGET NOT FOUND // RETRY?</p>
          <Link to="/" className="font-mono text-xs text-primary mt-4 inline-block hover:underline">← RETURN TO OVERVIEW</Link>
        </div>
      </div>
    );
  }

  const initials = figure.name.split(" ").map(n => n[0]).join("");
  const drift = ((figure.positionScoreNow - figure.positionScore2022) / 10);

  return (
    <div className="min-h-screen bg-background grid-bg">
      <Navbar />

      <div className="pt-20 pb-16 px-4 md:px-8 max-w-5xl mx-auto">
        {/* Back */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
          <Link to="/" className="font-mono text-xs tracking-widest text-muted-foreground hover:text-primary transition-colors">
            ← RETURN TO OVERVIEW
          </Link>
        </motion.div>

        {/* Panel 1: Subject Header */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-glow rounded-lg p-6 md:p-8 bg-card/30 mb-1 relative overflow-hidden"
        >
          {/* Radial glow */}
          <div className="absolute top-0 left-20 w-40 h-40 rounded-full blur-3xl opacity-10" style={{ background: "hsl(185, 100%, 50%)" }} />

          <div className="flex flex-col md:flex-row items-start gap-6">
            {/* Avatar */}
            <div className="relative">
              <div className="w-24 h-24 rounded-full border border-primary/20 bg-muted flex items-center justify-center" style={{ borderStyle: "dashed" }}>
                <span className="font-display text-3xl font-bold text-foreground/60">{initials}</span>
              </div>
              <div className="absolute -inset-1 rounded-full border border-primary/10 animate-rotate-ring" style={{ borderStyle: "dashed" }} />
            </div>

            <div className="flex-1">
              <h1 className="font-display text-3xl font-bold text-foreground">{figure.name}</h1>
              <p className="font-mono text-sm text-muted-foreground">{figure.handle}</p>
              <p className="text-sm text-muted-foreground/60 mt-1">{figure.bio}</p>

              {/* Quick stats */}
              <div className="flex flex-wrap gap-2 mt-4">
                <span className="font-mono text-[11px] px-3 py-1 rounded-full border border-primary/20 text-muted-foreground">
                  📍 {figure.currentPosition}
                </span>
                <span className="font-mono text-[11px] px-3 py-1 rounded-full border border-amber/20 text-amber">
                  📈 {figure.driftDirection}
                </span>
                <span className="font-mono text-[11px] px-3 py-1 rounded-full border border-primary/20 text-muted-foreground">
                  🔺 {figure.biggestShift} (+{figure.biggestShiftScore})
                </span>
              </div>
            </div>

            {/* Clearance badge */}
            <div className="font-mono text-[10px] text-muted-foreground/60 text-right space-y-0.5 border border-primary/10 rounded p-3 bg-card/50">
              <p>ANALYSIS RANGE: JAN 2022 – APR 2025</p>
              <p>CONFIDENCE: <span className="text-secondary">{figure.confidencePercent}%</span></p>
              <p>STATUS: <span className="text-secondary">COMPLETE</span></p>
            </div>
          </div>
        </motion.section>

        {/* Divider */}
        <Divider />

        {/* Panel 2: Spectrum Bar */}
        <motion.section
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="py-8 px-2"
        >
          <SectionTitle text="POLITICAL SPECTRUM POSITION" />
          <SpectrumBar score2022={figure.positionScore2022} scoreNow={figure.positionScoreNow} drift={drift} />
        </motion.section>

        <Divider />

        {/* Panel 3: Issues Grid */}
        <motion.section
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="py-8"
        >
          <SectionTitle text="ISSUE STANCE ANALYSIS" />
          <IssuesGrid topics={figure.topics} />
        </motion.section>

        <Divider />

        {/* Panel 4: Timeline */}
        <motion.section
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="py-8"
        >
          <SectionTitle text="SHIFT TIMELINE" />
          <ShiftTimeline events={figure.shiftEvents} />
        </motion.section>

        <Divider />

        {/* Panel 5: Synthesis */}
        <motion.section
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="py-8"
        >
          <SectionTitle text="// ANALYST SUMMARY" />
          <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
            <TypewriterText text={figure.synthesis} speed={8} showCursor={false} />
          </div>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 0.4 }}
            viewport={{ once: true }}
            transition={{ delay: 3 }}
            className="font-mono text-[10px] text-muted-foreground/40 mt-6 border-t border-primary/10 pt-3"
          >
            — Generated by AI. This represents an interpretation of public statements, not verified truth.
          </motion.p>
        </motion.section>

        <Divider />

        {/* Panel 6: Raw Data */}
        <section className="py-8">
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="font-mono text-xs text-muted-foreground/50 hover:text-primary transition-colors"
          >
            [{showRaw ? "−" : "+"}] VIEW RAW SIGNAL DATA
          </button>
          {showRaw && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-4 space-y-4 overflow-hidden"
            >
              <div className="border-glow rounded p-4 bg-card/30">
                <p className="font-mono text-[10px] text-muted-foreground/50 mb-3">CONFIDENCE SCORES BY TOPIC</p>
                {figure.topics.map(t => (
                  <div key={t.topic} className="flex items-center gap-3 mb-2">
                    <span className="font-mono text-[11px] text-muted-foreground w-32">{t.topic}</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary/60 rounded-full" style={{ width: `${60 + Math.random() * 35}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="font-mono text-[10px] text-muted-foreground/30">
                Data sourced from public posts. Analysis powered by Claude.
              </p>
            </motion.div>
          )}
        </section>
      </div>
    </div>
  );
};

const Divider = () => (
  <div className="flex items-center gap-2 py-1">
    <div className="flex-1 h-px bg-primary/10" />
    <div className="w-2 h-2 rotate-45 border border-primary/20" />
    <div className="flex-1 h-px bg-primary/10" />
  </div>
);

const SectionTitle = ({ text }: { text: string }) => (
  <h2 className="font-mono text-xs tracking-[0.2em] text-muted-foreground/60 mb-6">{text}</h2>
);

export default Dossier;
