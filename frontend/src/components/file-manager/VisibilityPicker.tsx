import { Globe, Lock, Users } from "lucide-react";
import clsx from "clsx";
import type { Visibility } from "../../types/fs";

export const VISIBILITY_META: Record<
  Visibility,
  { label: string; hint: string; Icon: typeof Lock }
> = {
  private: { label: "Private", hint: "나만 볼 수 있습니다.", Icon: Lock },
  public: {
    label: "Public",
    hint: "모두에게 공개되고 검색에 노출됩니다.",
    Icon: Globe,
  },
  shared: {
    label: "Shared",
    hint: "공유 링크를 받은 사람만 접근합니다. 링크는 이 상태에서만 만들 수 있습니다.",
    Icon: Users,
  },
};

const ORDER: Visibility[] = ["private", "public", "shared"];

type Props = {
  value: Visibility;
  onChange: (next: Visibility) => void;
  disabled?: boolean;
};

export function VisibilityPicker({ value, onChange, disabled }: Props) {
  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Visibility"
        className="grid grid-cols-3 gap-1.5 rounded-md border border-hairline bg-surface-1 p-1"
      >
        {ORDER.map((v) => {
          const { label, Icon } = VISIBILITY_META[v];
          const active = v === value;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(v)}
              className={clsx(
                "inline-flex items-center justify-center gap-1.5 rounded-xs px-2 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50",
                active
                  ? "bg-accent/10 text-accent"
                  : "text-ink-subtle hover:bg-surface-3 hover:text-ink"
              )}
            >
              <Icon className="h-3 w-3" aria-hidden />
              {label}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[11px] text-ink-dim">
        {VISIBILITY_META[value].hint}
      </p>
    </div>
  );
}
