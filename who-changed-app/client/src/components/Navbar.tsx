import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const Navbar = () => {
  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 frosted-glass border-b border-primary/10"
    >
      <div className="container mx-auto px-6 py-3 flex items-start justify-start">
        <div className="flex flex-col items-start gap-1">
          <Link to="/" className="flex items-center gap-2 leading-none">
            <span className="font-mono text-5xl font-semibold text-primary glow-cyan-text tracking-wider">
              ΨSHIFT
            </span>
          </Link>
          <Link
            to="/about"
            className="mt-1 ml-1 px-4 py-2 border border-primary/40 rounded font-mono text-sm tracking-widest text-primary hover:bg-primary/10 transition-all"
          >
            ABOUT
          </Link>
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;
