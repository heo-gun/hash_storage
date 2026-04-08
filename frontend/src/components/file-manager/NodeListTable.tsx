import {
  Download,
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
    <section className="p-5 sm:p-6" aria-labelledby="list-heading">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-slate-600" aria-hidden />
          <h2
            id="list-heading"
            className="text-lg font-semibold text-slate-900"
          >
            이 폴더 안의 항목
          </h2>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700">
            폴더 {folderCount}
          </span>
          <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700">
            파일 {fileCount}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 py-16 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          불러오는 중…
        </div>
      ) : nodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-16 text-center">
          <Inbox
            className="mb-3 h-12 w-12 text-slate-300"
            strokeWidth={1.25}
            aria-hidden
          />
          <p className="font-medium text-slate-700">항목이 없습니다</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            폴더를 만들거나 파일을 업로드하면 여기 표시됩니다.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">이름</th>
                <th className="hidden px-4 py-3 sm:table-cell">유형</th>
                <th className="hidden px-4 py-3 md:table-cell">해시 (앞부분)</th>
                <th className="px-4 py-3 text-right">동작</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {nodes.map((node) => (
                <tr
                  key={node.node_id}
                  className={clsx(
                    "transition hover:bg-slate-50/80",
                    node.node_type === "folder" && "bg-blue-50/40"
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {node.node_type === "folder" ? (
                        <FolderOpen className="h-4 w-4 shrink-0 text-blue-600" />
                      ) : (
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-slate-500">
                          <span className="text-xs" aria-hidden>
                            📄
                          </span>
                        </span>
                      )}
                      <span className="font-medium text-slate-900">
                        {node.name}
                      </span>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <span
                      className={clsx(
                        "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
                        node.node_type === "folder"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-slate-200/80 text-slate-800"
                      )}
                    >
                      {node.node_type === "folder" ? "폴더" : "파일"}
                    </span>
                  </td>
                  <td className="hidden font-mono text-xs text-slate-500 md:table-cell">
                    {node.hash_id ? `${node.hash_id.slice(0, 16)}…` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      {node.node_type === "folder" && (
                        <button
                          type="button"
                          onClick={() => onOpenFolder(node)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
                        >
                          안으로 들어가기
                        </button>
                      )}
                      {node.node_type === "file" && (
                        <button
                          type="button"
                          onClick={() => onDownload(node)}
                          className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-900 transition hover:bg-indigo-100"
                        >
                          <Download className="h-3.5 w-3.5" aria-hidden />
                          받기
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onDelete(node)}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-800 transition hover:bg-red-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        삭제
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
