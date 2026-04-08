import {
  AlertCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
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
        "mx-5 mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm sm:mx-6",
        banner.tone === "success" &&
          "border-emerald-200 bg-emerald-50 text-emerald-900",
        banner.tone === "error" && "border-red-200 bg-red-50 text-red-900",
        banner.tone === "neutral" &&
          "border-amber-200 bg-amber-50 text-amber-900"
      )}
    >
      {banner.tone === "success" && (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
      )}
      {banner.tone === "error" && (
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
      )}
      {banner.tone === "neutral" && (
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      )}
      <span className="leading-relaxed">{banner.text}</span>
    </div>
  );
}
