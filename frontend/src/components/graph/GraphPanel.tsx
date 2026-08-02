import { useEffect, useMemo, useState } from "react";
import { Loader2, Network, RefreshCw } from "lucide-react";

import { api } from "../../services/api";
import type { BreadcrumbItem, TreeNode, TreeResponse } from "../../types/fs";
import { formatFileSize } from "../../utils/format";
import { getApiErrorMessage } from "../../utils/apiError";
import { buildGraph } from "./buildGraph";
import { LazyForceGraph } from "./LazyForceGraph";

type Props = {
  /** 그래프에서 폴더를 클릭하면 목록 뷰를 그 폴더로 옮긴다. */
  onOpenFolder: (path: BreadcrumbItem[]) => void;
};

export function GraphPanel({ onOpenFolder }: Props) {
  const [rows, setRows] = useState<TreeNode[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<TreeResponse>("/nodes/tree");
      setRows(res.data.nodes);
      setTruncated(res.data.truncated);
    } catch (e) {
      setError(getApiErrorMessage(e, "트리를 불러오지 못했습니다."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const graph = useMemo(() => (rows ? buildGraph(rows) : null), [rows]);

  const byId = useMemo(
    () => new Map((rows ?? []).map((r) => [r.node_id, r])),
    [rows]
  );

  /** 클릭한 폴더까지의 조상 경로를 breadcrumb 으로 되짚는다. */
  function handleSelectFolder(nodeId: string) {
    const path: BreadcrumbItem[] = [];
    let cursor = byId.get(nodeId);
    // 사이클은 스키마상 생기지 않지만, 무한 루프로 탭이 멎는 것보다는 낫다.
    let guard = 0;
    while (cursor && guard++ < 100) {
      path.unshift({ node_id: cursor.node_id, name: cursor.name });
      cursor = cursor.parent_id ? byId.get(cursor.parent_id) : undefined;
    }
    if (path.length > 0) onOpenFolder(path);
  }

  return (
    <section className="p-6" aria-labelledby="graph-heading">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <h2
          id="graph-heading"
          className="inline-flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink-subtle"
        >
          <Network className="h-3.5 w-3.5" aria-hidden />
          Graph
        </h2>

        <div className="flex items-center gap-2 font-mono text-[11px]">
          {graph && (
            <>
              <span className="rounded-xs border border-hairline bg-surface-2 px-2 py-0.5 text-ink-muted">
                nodes {graph.nodes.length}
              </span>
              <span className="rounded-xs border border-hairline bg-surface-2 px-2 py-0.5 text-ink-muted">
                links {graph.links.length}
              </span>
              {graph.dedupCount > 0 && (
                <span
                  className="rounded-xs border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-amber-300"
                  title="같은 내용이 여러 경로에 있어 한 벌만 저장된 파일"
                >
                  deduped {graph.dedupCount} · {formatFileSize(graph.savedBytes)}{" "}
                  절약
                </span>
              )}
            </>
          )}
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1 rounded-md border border-hairline bg-surface-2 px-2 py-0.5 text-ink-muted transition-colors duration-200 hover:bg-surface-3 hover:text-ink"
          >
            <RefreshCw className="h-3 w-3" aria-hidden />
            Reload
          </button>
        </div>
      </div>

      {truncated && (
        <p className="mb-3 rounded-md border border-hairline bg-surface-2 px-3 py-2 text-[11px] text-ink-dim">
          노드가 너무 많아 일부만 표시합니다. 화면에 보이는 것이 전체가 아닙니다.
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-md border border-dashed border-hairline bg-surface-2/30 py-24 text-ink-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          <span className="text-sm">Building graph…</span>
        </div>
      ) : error ? (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-sm text-rose-300">
          {error}
        </div>
      ) : graph && graph.nodes.length > 1 ? (
        <LazyForceGraph graph={graph} onSelectFolder={handleSelectFolder} />
      ) : (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-hairline bg-surface-2/30 py-24 text-center">
          <Network
            className="mb-3 h-10 w-10 text-ink-dim"
            strokeWidth={1.25}
            aria-hidden
          />
          <p className="text-sm font-medium text-ink-muted">
            아직 그릴 것이 없습니다
          </p>
          <p className="mt-1 max-w-sm text-sm text-ink-subtle">
            파일을 올리면 경로 구조와 중복 참조가 여기에 나타납니다.
          </p>
        </div>
      )}
    </section>
  );
}
