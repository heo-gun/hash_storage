import { FileUp } from "lucide-react";
import { formatFileSize } from "../../utils/format";

type Props = {
  file: File | null;
};

export function UploadIconLabel({ file }: Props) {
  return (
    <>
      <FileUp className="mb-2 h-7 w-7 text-ink-dim" strokeWidth={1.5} />
      <span className="text-sm font-medium text-ink">
        {file ? file.name : "Click to choose a file"}
      </span>
      <span className="mt-1 font-mono text-[11px] text-ink-subtle">
        {file
          ? formatFileSize(file.size)
          : "SHA-256 will be computed locally"}
      </span>
    </>
  );
}
