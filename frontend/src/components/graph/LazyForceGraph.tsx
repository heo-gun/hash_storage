import { Suspense, lazy } from "react";

import type { Graph } from "./buildGraph";

/**
 * d3 는 100kB 넘게 나가는데, 그래프는 랜딩에서 스크롤을 내리거나 /app 에서 탭을
 * 눌러야 보인다. 초기 번들에서 떼어내 필요할 때만 받는다.
 */
const ForceGraph = lazy(() =>
  import("./ForceGraph").then((m) => ({ default: m.ForceGraph }))
);

type Props = {
  graph: Graph;
  height?: number;
  onSelectFolder?: (nodeId: string) => void;
  className?: string;
};

export function LazyForceGraph({ height = 520, ...props }: Props) {
  return (
    <Suspense
      fallback={
        <div
          style={{ height }}
          className="flex items-center justify-center rounded-md border border-hairline bg-canvas"
        >
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-subtle">
            Loading graph
          </span>
        </div>
      }
    >
      <ForceGraph height={height} {...props} />
    </Suspense>
  );
}
