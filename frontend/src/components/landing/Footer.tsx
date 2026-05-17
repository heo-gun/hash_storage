export function Footer() {
  return (
    <footer className="border-t border-hairline py-12">
      <div className="mx-auto max-w-6xl px-6 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="flex items-center gap-3">
          <span className="font-semibold tracking-tightest-3 text-ink">castor</span>
          <span className="font-mono text-xs text-ink-subtle">v0.1.0</span>
        </div>
        <div className="flex items-center gap-7 text-sm text-ink-subtle">
          <a href="https://github.com/" className="hover:text-ink transition-colors duration-200 ease-out-soft">GitHub</a>
          <a href="#" className="hover:text-ink transition-colors duration-200 ease-out-soft">Security</a>
          <a href="#" className="hover:text-ink transition-colors duration-200 ease-out-soft">Privacy</a>
          <span className="text-ink-dim">© 2026</span>
        </div>
      </div>
    </footer>
  );
}
