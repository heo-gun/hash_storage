import { motion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import { Link } from "react-router-dom";
import { HashDedupAnimation } from "./HashDedupAnimation";

const ease = [0.22, 1, 0.36, 1] as const;

export function Hero() {
  return (
    <section className="relative pt-40 pb-section overflow-hidden">
      {/* Hash watermark background */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none select-none opacity-[0.035] font-mono text-[140px] leading-none text-ink whitespace-nowrap overflow-hidden"
      >
        <div className="-rotate-[8deg] translate-y-12">
          7a3f8b2e1d9c4f5a6b8c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a
        </div>
        <div className="-rotate-[8deg] mt-8 -translate-x-20">
          b2f04ca1e8d77361029384756afcde012345678901234567890abcdef1234567
        </div>
      </div>

      <div className="relative mx-auto max-w-6xl px-6 text-center">
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
          className="inline-flex items-center gap-2 mb-6"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          <span className="font-mono text-[11px] font-medium tracking-[0.18em] uppercase text-ink-subtle">
            Content-Addressed Storage
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease, delay: 0.08 }}
          className="text-5xl sm:text-6xl lg:text-7xl font-semibold text-ink leading-[1.02] tracking-tightest-4"
        >
          Identified by hash. <br className="hidden sm:block" />
          <span className="text-ink-muted">Stored exactly once.</span>
        </motion.h1>

        {/* Subhead */}
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease, delay: 0.16 }}
          className="mt-6 max-w-2xl mx-auto text-lg text-ink-muted leading-relaxed tracking-tightest-3"
        >
          castor computes SHA-256 in your browser before upload.
          Duplicate content is linked, not re-stored. Share with expiry,
          view limits, and tamper-evident watermarks.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease, delay: 0.24 }}
          className="mt-9 flex items-center justify-center gap-3"
        >
          <Link
            to="/signup"
            className="group inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-canvas font-medium text-sm h-11 px-6 rounded-full transition-colors duration-200 ease-out-soft"
          >
            Start for free
            <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-out-soft group-hover:translate-x-0.5" />
          </Link>
          <a
            href="#how-it-works"
            className="inline-flex items-center gap-2 bg-surface-2 hover:bg-surface-3 text-ink border border-hairline-2 font-medium text-sm h-11 px-6 rounded-full transition-colors duration-200 ease-out-soft"
          >
            <Play className="h-3.5 w-3.5" />
            See how it works
          </a>
        </motion.div>

        {/* Hero animation */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease, delay: 0.36 }}
          className="mt-20"
        >
          <HashDedupAnimation />
        </motion.div>
      </div>
    </section>
  );
}
