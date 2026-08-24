import { motion } from "framer-motion";

const ease = [0.22, 1, 0.36, 1] as const;

const UPLOAD = [
  ["Browser", "SHA-256 over the bytes, before anything is sent."],
  ["Server", "Looks the hash up in file_blobs."],
  ["S3", "Written only on a miss. A hit costs no storage."],
  ["Tree", "A node in fs_nodes points at the object."],
];

const SHARE = [
  ["Grant", "One token per recipient. 256 bits, unguessable."],
  ["Policy", "Expiry, view and print limits, revocation."],
  ["Stream", "The file is wrapped in AES-256-GCM per request."],
  ["Viewer", "Canvas render, watermark, no text layer."],
];

function Flow({ title, note, steps }: { title: string; note: string; steps: string[][] }) {
  return (
    <div>
      <h3 className="text-xl font-semibold tracking-tightest-3 text-ink">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">{note}</p>

      <ol className="mt-7 flex flex-col">
        {steps.map(([stage, body], i) => (
          <li
            key={stage}
            className="grid grid-cols-[minmax(0,88px)_minmax(0,1fr)] gap-4 border-t border-hairline py-4"
          >
            <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-accent">
              {stage}
            </span>
            <span className="text-sm leading-relaxed text-ink-muted">
              {body}
              {i === steps.length - 1 && (
                <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.15em] text-ink-dim">
                  end of path
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function Paths() {
  return (
    <section id="paths" className="border-b border-hairline bg-surface-1 py-section">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease }}
          className="mb-14 max-w-xl"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-subtle">
            Two paths
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tightest-4 text-ink sm:text-4xl">
            What happens to a file, in order.
          </h2>
        </motion.div>

        <div className="grid gap-x-14 gap-y-16 md:grid-cols-2">
          <Flow
            title="Upload"
            note="Deduplication is decided before the first byte leaves the browser."
            steps={UPLOAD}
          />
          <Flow
            title="Share"
            note="Only PDFs and images. Every open is checked against the grant."
            steps={SHARE}
          />
        </div>
      </div>
    </section>
  );
}
