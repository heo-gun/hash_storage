import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const ease = [0.22, 1, 0.36, 1] as const;

const HOLDS = [
  "Policy checks and the view counter run in one locked transaction.",
  "The encrypted copy is built per request and never stored.",
  "Named recipients must sign in as that address.",
  "Revoked and unknown tokens answer the same way.",
];

const DOES_NOT = [
  "Screenshots and photographs of the screen.",
  "A recipient reading the key out of their own browser.",
  "Right-click blocking — a deterrent, not a boundary.",
];

export function Limits() {
  return (
    <section id="limits" className="py-section">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-12 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, ease }}
          >
            <ul className="flex flex-col gap-3">
              {HOLDS.map((line) => (
                <li
                  key={line}
                  className="flex gap-3 text-sm leading-relaxed text-ink-muted"
                >
                  <span aria-hidden className="mt-2 h-px w-4 shrink-0 bg-accent" />
                  {line}
                </li>
              ))}
            </ul>

            <ul className="mt-8 flex flex-col gap-3 border-t border-hairline pt-8">
              {DOES_NOT.map((line) => (
                <li
                  key={line}
                  className="flex gap-3 text-sm leading-relaxed text-ink-subtle"
                >
                  <span aria-hidden className="mt-2 h-px w-4 shrink-0 bg-ink-dim" />
                  {line}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Heading anchors the base of the section — content reads upward into it. */}
          <div className="flex flex-col justify-end">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-subtle">
              What holds · what does not
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tightest-4 text-ink sm:text-4xl">
              A shared file can still be
              <span className="block text-ink-muted">photographed off a screen.</span>
            </h2>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-ink-muted">
              So the last line of defence is attribution: every page carries the
              recipient and the time it was opened.
            </p>
            <Link
              to="/signup"
              className="mt-8 inline-flex h-11 w-fit items-center rounded-full border border-accent px-6 text-sm font-medium text-accent transition-colors duration-200 ease-out-soft hover:bg-accent hover:text-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
