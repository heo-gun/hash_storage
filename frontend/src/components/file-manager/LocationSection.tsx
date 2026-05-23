import { ChevronRight } from "lucide-react";
import clsx from "clsx";
import type { BreadcrumbItem } from "../../types/fs";

type Props = {
  breadcrumbs: BreadcrumbItem[];
  currentPath: string;
  onNavigateCrumb: (index: number) => void;
};

export function LocationSection({
  breadcrumbs,
  currentPath,
  onNavigateCrumb,
}: Props) {
  return (
    <section
      className="border-b border-hairline bg-surface-2/40 px-6 py-5"
      aria-labelledby="location-heading"
    >
      <div className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink-subtle">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        <span id="location-heading">Current path</span>
      </div>
      <nav
        className="mt-3 flex flex-wrap items-center gap-1 text-sm"
        aria-label="폴더 경로"
      >
        {breadcrumbs.map((item, index) => (
          <span
            key={`${item.node_id ?? "root"}-${index}`}
            className="flex items-center gap-1"
          >
            {index > 0 && (
              <ChevronRight
                className="h-3.5 w-3.5 shrink-0 text-ink-dim"
                aria-hidden
              />
            )}
            <button
              type="button"
              onClick={() => onNavigateCrumb(index)}
              className={clsx(
                "rounded-md px-2.5 py-1 font-medium transition-colors duration-200",
                index === breadcrumbs.length - 1
                  ? "bg-accent/10 text-accent"
                  : "text-ink-muted hover:bg-surface-3 hover:text-ink"
              )}
            >
              {item.name}
            </button>
          </span>
        ))}
      </nav>
      <p className="mt-2 font-mono text-[11px] text-ink-dim">{currentPath}</p>
    </section>
  );
}
