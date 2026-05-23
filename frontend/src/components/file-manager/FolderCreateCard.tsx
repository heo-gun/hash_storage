import { FolderPlus } from "lucide-react";

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
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && folderName.trim()) {
      onSubmit();
    }
  }

  return (
    <section
      className="rounded-xl border border-hairline bg-surface-2 p-5"
      aria-labelledby="folder-create-heading"
    >
      <div className="mb-4 flex items-center gap-2">
        <FolderPlus className="h-4 w-4 text-ink-muted" aria-hidden />
        <h2
          id="folder-create-heading"
          className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink-subtle"
        >
          New folder
        </h2>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="folder-name">
          폴더 이름
        </label>
        <input
          id="folder-name"
          value={folderName}
          onChange={(e) => onFolderNameChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="folder name"
          className="min-w-0 flex-1 rounded-md border border-hairline bg-surface-1 px-3 py-2 text-sm text-ink placeholder:text-ink-dim transition-colors duration-200 focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={onSubmit}
          className="inline-flex shrink-0 items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-canvas transition-colors duration-200 hover:bg-accent-hover"
        >
          Create
        </button>
      </div>
    </section>
  );
}
