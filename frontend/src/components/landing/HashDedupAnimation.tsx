import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Signature hero animation for castor.
 *
 * Story (6s loop):
 *   1. Three file icons enter from spread positions on the left
 *   2. Each emits a SHA-256 hash trail flowing right (D3 path interpolation)
 *   3. Two files have identical content → trails merge into one bucket icon
 *   4. Counter ticks: "3 files uploaded → 1 object stored"
 *   5. Fade and restart
 */

type FileRow = {
  id: string;
  label: string;
  hash: string;
  hue: "accent" | "muted";
};

const FILES: FileRow[] = [
  { id: "f1", label: "report.pdf",      hash: "7a3f8b2e1d9c4f5a", hue: "accent" },
  { id: "f2", label: "report-copy.pdf", hash: "7a3f8b2e1d9c4f5a", hue: "accent" }, // dup
  { id: "f3", label: "design.png",      hash: "b2f04ca1e8d77361", hue: "muted"  },
];

const WIDTH = 640;
const HEIGHT = 360;
const FILE_X = 80;
const BUCKET_X = WIDTH - 120;
const LOOP_MS = 6000;

export function HashDedupAnimation() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [tick, setTick] = useState(0);

  // Re-trigger loop
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), LOOP_MS);
    return () => clearInterval(interval);
  }, []);

  // Draw paths once + animate via stroke-dashoffset on each tick
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll(".trail").remove();

    FILES.forEach((file, i) => {
      const startY = 80 + i * 100;
      // Two duplicate files (f1, f2) converge to same Y on bucket side
      const isDup = file.hash === FILES[0].hash;
      const endY  = isDup ? 130 : 230;

      const path = d3.path();
      path.moveTo(FILE_X + 24, startY);
      path.bezierCurveTo(
        FILE_X + 200, startY,
        BUCKET_X - 200, endY,
        BUCKET_X - 24, endY,
      );

      const trail = svg
        .append("path")
        .attr("class", "trail")
        .attr("d", path.toString())
        .attr("fill", "none")
        .attr("stroke", file.hue === "accent" ? "#6ee7d5" : "#7e848e")
        .attr("stroke-width", 1.5)
        .attr("stroke-linecap", "round")
        .attr("opacity", 0.85);

      const totalLen = (trail.node() as SVGPathElement).getTotalLength();
      trail
        .attr("stroke-dasharray", `${totalLen} ${totalLen}`)
        .attr("stroke-dashoffset", totalLen)
        .transition()
        .delay(i * 350)
        .duration(2200)
        .ease(d3.easeCubicInOut)
        .attr("stroke-dashoffset", 0);
    });
  }, [tick]);

  return (
    <div className="relative w-full max-w-[640px] mx-auto select-none">
      {/* Hairline grid backdrop */}
      <div
        className="absolute inset-0 rounded-xl border border-hairline"
        style={{
          backgroundImage:
            "linear-gradient(to right, #24262c 1px, transparent 1px), linear-gradient(to bottom, #24262c 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          opacity: 0.25,
        }}
      />

      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="relative w-full h-auto"
      >
        {/* File icons (left side) */}
        {FILES.map((file, i) => {
          const y = 80 + i * 100;
          return (
            <FileGlyph
              key={`${file.id}-${tick}`}
              x={FILE_X}
              y={y}
              label={file.label}
              hash={file.hash}
              delay={i * 0.15}
            />
          );
        })}

        {/* Bucket icons (right side) — only 2 distinct objects */}
        <BucketGlyph x={BUCKET_X} y={130} hash="7a3f8b…" delayAppear={2.4} />
        <BucketGlyph x={BUCKET_X} y={230} hash="b2f04c…" delayAppear={2.6} />
      </svg>

      {/* Counter */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-surface-1 border border-hairline rounded-md px-4 py-2 font-mono text-xs">
        <AnimatePresence mode="wait">
          <motion.span
            key={tick}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="text-ink-muted"
          >
            <span className="text-ink">3 files</span>
            <span className="mx-2 text-ink-dim">→</span>
            <span className="text-accent">2 objects stored</span>
            <span className="ml-2 text-ink-subtle">(1 deduplicated)</span>
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */

function FileGlyph({
  x, y, label, hash, delay,
}: {
  x: number; y: number; label: string; hash: string; delay: number;
}) {
  return (
    <motion.g
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* File icon (simple folded paper) */}
      <rect
        x={x - 16} y={y - 18} width={32} height={36}
        rx={3} fill="#131418" stroke="#34373f" strokeWidth={1}
      />
      <path
        d={`M ${x + 6} ${y - 18} L ${x + 16} ${y - 8} L ${x + 6} ${y - 8} Z`}
        fill="#1a1b20" stroke="#34373f" strokeWidth={1}
      />

      {/* Label */}
      <text
        x={x} y={y + 32}
        textAnchor="middle"
        className="fill-ink-muted"
        style={{ fontSize: 11, fontFamily: "Geist, sans-serif" }}
      >
        {label}
      </text>

      {/* Hash badge */}
      <text
        x={x} y={y + 46}
        textAnchor="middle"
        className="fill-ink-subtle"
        style={{ fontSize: 9, fontFamily: "Geist Mono, monospace" }}
      >
        {hash}
      </text>
    </motion.g>
  );
}

function BucketGlyph({
  x, y, hash, delayAppear,
}: {
  x: number; y: number; hash: string; delayAppear: number;
}) {
  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: delayAppear, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* S3-like bucket */}
      <ellipse cx={x} cy={y - 14} rx={20} ry={5} fill="#1f3c39" stroke="#6ee7d5" strokeWidth={1} />
      <path
        d={`M ${x - 20} ${y - 14} L ${x - 16} ${y + 18} Q ${x} ${y + 24} ${x + 16} ${y + 18} L ${x + 20} ${y - 14}`}
        fill="#0d0e10" stroke="#6ee7d5" strokeWidth={1}
      />
      <ellipse cx={x} cy={y - 14} rx={20} ry={5} fill="none" stroke="#6ee7d5" strokeWidth={1} />

      <text
        x={x} y={y + 40}
        textAnchor="middle"
        className="fill-accent"
        style={{ fontSize: 10, fontFamily: "Geist Mono, monospace" }}
      >
        {hash}
      </text>
    </motion.g>
  );
}
