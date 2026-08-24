import { useMemo } from "react";
import { motion } from "framer-motion";

import { buildGraph } from "../graph/buildGraph";
import { LazyForceGraph } from "../graph/LazyForceGraph";
import type { NodeType, TreeNode, Visibility } from "../../types/fs";

const ease = [0.22, 1, 0.36, 1] as const;

let seq = 0;
function row(
  name: string,
  node_type: NodeType,
  parent_id: string | null,
  hash_id: string | null = null,
  size_bytes: number | null = null
): TreeNode {
  return {
    node_id: `demo-${++seq}-${name}`,
    parent_id,
    node_type,
    name,
    hash_id,
    visibility: "private" as Visibility,
    created_at: "2026-01-01T00:00:00Z",
    size_bytes,
    mime_type: null,
  };
}

/** spec.pdf sits in three folders and stays one node — that is the whole point. */
function demoRows(): TreeNode[] {
  seq = 0;
  const projects = row("projects", "folder", null);
  const portfolio = row("2026-portfolio", "folder", projects.node_id);
  const archive = row("archive", "folder", projects.node_id);
  const team = row("team", "folder", null);
  const design = row("design", "folder", team.node_id);

  const SPEC = "a1b2c3d4e5f60718";
  const LOGO = "9f8e7d6c5b4a3928";

  return [
    projects,
    portfolio,
    archive,
    team,
    design,
    row("spec.pdf", "file", portfolio.node_id, SPEC, 2_400_000),
    row("spec.pdf", "file", archive.node_id, SPEC, 2_400_000),
    row("spec-final.pdf", "file", design.node_id, SPEC, 2_400_000),
    row("logo.png", "file", portfolio.node_id, LOGO, 180_000),
    row("logo.png", "file", design.node_id, LOGO, 180_000),
    row("notes.md", "file", portfolio.node_id, "1111aaaa2222bbbb", 4_100),
    row("budget.xlsx", "file", team.node_id, "3333cccc4444dddd", 52_000),
    row("old-deck.pdf", "file", archive.node_id, "5555eeee6666ffff", 1_200_000),
    row("mockup.png", "file", design.node_id, "7777aaaa8888bbbb", 640_000),
  ];
}

const NOTES = [
  ["Folders", "Paths only. They hold no bytes."],
  ["Files", "A reference to one hashed object."],
  ["Shared", "Same hash, many parents. Stored once."],
];

export function GraphShowcase() {
  const graph = useMemo(() => buildGraph(demoRows(), "castor"), []);

  return (
    <section id="map" className="border-b border-hairline py-section">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease }}
          className="max-w-xl"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-subtle">
            The map
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tightest-4 text-ink sm:text-4xl">
            Three folders hold the same document.
            <span className="block text-ink-muted">One object holds it.</span>
          </h2>
        </motion.div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
          <ul className="flex flex-col gap-6 lg:pt-4">
            {NOTES.map(([term, note]) => (
              <li key={term}>
                <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-accent">
                  {term}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
                  {note}
                </p>
              </li>
            ))}
          </ul>

          <div className="rounded-xl border border-hairline bg-surface-1 p-4">
            <LazyForceGraph graph={graph} height={420} />
          </div>
        </div>
      </div>
    </section>
  );
}
