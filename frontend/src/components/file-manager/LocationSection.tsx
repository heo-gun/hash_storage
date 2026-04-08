import { ChevronRight, MapPin } from "lucide-react";
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
      className="border-b border-slate-100 bg-slate-50/90 px-5 py-4 sm:px-6"
      aria-labelledby="location-heading"
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <MapPin className="h-3.5 w-3.5" aria-hidden />
        <span id="location-heading">지금 보고 있는 폴더</span>
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
                className="h-4 w-4 shrink-0 text-slate-300"
                aria-hidden
              />
            )}
            <button
              type="button"
              onClick={() => onNavigateCrumb(index)}
              className={clsx(
                "rounded-lg px-2.5 py-1 font-medium transition",
                index === breadcrumbs.length - 1
                  ? "bg-indigo-100 text-indigo-900"
                  : "text-slate-700 hover:bg-white hover:text-slate-900"
              )}
            >
              {item.name}
            </button>
          </span>
        ))}
      </nav>
      <p className="mt-2 font-mono text-xs text-slate-500">{currentPath}</p>
    </section>
  );
}
