import { useEffect, useRef } from "react";
import {
  CheckCircle2,
  Copy,
  FileUp,
  FolderUp,
  Loader2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import clsx from "clsx";
import { formatFileSize } from "../../utils/format";
import type { UploadItem, Visibility } from "../../types/fs";
import { VisibilityPicker } from "./VisibilityPicker";

type Props = {
  queue: UploadItem[];
  uploading: boolean;
  visibility: Visibility;
  onVisibilityChange: (next: Visibility) => void;
  onAddFiles: (files: FileList | null) => void;
  onRemoveItem: (id: string) => void;
  onClearQueue: () => void;
  onUpload: () => void;
};

function StatusIcon({ status }: { status: UploadItem["status"] }) {
  switch (status) {
    case "hashing":
    case "uploading":
      return <Loader2 className="h-3 w-3 animate-spin text-accent" aria-hidden />;
    case "done":
      return <CheckCircle2 className="h-3 w-3 text-accent" aria-hidden />;
    case "deduped":
      return <Copy className="h-3 w-3 text-accent" aria-hidden />;
    case "error":
      return <XCircle className="h-3 w-3 text-rose-400" aria-hidden />;
    default:
      return <span className="h-1 w-1 rounded-full bg-ink-dim" aria-hidden />;
  }
}

export function UploadCard({
  queue,
  uploading,
  visibility,
  onVisibilityChange,
  onAddFiles,
  onRemoveItem,
  onClearQueue,
  onUpload,
}: Props) {
  const dirInputRef = useRef<HTMLInputElement>(null);

  // webkitdirectory 는 JSX 속성으로 직접 쓸 수 없어 ref 로 설정한다.
  useEffect(() => {
    if (dirInputRef.current) {
      dirInputRef.current.setAttribute("webkitdirectory", "");
      dirInputRef.current.setAttribute("directory", "");
    }
  }, []);

  const totalBytes = queue.reduce((sum, it) => sum + it.file.size, 0);

  return (
    <section
      className="rounded-xl border border-hairline bg-surface-2 p-5"
      aria-labelledby="upload-heading"
    >
      <div className="mb-4 flex items-center gap-2">
        <Upload className="h-4 w-4 text-ink-muted" aria-hidden />
        <h2
          id="upload-heading"
          className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink-subtle"
        >
          Upload
        </h2>
      </div>

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-hairline-2 bg-surface-1 px-3 py-5 text-center transition-colors duration-200 hover:border-accent/40 hover:bg-surface-3/60">
            <FileUp className="mb-1.5 h-6 w-6 text-ink-dim" strokeWidth={1.5} />
            <span className="text-sm font-medium text-ink">Choose files</span>
            <span className="mt-0.5 font-mono text-[11px] text-ink-subtle">
              multi-select ok
            </span>
            <input
              type="file"
              multiple
              className="sr-only"
              onChange={(e) => {
                onAddFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>

          <label className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-hairline-2 bg-surface-1 px-3 py-5 text-center transition-colors duration-200 hover:border-accent/40 hover:bg-surface-3/60">
            <FolderUp
              className="mb-1.5 h-6 w-6 text-ink-dim"
              strokeWidth={1.5}
            />
            <span className="text-sm font-medium text-ink">Choose folder</span>
            <span className="mt-0.5 font-mono text-[11px] text-ink-subtle">
              structure preserved
            </span>
            <input
              ref={dirInputRef}
              type="file"
              multiple
              className="sr-only"
              onChange={(e) => {
                onAddFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        <VisibilityPicker
          value={visibility}
          onChange={onVisibilityChange}
          disabled={uploading}
        />

        {queue.length > 0 && (
          <div className="rounded-md border border-hairline bg-surface-1">
            <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-subtle">
                queue {queue.length} · {formatFileSize(totalBytes)}
              </span>
              <button
                type="button"
                onClick={onClearQueue}
                disabled={uploading}
                className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-dim transition-colors duration-200 hover:text-ink disabled:opacity-50"
              >
                clear
              </button>
            </div>
            <ul className="max-h-44 divide-y divide-hairline overflow-y-auto">
              {queue.map((it) => (
                <li
                  key={it.id}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs"
                >
                  <StatusIcon status={it.status} />
                  <span
                    className={clsx(
                      "min-w-0 flex-1 truncate",
                      it.status === "error" ? "text-rose-300" : "text-ink-muted"
                    )}
                    title={it.error || it.relPath}
                  >
                    {it.relPath}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-ink-dim">
                    {formatFileSize(it.file.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveItem(it.id)}
                    disabled={uploading}
                    aria-label={`Remove ${it.relPath}`}
                    className="shrink-0 text-ink-dim transition-colors duration-200 hover:text-rose-300 disabled:opacity-50"
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="button"
          onClick={onUpload}
          disabled={queue.length === 0 || uploading}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-canvas transition-colors duration-200 hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-dim"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <FileUp className="h-4 w-4" aria-hidden />
          )}
          {uploading
            ? "Uploading…"
            : `Upload ${queue.length || ""} to this folder`.trim()}
        </button>
      </div>
    </section>
  );
}
