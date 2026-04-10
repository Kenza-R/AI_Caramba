import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const Navbar = () => {
  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 frosted-glass border-b border-primary/10"
    >
      <div className="container mx-auto px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="font-mono text-lg font-semibold text-primary glow-cyan-text tracking-wider">
            ΨSHIFT
          </span>
        </Link>
        <div className="flex items-center gap-6">
          <Link
            to="/"
            className="font-mono text-xs tracking-widest text-muted-foreground hover:text-primary transition-colors"
          >
            NEW ANALYSIS
          </Link>
          <span className="font-mono text-xs tracking-widest text-muted-foreground/50">
            ABOUT
          </span>
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;
