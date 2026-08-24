import { LogOut, Search } from "lucide-react";
import { Link } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { formatFileSize } from "../../utils/format";

export function AppHeader() {
  const { user, signOut } = useAuth();
  const pct =
    user && user.quota_bytes > 0
      ? Math.min(100, (user.used_bytes / user.quota_bytes) * 100)
      : 0;

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6">
        <Link
          to="/"
          className="font-mono text-sm tracking-tightest-3 text-ink transition-colors duration-200 ease-out-soft hover:text-accent"
        >
          castor
        </Link>

        {user && (
          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2.5 sm:flex">
              <span className="font-mono text-[11px] text-ink-subtle">
                {formatFileSize(user.used_bytes)} / {formatFileSize(user.quota_bytes)}
              </span>
              <div
                className="h-1 w-24 overflow-hidden rounded-full bg-surface-3"
                role="img"
                aria-label={`Storage used: ${pct.toFixed(0)} percent`}
              >
                <div
                  className="h-full bg-accent transition-[width] duration-300 ease-out-soft"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            <span className="hidden font-mono text-[11px] text-ink-dim md:inline">
              {user.email}
            </span>

            <Link
              to="/search"
              aria-label="Browse public files"
              className="text-ink-subtle transition-colors duration-200 ease-out-soft hover:text-ink"
            >
              <Search className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={signOut}
              aria-label="Sign out"
              className="text-ink-subtle transition-colors duration-200 ease-out-soft hover:text-ink"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
