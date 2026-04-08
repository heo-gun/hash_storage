import { FolderInput, FolderPlus } from "lucide-react";

type Props = {
  folderName: string;
  onFolderNameChange: (value: string) => void;
  onSubmit: () => void;
};

export function FolderCreateCard({
  folderName,
  onFolderNameChange,
  onSubmit,
}: Props) {
  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      aria-labelledby="folder-create-heading"
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
          <FolderPlus className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2
            id="folder-create-heading"
            className="text-base font-semibold text-slate-900"
          >
            새 폴더
          </h2>
          <p className="text-xs text-slate-500">
            현재 위치 아래에 빈 폴더를 만듭니다.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="folder-name">
          폴더 이름
        </label>
        <input
          id="folder-name"
          value={folderName}
          onChange={(e) => onFolderNameChange(e.target.value)}
          placeholder="예: 문서, 이미지"
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm outline-none ring-indigo-500/0 transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
        />
        <button
          type="button"
          onClick={onSubmit}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.99]"
        >
          <FolderInput className="h-4 w-4" aria-hidden />
          만들기
        </button>
      </div>
    </section>
  );
}
