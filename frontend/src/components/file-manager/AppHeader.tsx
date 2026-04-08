import { HardDrive } from "lucide-react";

export function AppHeader() {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/25">
          <HardDrive className="h-7 w-7" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            파일 저장소
          </h1>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-600">
            중복 제거(CAS)와 폴더 트리로 파일을 관리합니다. 아래에서{" "}
            <strong className="font-medium text-slate-800">위치</strong>를 고른
            뒤 폴더를 만들거나 파일을 올리세요.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {["CAS 해시", "PostgreSQL", "MinIO"].map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-2.5 py-0.5 text-xs font-medium text-slate-600"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
