import { FileUp, Loader2 } from "lucide-react";
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
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      aria-labelledby="upload-heading"
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
          <FileUp className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2
            id="upload-heading"
            className="text-base font-semibold text-slate-900"
          >
            파일 업로드
          </h2>
          <p className="text-xs text-slate-500">
            SHA-256 해시로 중복 여부를 판단한 뒤 저장합니다.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 transition hover:border-emerald-300 hover:bg-emerald-50/30">
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
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45 active:scale-[0.99]"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <FileUp className="h-4 w-4" aria-hidden />
          )}
          이 폴더에 업로드
        </button>
      </div>
    </section>
  );
}
