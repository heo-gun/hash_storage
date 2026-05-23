import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import clsx from "clsx";
import type { BannerState } from "../../types/fs";

type Props = {
  banner: BannerState;
};

export function BannerAlert({ banner }: Props) {
  if (!banner) return null;

  return (
    <div
      role="status"
      className={clsx(
        "mx-6 mb-4 flex items-start gap-3 rounded-md border px-4 py-3 text-sm",
        banner.tone === "success" &&
          "border-accent/30 bg-accent/5 text-accent",
        banner.tone === "error" &&
          "border-rose-500/30 bg-rose-500/5 text-rose-300",
        banner.tone === "neutral" &&
          "border-hairline-2 bg-surface-2 text-ink-muted"
      )}
    >
      {banner.tone === "success" && (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      {banner.tone === "error" && (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      {banner.tone === "neutral" && (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <span className="leading-relaxed">{banner.text}</span>
    </div>
  );
}
