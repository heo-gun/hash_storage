import {
  Download,
  File as FileIcon,
  FolderOpen,
  Inbox,
  Loader2,
  Trash2,
} from "lucide-react";
import clsx from "clsx";
import type { FsNode } from "../../types/fs";

type Props = {
  nodes: FsNode[];
  loading: boolean;
  folderCount: number;
  fileCount: number;
  onOpenFolder: (node: FsNode) => void;
  onDownload: (node: FsNode) => void;
  onDelete: (node: FsNode) => void;
};

export function NodeListTable({
  nodes,
  loading,
  folderCount,
  fileCount,
  onOpenFolder,
  onDownload,
  onDelete,
}: Props) {
  return (
    <section className="p-6" aria-labelledby="list-heading">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <h2
          id="list-heading"
          className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink-subtle"
        >
          Contents
        </h2>
        <div className="flex gap-2 font-mono text-[11px]">
          <span className="rounded-xs border border-hairline bg-surface-2 px-2 py-0.5 text-ink-muted">
            folders {folderCount}
          </span>
          <span className="rounded-xs border border-hairline bg-surface-2 px-2 py-0.5 text-ink-muted">
            files {fileCount}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-md border border-dashed border-hairline bg-surface-2/30 py-16 text-ink-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          <span className="text-sm">Loading…</span>
        </div>
      ) : nodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-hairline bg-surface-2/30 py-16 text-center">
          <Inbox
            className="mb-3 h-10 w-10 text-ink-dim"
            strokeWidth={1.25}
            aria-hidden
          />
          <p className="text-sm font-medium text-ink-muted">Nothing here yet</p>
          <p className="mt-1 max-w-sm text-sm text-ink-subtle">
            Create a folder or upload a file to get started.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-hairline">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-hairline bg-surface-2/60 font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-ink-subtle">
                <th className="px-4 py-3">Name</th>
                <th className="hidden px-4 py-3 sm:table-cell">Type</th>
                <th className="hidden px-4 py-3 md:table-cell">Hash</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {nodes.map((node) => (
                <tr
                  key={node.node_id}
                  className={clsx(
                    "transition-colors duration-150 hover:bg-surface-2/40"
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      {node.node_type === "folder" ? (
                        <FolderOpen
                          className="h-4 w-4 shrink-0 text-accent"
                          strokeWidth={1.75}
                        />
                      ) : (
                        <FileIcon
                          className="h-4 w-4 shrink-0 text-ink-dim"
                          strokeWidth={1.75}
                        />
                      )}
                      <span className="font-medium text-ink">{node.name}</span>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <span
                      className={clsx(
                        "inline-flex rounded-xs px-2 py-0.5 font-mono text-[11px]",
                        node.node_type === "folder"
                          ? "bg-accent/10 text-accent"
                          : "bg-surface-3 text-ink-muted"
                      )}
                    >
                      {node.node_type}
                    </span>
                  </td>
                  <td className="hidden font-mono text-[11px] text-ink-subtle md:table-cell">
                    {node.hash_id ? `${node.hash_id.slice(0, 12)}…` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      {node.node_type === "folder" && (
                        <button
                          type="button"
                          onClick={() => onOpenFolder(node)}
                          className="rounded-md border border-hairline bg-surface-2 px-3 py-1 text-xs font-medium text-ink-muted transition-colors duration-200 hover:bg-surface-3 hover:text-ink"
                        >
                          Open
                        </button>
                      )}
                      {node.node_type === "file" && (
                        <button
                          type="button"
                          onClick={() => onDownload(node)}
                          className="inline-flex items-center gap-1 rounded-md border border-hairline bg-surface-2 px-3 py-1 text-xs font-medium text-ink-muted transition-colors duration-200 hover:bg-surface-3 hover:text-ink"
                        >
                          <Download className="h-3 w-3" aria-hidden />
                          Download
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onDelete(node)}
                        className="inline-flex items-center gap-1 rounded-md border border-rose-500/20 bg-rose-500/5 px-3 py-1 text-xs font-medium text-rose-300 transition-colors duration-200 hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-3 w-3" aria-hidden />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
