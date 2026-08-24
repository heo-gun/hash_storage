/* Hallmark · macrostructure: map-diagram · pre-emit critique: P5 H5 E4 S5 R4 V5 */
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

import { HashDedupAnimation } from "./HashDedupAnimation";

const ease = [0.22, 1, 0.36, 1] as const;

export function Hero() {
  return (
    <section className="border-b border-hairline pt-32 pb-20">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,9fr)] lg:items-end">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-subtle">
            Two paths · one object
          </p>
          <h1 className="mt-5 text-5xl font-semibold leading-[1.02] tracking-tightest-4 text-ink sm:text-6xl">
            Files are addressed
            <br />
            by what they contain.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed tracking-tightest-3 text-ink-muted">
            castor hashes a file in your browser before upload. Matching bytes
            are linked, never stored twice.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link
              to="/signup"
              className="inline-flex h-11 items-center rounded-full border border-accent px-6 text-sm font-medium text-accent transition-colors duration-200 ease-out-soft hover:bg-accent hover:text-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Start storing
            </Link>
            <a
              href="#map"
              className="text-sm font-medium text-ink-muted underline decoration-hairline-2 underline-offset-4 transition-colors duration-200 ease-out-soft hover:text-ink"
            >
              See the map
            </a>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, ease, delay: 0.15 }}
        >
          <HashDedupAnimation />
        </motion.div>
      </div>
    </section>
  );
}
