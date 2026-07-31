import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * PDF 를 canvas 로만 렌더링한다.
 *
 * PDF.js 의 textLayer 를 의도적으로 만들지 않는다. textLayer 는 선택/복사를
 * 가능하게 하려고 페이지 위에 투명 DOM 텍스트를 깔기 때문에, 그게 있으면
 * 워터마크를 씌워도 원문을 그대로 긁어갈 수 있다.
 */
type Props = {
  data: ArrayBuffer;
  onError: (message: string) => void;
  onLoaded: (pageCount: number) => void;
};

const RENDER_SCALE = 1.5;

export function PdfCanvas({ data, onError, onLoaded }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rendering, setRendering] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // PDF.js 가 버퍼를 detach 시키므로 사본을 넘긴다 (재렌더 시 원본 필요).
    const task = pdfjsLib.getDocument({ data: data.slice(0) });

    (async () => {
      try {
        const pdf = await task.promise;
        if (cancelled) return;
        onLoaded(pdf.numPages);

        const container = containerRef.current;
        if (!container) return;
        container.replaceChildren();

        for (let n = 1; n <= pdf.numPages; n++) {
          if (cancelled) return;
          const page = await pdf.getPage(n);
          const viewport = page.getViewport({ scale: RENDER_SCALE });

          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className =
            "mx-auto mb-4 block w-full max-w-3xl rounded-md shadow-lg";
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;

          container.appendChild(canvas);
          await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        }
        if (!cancelled) setRendering(false);
      } catch (e) {
        if (cancelled) return;
        console.error(e);
        onError("PDF 를 표시할 수 없습니다.");
        setRendering(false);
      }
    })();

    return () => {
      cancelled = true;
      task.destroy();
    };
  }, [data, onError, onLoaded]);

  return (
    <>
      {rendering && (
        <p className="py-8 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-ink-subtle">
          Rendering pages…
        </p>
      )}
      <div ref={containerRef} />
    </>
  );
}
