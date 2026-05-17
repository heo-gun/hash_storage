import { motion } from "framer-motion";

const ease = [0.22, 1, 0.36, 1] as const;

const STEPS = [
  {
    n: "01",
    title: "Compute hash in the browser",
    body: "Web Crypto API streams SHA-256 over the file. Nothing leaves the device yet.",
    code: `const buf = await file.arrayBuffer();
const digest = await crypto.subtle.digest("SHA-256", buf);
const hash = toHex(digest);`,
  },
  {
    n: "02",
    title: "Server checks the hash",
    body: "If the blob exists, increment ref_count. If not, upload the bytes once.",
    code: `SELECT hash_id, ref_count
  FROM file_blobs
 WHERE hash_id = $1;`,
  },
  {
    n: "03",
    title: "Tree references the blob",
    body: "fs_nodes maintains the folder hierarchy. Many nodes can point at one blob.",
    code: `INSERT INTO fs_nodes
  (parent_id, node_type, name, hash_id)
 VALUES ($1, 'file', $2, $3);`,
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-section bg-surface-1 border-y border-hairline">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-16 max-w-2xl">
          <span className="font-mono text-[11px] font-medium tracking-[0.18em] uppercase text-ink-subtle">
            How it works
          </span>
          <h2 className="mt-3 text-4xl sm:text-5xl font-semibold text-ink tracking-tightest-3 leading-tight">
            Three steps. No magic.
          </h2>
        </div>

        <div className="space-y-3">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, ease, delay: i * 0.06 }}
              className="grid md:grid-cols-2 gap-8 bg-surface-2 border border-hairline rounded-lg p-6 md:p-8"
            >
              <div>
                <div className="font-mono text-xs text-accent mb-3">{s.n}</div>
                <h3 className="text-2xl font-semibold text-ink tracking-tightest-3 leading-tight mb-3">
                  {s.title}
                </h3>
                <p className="text-ink-muted text-[15px] leading-relaxed tracking-tightest-3">
                  {s.body}
                </p>
              </div>
              <pre className="bg-canvas border border-hairline-2 rounded-md p-4 font-mono text-[12.5px] leading-relaxed text-ink-muted overflow-x-auto">
{s.code}
              </pre>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
