import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";

const About = () => {
  return (
    <div className="min-h-screen bg-background grid-bg">
      <Navbar />
      <main className="pt-24 pb-16 px-4 md:px-8 max-w-4xl mx-auto">
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="border border-primary/15 bg-card/30 rounded-xl p-6 md:p-8 mb-8">
            <p className="font-mono text-[11px] tracking-[0.2em] text-primary/80 mb-3">SYSTEM PROFILE // SHIFT</p>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">ABOUT</h1>
            <p className="font-mono text-xs text-muted-foreground/80">
              MODE: OBSERVATIONAL ANALYSIS | INPUT: PUBLIC STATEMENTS | WINDOW: MULTI-YEAR
            </p>
          </div>

          <div className="space-y-6 text-primary leading-relaxed">
            <div className="border border-primary/10 bg-card/20 rounded-lg p-5">
              <p>
              SHIFT is an AI-powered platform that tracks, quantifies, and explains how public figures change their political views over time.
              Instead of simply summarizing opinions, SHIFT identifies when a shift occurs, how significant it is, and what evidence supports it.
              It transforms vague claims like "they changed their mind" into a clear, verifiable narrative backed by real data.
              </p>
            </div>

            <section className="border border-primary/10 bg-card/20 rounded-lg p-5">
              <h2 className="font-mono text-sm tracking-widest text-foreground mb-3">WHAT YOU GET</h2>
              <ul className="space-y-1 list-disc pl-5">
                <li>Ideological drift, mapped on a continuous spectrum</li>
                <li>Issue-level analysis across topics like economy, immigration, climate, healthcare</li>
                <li>Inflection points, where meaningful changes occur</li>
                <li>A timeline of belief evolution</li>
                <li>Side-by-side evidence, showing what was said before vs after</li>
              </ul>
            </section>

            <section className="border border-primary/10 bg-card/20 rounded-lg p-5">
              <h2 className="font-mono text-sm tracking-widest text-foreground mb-3">WHY IT MATTERS</h2>
              <p>
                Because "I never said that" is easier to claim
                <br />
                when no one is keeping track.
              </p>
              <p className="mt-3">SHIFT makes political change:</p>
              <ul className="space-y-1 list-disc pl-5 mt-2">
                <li>visible</li>
                <li>measurable</li>
                <li>hard to ignore</li>
              </ul>
            </section>

            <section className="border border-primary/10 bg-card/20 rounded-lg p-5">
              <h2 className="font-mono text-sm tracking-widest text-foreground mb-3">WHAT MAKES SHIFT DIFFERENT</h2>
              <ul className="space-y-1 list-disc pl-5">
                <li>Focus on change, not just classification</li>
                <li>Combine quantitative signals with real evidence</li>
                <li>Highlight contradictions, not just trends</li>
                <li>Multi-layer analysis across time and issues</li>
              </ul>
            </section>

            <section className="border border-primary/10 bg-card/20 rounded-lg p-5">
              <h2 className="font-mono text-sm tracking-widest text-foreground mb-3">HOW IT WORKS</h2>
              <p>
                SHIFT analyzes large-scale public statements using advanced language models to classify stance and track how it evolves over time.
                Each detected shift is aligned with specific statements, allowing users to directly observe how positions change across different moments.
              </p>
              <div className="mt-4 border border-primary/15 rounded p-3 bg-background/50 font-mono text-[11px] text-muted-foreground/90">
                {"ingest -> classify -> compare windows -> detect shifts -> attach evidence -> generate narrative"}
              </div>
            </section>

            <section className="border border-primary/10 bg-card/20 rounded-lg p-5">
              <h2 className="font-mono text-sm tracking-widest text-foreground mb-3">Neutrality & Scope</h2>
              <p>
                SHIFT is a neutral, observational tool.
                <br />
                It does not endorse, oppose, or evaluate any political position or individual.
              </p>
              <p className="mt-3">
                All outputs are generated through automated analysis of publicly available statements and are provided for informational purposes only.
                SHIFT identifies patterns and changes in language over time, but does not infer intent, motivation, or causality.
              </p>
              <p className="mt-3">
                While we strive for accuracy, results may be affected by data limitations, model interpretation, and context.
                Users should interpret outputs with appropriate caution.
              </p>
            </section>
          </div>

          <Link to="/" className="inline-block mt-10 font-mono text-xs tracking-widest text-muted-foreground hover:text-primary transition-colors">
            ← RETURN
          </Link>
        </motion.section>
      </main>
    </div>
  );
};

export default About;
