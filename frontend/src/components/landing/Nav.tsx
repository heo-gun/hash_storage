import { Link } from "react-router-dom";
import { Github } from "lucide-react";

import { GITHUB_REPO_URL } from "./links";

const LINKS = [
  { href: "#map", label: "Map" },
  { href: "#paths", label: "Paths" },
  { href: "#limits", label: "Limits" },
];

export function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-hairline bg-canvas/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link
          to="/"
          className="font-mono text-sm tracking-tightest-3 text-ink transition-colors duration-200 ease-out-soft hover:text-accent"
        >
          castor
        </Link>

        <nav className="flex items-center gap-6 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-subtle">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="hidden transition-colors duration-200 ease-out-soft hover:text-ink sm:inline"
            >
              {l.label}
            </a>
          ))}
          <Link
            to="/search"
            className="transition-colors duration-200 ease-out-soft hover:text-ink"
          >
            Explore
          </Link>
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub repository"
            className="transition-colors duration-200 ease-out-soft hover:text-ink"
          >
            <Github className="h-4 w-4" />
          </a>
          <Link
            to="/login"
            className="text-ink transition-colors duration-200 ease-out-soft hover:text-accent"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}
