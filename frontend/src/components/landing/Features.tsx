import { motion } from "framer-motion";
import { Fingerprint, ShieldCheck, GitBranch } from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;

const FEATURES = [
  {
    icon: Fingerprint,
    eyebrow: "CAS",
    title: "Content-addressed deduplication",
    body: "SHA-256 computed in the browser via Web Crypto. Identical bytes are linked to a single S3 object, regardless of who uploads them or what they name them.",
  },
  {
    icon: ShieldCheck,
    eyebrow: ".epf",
    title: "Protected sharing with policy",
    body: "Wrap PDFs and images in an encrypted container. Recipients open them in a watermarked viewer, with server-enforced expiry, view counts, and print limits.",
  },
  {
    icon: GitBranch,
    eyebrow: "Collab",
    title: "Realtime collaboration (planned)",
    body: "CRDT-backed multi-user editing via Yjs and WebSocket. Document history is tracked through S3 object versioning.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-section relative">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-16 max-w-2xl">
          <span className="font-mono text-[11px] font-medium tracking-[0.18em] uppercase text-ink-subtle">
            Features
          </span>
          <h2 className="mt-3 text-4xl sm:text-5xl font-semibold text-ink tracking-tightest-3 leading-tight">
            Built around one idea.
            <br />
            <span className="text-ink-muted">The hash is the address.</span>
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, ease, delay: i * 0.08 }}
              className="group bg-surface-1 border border-hairline hover:border-hairline-2 rounded-lg p-6 transition-colors duration-200 ease-out-soft"
            >
              <div className="h-10 w-10 rounded-md bg-accent-dim border border-accent/20 inline-flex items-center justify-center mb-5">
                <f.icon className="h-5 w-5 text-accent" strokeWidth={1.5} />
              </div>
              <div className="font-mono text-[10px] font-medium tracking-[0.18em] uppercase text-ink-subtle mb-2">
                {f.eyebrow}
              </div>
              <h3 className="text-lg font-semibold text-ink leading-snug tracking-tightest-3 mb-2">
                {f.title}
              </h3>
              <p className="text-sm text-ink-muted leading-relaxed tracking-tightest-3">
                {f.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
