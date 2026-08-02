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

/**
 * 실제 저장소 대신 보여주기용 트리. 요점은 하나다 —
 * spec.pdf 는 세 폴더에 있지만 hash 가 같아서 노드는 **하나**다.
 */
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
    // 같은 내용이 세 경로에 — 저장은 한 벌
    row("spec.pdf", "file", portfolio.node_id, SPEC, 2_400_000),
    row("spec.pdf", "file", archive.node_id, SPEC, 2_400_000),
    row("spec-final.pdf", "file", design.node_id, SPEC, 2_400_000),
    // 두 경로에
    row("logo.png", "file", portfolio.node_id, LOGO, 180_000),
    row("logo.png", "file", design.node_id, LOGO, 180_000),
    // 나머지는 유일한 파일
    row("notes.md", "file", portfolio.node_id, "1111aaaa2222bbbb", 4_100),
    row("budget.xlsx", "file", team.node_id, "3333cccc4444dddd", 52_000),
    row("old-deck.pdf", "file", archive.node_id, "5555eeee6666ffff", 1_200_000),
    row("mockup.png", "file", design.node_id, "7777aaaa8888bbbb", 640_000),
  ];
}

export function GraphShowcase() {
  const graph = useMemo(() => buildGraph(demoRows(), "castor"), []);

  return (
    <section id="graph" className="py-section">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease }}
          className="max-w-2xl"
        >
          <span className="font-mono text-[11px] font-medium tracking-[0.18em] uppercase text-ink-subtle">
            Graph view
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-semibold text-ink tracking-tightest-4">
            같은 파일은 한 번만 저장됩니다.
            <br />
            <span className="text-ink-muted">그래서 노드도 하나입니다.</span>
          </h2>
          <p className="mt-5 text-lg text-ink-muted leading-relaxed tracking-tightest-3">
            폴더 트리는 경로를 보여줄 뿐입니다. castor 는 내용의 SHA-256 으로
            파일을 식별하기 때문에, 세 폴더에 놓인 같은 문서는 세 개의 사본이
            아니라 <strong className="text-ink">세 개의 부모를 가진 하나의
            노드</strong>가 됩니다. 아래 그래프에서 주황색 노드가 그것입니다.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease, delay: 0.1 }}
          className="mt-10 rounded-2xl border border-hairline bg-surface-1 p-5"
        >
          <LazyForceGraph graph={graph} height={440} />
        </motion.div>
      </div>
    </section>
  );
}
