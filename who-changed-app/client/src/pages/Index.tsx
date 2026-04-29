import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import ParticleBackground from "@/components/ParticleBackground";
import TypewriterText from "@/components/TypewriterText";
import FigureCard from "@/components/FigureCard";
import TerminalSearch from "@/components/TerminalSearch";
import Navbar from "@/components/Navbar";
import { fetchFeaturedFigures, type Figure } from "@/data/mockData";

const Index = () => {
  const [figures, setFigures] = useState<Figure[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await fetchFeaturedFigures();
        if (!cancelled) setFigures(rows);
      } catch {
        if (!cancelled) setFigures([]);
      }
    };
    load();
    const t = setInterval(load, 12000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background grid-bg relative">
      <ParticleBackground />
      <Navbar />

      <section className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
          className="text-center"
        >
          <h1 className="font-display text-5xl md:text-7xl font-bold mb-4 text-foreground">
            <TypewriterText text="WHO CHANGED THEIR MIND?" speed={50} />
          </h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            transition={{ delay: 2.5, duration: 1 }}
            className="font-mono text-xs md:text-sm text-muted-foreground tracking-wider"
          >
            // AI-powered ideological drift analysis • public figures • 3-year range
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.9, duration: 0.8 }}
            className="mt-3 text-base md:text-lg font-bold text-white whitespace-pre-line"
          >
            {"We don't tell you what to think.\nWe show you what was said."}
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.8 }}
          className="mt-16 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 md:gap-10 max-w-6xl w-full px-2"
        >
          {figures.map((fig, i) => (
            <FigureCard key={fig.id} figure={fig} index={i} />
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2, duration: 0.6 }}
          className="mt-20 w-full max-w-2xl"
        >
          <TerminalSearch />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ delay: 3 }}
          className="absolute bottom-8 font-mono text-xs text-muted-foreground"
        >
          ▼ SELECT A TARGET TO BEGIN ▼
        </motion.div>
      </section>
    </div>
  );
};

export default Index;
