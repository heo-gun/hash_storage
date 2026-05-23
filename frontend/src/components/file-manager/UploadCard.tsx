import { FileUp, Loader2, Upload } from "lucide-react";
import { UploadIconLabel } from "./UploadIconLabel";

type Props = {
  selectedFile: File | null;
  loading: boolean;
  onFileChange: (file: File | null) => void;
  onUpload: () => void;
};

export function UploadCard({
  selectedFile,
  loading,
  onFileChange,
  onUpload,
}: Props) {
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
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-hairline-2 bg-surface-1 px-4 py-6 transition-colors duration-200 hover:border-accent/40 hover:bg-surface-3/60">
          <UploadIconLabel file={selectedFile} />
          <input
            type="file"
            className="sr-only"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          />
        </label>
        <button
          type="button"
          onClick={onUpload}
          disabled={!selectedFile || loading}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-canvas transition-colors duration-200 hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-dim"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <FileUp className="h-4 w-4" aria-hidden />
          )}
          Upload to this folder
        </button>
      </div>
    </section>
  );
}
