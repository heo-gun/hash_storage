import { LogOut, Search } from "lucide-react";
import { Link } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export function AppHeader() {
  const { user, signOut } = useAuth();
  const pct =
    user && user.quota_bytes > 0
      ? Math.min(100, (user.used_bytes / user.quota_bytes) * 100)
      : 0;

  return (
    <header className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <Link to="/" className="inline-flex items-center gap-3">
          <span className="text-ink font-semibold tracking-tightest-3 text-2xl">
            castor
          </span>
          <span className="hidden font-mono text-[11px] text-accent bg-surface-2 px-2 py-0.5 rounded-xs border border-hairline sm:inline-block">
            sha256:7a3f8b…
          </span>
        </Link>
        <p className="mt-3 text-sm text-ink-muted tracking-tightest-3">
          Content-addressable storage. Browse, upload, share.
        </p>
      </div>

      {user && (
        <div className="flex items-center gap-4 self-end sm:self-auto">
          <div className="text-right">
            <p className="text-sm font-medium text-ink">
              {user.display_name || user.email}
            </p>
            <div className="mt-1.5 flex items-center justify-end gap-2">
              <div className="h-1.5 w-32 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full bg-accent transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="font-mono text-[11px] text-ink-subtle">
                {formatBytes(user.used_bytes)} / {formatBytes(user.quota_bytes)}
              </span>
            </div>
          </div>
          <Link
            to="/search"
            title="Browse public files"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-hairline bg-surface-2 text-ink-muted transition-colors duration-200 hover:bg-surface-3 hover:text-ink"
          >
            <Search className="h-4 w-4" />
          </Link>
          <button
            onClick={signOut}
            title="Sign out"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-hairline bg-surface-2 text-ink-muted transition-colors duration-200 hover:bg-surface-3 hover:text-ink"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      )}
    </header>
  );
}
