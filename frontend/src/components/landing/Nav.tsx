import { Link } from "react-router-dom";
import { Github } from "lucide-react";

export function Nav() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-canvas/70 backdrop-blur-md border-b border-hairline">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <span className="text-ink font-semibold tracking-tightest-3 text-lg">
            castor
          </span>
          <span className="hidden sm:inline-block font-mono text-xs text-accent bg-surface-2 px-2 py-0.5 rounded-xs border border-hairline">
            sha256:7a3f8b…
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-sm text-ink-muted">
          <a href="#features" className="hover:text-ink transition-colors duration-200 ease-out-soft">
            Features
          </a>
          <a href="#how-it-works" className="hover:text-ink transition-colors duration-200 ease-out-soft">
            How it works
          </a>
          <a href="#pricing" className="hover:text-ink transition-colors duration-200 ease-out-soft">
            Pricing
          </a>
          <a
            href="https://github.com/"
            target="_blank"
            rel="noreferrer"
            className="hover:text-ink transition-colors duration-200 ease-out-soft inline-flex items-center gap-1.5"
          >
            <Github className="h-4 w-4" /> GitHub
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/app"
            className="text-sm text-ink-muted hover:text-ink px-3 py-2 rounded-md transition-colors duration-200 ease-out-soft"
          >
            Sign in
          </Link>
          <Link
            to="/app"
            className="text-sm text-canvas bg-accent hover:bg-accent-hover font-medium px-4 py-2 rounded-md transition-colors duration-200 ease-out-soft"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
