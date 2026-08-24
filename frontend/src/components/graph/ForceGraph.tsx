import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

import type { Graph, GraphLink, GraphNode } from "./buildGraph";

type Props = {
  graph: Graph;
  height?: number;
  /** 폴더 노드를 클릭했을 때. 파일 노드는 호출하지 않는다. */
  onSelectFolder?: (nodeId: string) => void;
  className?: string;
};

const COLOR = {
  root: "#6ee7d5",
  folder: "#8ff0e1",
  file: "#7e848e",
  /** 여러 부모를 가진 파일 = dedup 으로 한 벌만 저장된 내용 */
  dedup: "#f0b46e",
  link: "#24262c",
  linkDedup: "#4a3a25",
  label: "#c8ccd4",
};

/**
 * d3 가 SVG 를 직접 만지게 두고 React 는 컨테이너만 소유한다. tick 마다 setState 를
 * 돌리면 노드 수백 개에서 바로 버벅인다.
 */
export function ForceGraph({
  graph,
  height = 520,
  onSelectFolder,
  className,
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hovered, setHovered] = useState<GraphNode | null>(null);

  // 콜백을 effect 의존성에 넣으면 부모가 리렌더될 때마다 시뮬레이션이 처음부터
  // 다시 돌아 그래프가 튄다. 최신 함수만 ref 로 들고 간다.
  const onSelectFolderRef = useRef(onSelectFolder);
  onSelectFolderRef.current = onSelectFolder;

  useEffect(() => {
    const svgEl = svgRef.current;
    const wrapEl = wrapRef.current;
    if (!svgEl || !wrapEl) return;

    const width = wrapEl.clientWidth || 800;

    // 시뮬레이션이 좌표를 덮어쓰므로 원본 데이터는 건드리지 않도록 복사한다.
    const nodes: GraphNode[] = graph.nodes.map((n) => ({ ...n }));
    const links: GraphLink[] = graph.links.map((l) => ({ ...l }));

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();
    svg.attr("viewBox", [0, 0, width, height].join(" "));

    const root = svg.append("g");

    const isDedup = (n: GraphNode) => n.kind === "file" && n.members.length > 1;
    const nodeOf = (v: string | GraphNode) => v as GraphNode;

    const link = root
      .append("g")
      .attr("stroke-opacity", 0.8)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", (d) =>
        isDedup(nodeOf(d.target)) ? COLOR.linkDedup : COLOR.link
      )
      .attr("stroke-width", (d) => (isDedup(nodeOf(d.target)) ? 1.4 : 1));

    const node = root
      .append("g")
      .selectAll<SVGCircleElement, GraphNode>("circle")
      .data(nodes)
      .join("circle")
      .attr("r", (d) => d.radius)
      .attr("fill", (d) =>
        d.kind === "root"
          ? COLOR.root
          : d.kind === "folder"
            ? COLOR.folder
            : isDedup(d)
              ? COLOR.dedup
              : COLOR.file
      )
      .attr("stroke", "#060607")
      .attr("stroke-width", 1.5)
      .style("cursor", (d) => (d.kind === "folder" ? "pointer" : "default"));

    // 라벨은 큰 노드에만. 전부 그리면 글자끼리 겹쳐 아무것도 못 읽는다.
    const label = root
      .append("g")
      .attr("pointer-events", "none")
      .selectAll("text")
      .data(nodes.filter((n) => n.kind !== "file" || isDedup(n)))
      .join("text")
      .text((d) => (d.label.length > 22 ? `${d.label.slice(0, 21)}…` : d.label))
      .attr("font-size", 9)
      .attr("font-family", "ui-monospace, monospace")
      .attr("fill", COLOR.label)
      .attr("text-anchor", "middle");

    node
      .on("mouseenter", (_e, d) => setHovered(d))
      .on("mouseleave", () => setHovered(null))
      .on("click", (_e, d) => {
        if (d.kind === "folder") onSelectFolderRef.current?.(d.id);
      });

    function ticked() {
      link
        .attr("x1", (d) => nodeOf(d.source).x ?? 0)
        .attr("y1", (d) => nodeOf(d.source).y ?? 0)
        .attr("x2", (d) => nodeOf(d.target).x ?? 0)
        .attr("y2", (d) => nodeOf(d.target).y ?? 0);
      node.attr("cx", (d) => d.x ?? 0).attr("cy", (d) => d.y ?? 0);
      label.attr("x", (d) => d.x ?? 0).attr("y", (d) => (d.y ?? 0) - d.radius - 4);
    }

    const simulation = d3
      .forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force(
        "link",
        d3
          .forceLink(links as d3.SimulationLinkDatum<d3.SimulationNodeDatum>[])
          .id((d) => (d as GraphNode).id)
          .distance(38)
          .strength(0.7)
      )
      .force("charge", d3.forceManyBody().strength(-110))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collide",
        d3.forceCollide<GraphNode>().radius((d) => d.radius + 4)
      )
      .on("tick", ticked);

    // 레이아웃을 미리 돌려놓고 그린다. d3 의 타이머는 requestAnimationFrame 위에
    // 있어서, 배경 탭에서 열면 rAF 가 멈춰 노드가 (0,0) 에 겹친 채로 남는다.
    // 미리 수렴시켜 두면 보이는 순간 이미 정돈된 그림이고, 처음 펼쳐질 때
    // 중앙에서 폭발하듯 튀는 것도 없앨 수 있다.
    simulation.tick(180);
    simulation.stop();
    ticked();

    node.call(
      d3
        .drag<SVGCircleElement, GraphNode>()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
    );

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 6])
      .on("zoom", (event) => root.attr("transform", event.transform));
    svg.call(zoom);

    // 힘 시뮬레이션이 만드는 덩어리 크기는 노드 수에 따라 제각각이라, 캔버스
    // 한가운데 작게 뭉치기 십상이다. 수렴한 뒤 경계 상자를 재서 화면에 맞춘다.
    const xs = nodes.map((n) => n.x ?? 0);
    const ys = nodes.map((n) => n.y ?? 0);
    const pad = 28;
    const boxW = Math.max(...xs) - Math.min(...xs) + pad * 2;
    const boxH = Math.max(...ys) - Math.min(...ys) + pad * 2;
    if (boxW > 0 && boxH > 0) {
      const k = Math.min(width / boxW, height / boxH, 2.5);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      svg.call(
        zoom.transform,
        d3.zoomIdentity
          .translate(width / 2, height / 2)
          .scale(k)
          .translate(-cx, -cy)
      );
    }

    return () => {
      simulation.stop();
      svg.on(".zoom", null);
      svg.selectAll("*").remove();
    };
  }, [graph, height]);

  return (
    <div ref={wrapRef} className={className}>
      <div className="relative">
        <svg
          ref={svgRef}
          height={height}
          className="w-full touch-none rounded-md border border-hairline bg-canvas"
          role="img"
          aria-label="File directory graph"
        />

        {hovered && (
          <div className="pointer-events-none absolute left-3 top-3 max-w-[260px] rounded-md border border-hairline bg-surface-2/95 px-3 py-2">
            <p className="truncate text-xs font-medium text-ink">
              {hovered.label}
            </p>
            {hovered.kind === "file" && (
              <p className="mt-1 font-mono text-[10px] text-ink-subtle">
                {hovered.hashId ? `${hovered.hashId.slice(0, 12)}…` : "no hash"}
                {hovered.members.length > 1 &&
                  ` · ${hovered.members.length} refs`}
              </p>
            )}
            {hovered.members.length > 1 && (
              <ul className="mt-1.5 space-y-0.5">
                {hovered.members.slice(0, 5).map((m) => (
                  <li
                    key={m.node_id}
                    className="truncate font-mono text-[10px] text-ink-dim"
                  >
                    {m.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 font-mono text-[10px] text-ink-subtle">
        <Legend color={COLOR.folder} label="folder" />
        <Legend color={COLOR.file} label="file" />
        <Legend color={COLOR.dedup} label="deduped — one node, many parents" />
        <span className="text-ink-dim">drag · scroll to zoom · click a folder</span>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
