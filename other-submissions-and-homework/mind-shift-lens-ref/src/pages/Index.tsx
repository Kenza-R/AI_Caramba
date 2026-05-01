import { motion } from "framer-motion";
import ParticleBackground from "@/components/ParticleBackground";
import TypewriterText from "@/components/TypewriterText";
import FigureCard from "@/components/FigureCard";
import TerminalSearch from "@/components/TerminalSearch";
import Navbar from "@/components/Navbar";
import { featuredFigures } from "@/data/mockData";

const Index = () => {
  return (
    <div className="min-h-screen bg-background grid-bg relative">
      <ParticleBackground />
      <Navbar />

      {/* Hero */}
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
        </motion.div>

        {/* Featured Figures */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.8 }}
          className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 max-w-4xl"
        >
          {featuredFigures.map((fig, i) => (
            <FigureCard key={fig.id} figure={fig} index={i} />
          ))}
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2, duration: 0.6 }}
          className="mt-20 w-full max-w-2xl"
        >
          <TerminalSearch />
        </motion.div>

        {/* Scroll hint */}
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
