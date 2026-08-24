import { Link } from "react-router-dom";

import { GITHUB_REPO_URL } from "./links";

const COLUMNS: { head: string; items: { label: string; to: string; external?: boolean }[] }[] = [
  {
    head: "Product",
    items: [
      { label: "Explore public files", to: "/search" },
      { label: "Sign in", to: "/login" },
      { label: "Create account", to: "/signup" },
    ],
  },
  {
    head: "Source",
    items: [
      { label: "Repository", to: GITHUB_REPO_URL, external: true },
      { label: "Deployment notes", to: `${GITHUB_REPO_URL}/blob/main/docs/DEPLOY.md`, external: true },
      { label: "Threat model", to: `${GITHUB_REPO_URL}/blob/main/docs/DEPLOY.md`, external: true },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-hairline bg-surface-1 py-12">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <div>
          <p className="font-mono text-sm text-ink">castor</p>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-subtle">
            Content-addressed storage with policy-bound sharing.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.head}>
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-dim">
              {col.head}
            </p>
            <ul className="mt-4 flex flex-col gap-2.5">
              {col.items.map((item) => (
                <li key={item.label}>
                  {item.external ? (
                    <a
                      href={item.to}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-ink-muted transition-colors duration-200 ease-out-soft hover:text-ink"
                    >
                      {item.label}
                    </a>
                  ) : (
                    <Link
                      to={item.to}
                      className="text-sm text-ink-muted transition-colors duration-200 ease-out-soft hover:text-ink"
                    >
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-10 max-w-6xl px-6">
        <p className="border-t border-hairline pt-6 font-mono text-[11px] text-ink-dim">
          v0.1.0 · 2026
        </p>
      </div>
    </footer>
  );
}
