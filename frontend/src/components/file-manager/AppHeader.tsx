import { HardDrive, LogOut } from "lucide-react";

import { useAuth } from "../../auth/AuthContext";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export function AppHeader() {
  const { user, signOut } = useAuth();

  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/25">
          <HardDrive className="h-7 w-7" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            파일 저장소
          </h1>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-600">
            중복 제거(CAS)와 폴더 트리로 파일을 관리합니다.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {["CAS 해시", "PostgreSQL", "S3"].map((tag) => (
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

      {user && (
        <div className="flex items-center gap-3 self-end sm:self-auto">
          <div className="text-right">
            <p className="text-sm font-medium text-slate-900">
              {user.display_name || user.email}
            </p>
            <p className="text-xs text-slate-500">
              {formatBytes(user.used_bytes)} / {formatBytes(user.quota_bytes)}
            </p>
          </div>
          <button
            onClick={signOut}
            title="로그아웃"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      )}
    </header>
  );
}
