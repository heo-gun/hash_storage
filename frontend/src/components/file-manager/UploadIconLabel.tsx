import { FileUp } from "lucide-react";

type Props = {
  file: File | null;
};

export function UploadIconLabel({ file }: Props) {
  return (
    <>
      <FileUp className="mb-2 h-8 w-8 text-slate-400" strokeWidth={1.5} />
      <span className="text-sm font-medium text-slate-700">
        {file ? file.name : "클릭해서 파일 선택"}
      </span>
      <span className="mt-1 text-xs text-slate-500">
        {file
          ? `${(file.size / 1024).toFixed(1)} KB`
          : "선택한 뒤 아래 버튼으로 이 폴더에 올립니다."}
      </span>
    </>
  );
}
