"use client";

import { motion } from "framer-motion";
import type { VizSpec } from "@/lib/claude/schemas";

// Narrowed frame types
type Frames<K extends VizSpec["kind"]> = Extract<VizSpec, { kind: K }>["frames"][number];

const ACCENT = "#7c93ff";
const HI = "#34d399";
const cellBase =
  "grid place-items-center rounded-md border text-sm font-mono transition-colors";

// ---------- Array ----------
export function ArrayViz({ frame }: { frame: Frames<"array"> }) {
  const hi = new Set(frame.highlights);
  return (
    <div className="flex flex-col items-center gap-6 py-6">
      <div className="flex flex-wrap items-end justify-center gap-2">
        {frame.array.map((v, i) => {
          const pointers = frame.pointers.filter((p) => p.index === i);
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="h-5 text-[11px] font-medium text-accent">
                {pointers.map((p) => p.name).join(", ")}
              </div>
              <motion.div
                layout
                className={cellBase}
                style={{
                  width: 44,
                  height: 44,
                  borderColor: hi.has(i) ? HI : pointers.length ? ACCENT : "var(--border)",
                  background: hi.has(i) ? "rgba(52,211,153,0.12)" : "transparent",
                }}
              >
                {v === null ? "·" : String(v)}
              </motion.div>
              <div className="text-[10px] text-muted">{i}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Linked List ----------
export function LinkedListViz({ frame }: { frame: Frames<"linkedlist"> }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1 py-8">
      {frame.nodes.map((n, i) => {
        const pointers = frame.pointers.filter((p) => p.nodeId === n.id);
        return (
          <div key={n.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className="h-5 text-[11px] font-medium text-accent">
                {pointers.map((p) => p.name).join(", ")}
              </div>
              <motion.div
                layout
                className="grid h-11 w-11 place-items-center rounded-full border text-sm font-mono"
                style={{ borderColor: pointers.length ? ACCENT : "var(--border)" }}
              >
                {String(n.value)}
              </motion.div>
            </div>
            {i < frame.nodes.length - 1 && <span className="px-1 text-muted">→</span>}
          </div>
        );
      })}
      <span className="pl-1 text-xs text-muted">→ null</span>
    </div>
  );
}

// ---------- Tree (binary) ----------
export function TreeViz({ frame }: { frame: Frames<"tree"> }) {
  const map = new Map(frame.nodes.map((n) => [n.id, n]));
  const hi = new Set(frame.highlights);
  const pos = new Map<string, { x: number; depth: number }>();
  let counter = 0;
  function layout(id: string | null | undefined, depth: number) {
    if (!id || !map.has(id)) return;
    const n = map.get(id)!;
    layout(n.left, depth + 1);
    pos.set(id, { x: counter++, depth });
    layout(n.right, depth + 1);
  }
  layout(frame.root, 0);
  const cols = Math.max(counter, 1);
  const depths = Math.max(...[...pos.values()].map((p) => p.depth), 0) + 1;
  const W = Math.max(cols * 60, 200);
  const H = depths * 70 + 20;
  const X = (x: number) => ((x + 0.5) / cols) * W;
  const Y = (d: number) => d * 70 + 30;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="py-2">
      {frame.nodes.map((n) => {
        const p = pos.get(n.id);
        if (!p) return null;
        return (["left", "right"] as const).map((side) => {
          const childId = n[side];
          const cp = childId ? pos.get(childId) : undefined;
          if (!cp) return null;
          return (
            <line
              key={n.id + side}
              x1={X(p.x)}
              y1={Y(p.depth)}
              x2={X(cp.x)}
              y2={Y(cp.depth)}
              stroke="var(--border)"
              strokeWidth={1.5}
            />
          );
        });
      })}
      {frame.nodes.map((n) => {
        const p = pos.get(n.id);
        if (!p) return null;
        const on = hi.has(n.id);
        return (
          <g key={n.id}>
            <circle
              cx={X(p.x)}
              cy={Y(p.depth)}
              r={18}
              fill={on ? "rgba(52,211,153,0.15)" : "var(--card)"}
              stroke={on ? HI : ACCENT}
              strokeWidth={1.5}
            />
            <text
              x={X(p.x)}
              y={Y(p.depth) + 4}
              textAnchor="middle"
              fontSize={12}
              fill="var(--foreground)"
              fontFamily="monospace"
            >
              {String(n.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------- Graph ----------
export function GraphViz({ frame }: { frame: Frames<"graph"> }) {
  const n = frame.nodes.length;
  const R = 110;
  const cx = 160;
  const cy = 140;
  const posOf = (i: number) => ({
    x: cx + R * Math.cos((2 * Math.PI * i) / Math.max(n, 1) - Math.PI / 2),
    y: cy + R * Math.sin((2 * Math.PI * i) / Math.max(n, 1) - Math.PI / 2),
  });
  const idx = new Map(frame.nodes.map((node, i) => [node.id, i]));
  const hiN = new Set(frame.highlightedNodes);
  const hiE = new Set(frame.highlightedEdges.map((e) => `${e.from}->${e.to}`));

  return (
    <svg width="100%" viewBox="0 0 320 280" className="py-2">
      {frame.edges.map((e, i) => {
        const a = idx.get(e.from);
        const b = idx.get(e.to);
        if (a === undefined || b === undefined) return null;
        const pa = posOf(a);
        const pb = posOf(b);
        const on = hiE.has(`${e.from}->${e.to}`) || hiE.has(`${e.to}->${e.from}`);
        const mx = (pa.x + pb.x) / 2;
        const my = (pa.y + pb.y) / 2;
        return (
          <g key={i}>
            <line
              x1={pa.x}
              y1={pa.y}
              x2={pb.x}
              y2={pb.y}
              stroke={on ? HI : "var(--border)"}
              strokeWidth={on ? 2.5 : 1.5}
            />
            {e.weight !== undefined && (
              <text x={mx} y={my - 3} textAnchor="middle" fontSize={10} fill="var(--muted)">
                {String(e.weight)}
              </text>
            )}
          </g>
        );
      })}
      {frame.nodes.map((node, i) => {
        const p = posOf(i);
        const on = hiN.has(node.id);
        return (
          <g key={node.id}>
            <circle
              cx={p.x}
              cy={p.y}
              r={18}
              fill={on ? "rgba(52,211,153,0.18)" : "var(--card)"}
              stroke={on ? HI : ACCENT}
              strokeWidth={1.5}
            />
            <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize={11} fill="var(--foreground)">
              {node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------- Recursion tree ----------
export function RecursionViz({ frame }: { frame: Frames<"recursion"> }) {
  // depth by following parent chain
  const map = new Map(frame.nodes.map((nd) => [nd.id, nd]));
  const depthOf = (id: string): number => {
    let d = 0;
    let cur = map.get(id);
    const seen = new Set<string>();
    while (cur && cur.parent && !seen.has(cur.id)) {
      seen.add(cur.id);
      d++;
      cur = map.get(cur.parent) ?? undefined;
    }
    return d;
  };
  const byDepth = new Map<number, string[]>();
  for (const nd of frame.nodes) {
    const d = depthOf(nd.id);
    (byDepth.get(d) ?? byDepth.set(d, []).get(d)!).push(nd.id);
  }
  const maxDepth = Math.max(...[...byDepth.keys()], 0);
  const W = 640;
  const H = (maxDepth + 1) * 64 + 20;
  const pos = new Map<string, { x: number; y: number }>();
  for (const [d, ids] of byDepth) {
    ids.forEach((id, i) => {
      pos.set(id, { x: ((i + 0.5) / ids.length) * W, y: d * 64 + 28 });
    });
  }
  const returned = new Set(frame.returned);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="py-2">
      {frame.nodes.map((nd) => {
        const p = pos.get(nd.id);
        const pp = nd.parent ? pos.get(nd.parent) : undefined;
        if (!p || !pp) return null;
        return (
          <line key={nd.id + "l"} x1={p.x} y1={p.y} x2={pp.x} y2={pp.y} stroke="var(--border)" strokeWidth={1.2} />
        );
      })}
      {frame.nodes.map((nd) => {
        const p = pos.get(nd.id);
        if (!p) return null;
        const active = frame.active === nd.id;
        const done = returned.has(nd.id);
        return (
          <g key={nd.id}>
            <rect
              x={p.x - 38}
              y={p.y - 13}
              width={76}
              height={26}
              rx={6}
              fill={active ? "rgba(124,147,255,0.2)" : done ? "rgba(52,211,153,0.12)" : "var(--card)"}
              stroke={active ? ACCENT : done ? HI : "var(--border)"}
              strokeWidth={1.4}
            />
            <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize={11} fill="var(--foreground)" fontFamily="monospace">
              {nd.label.slice(0, 12)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------- DP table ----------
export function DPTableViz({ frame }: { frame: Frames<"dpTable"> }) {
  const hi = new Set(frame.highlights.map(([r, c]) => `${r},${c}`));
  return (
    <div className="overflow-auto py-4">
      <table className="mx-auto border-collapse">
        {frame.colLabels.length > 0 && (
          <thead>
            <tr>
              {frame.rowLabels.length > 0 && <th className="p-1" />}
              {frame.colLabels.map((c, i) => (
                <th key={i} className="px-2 py-1 text-[11px] text-muted">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {frame.grid.map((row, r) => (
            <tr key={r}>
              {frame.rowLabels[r] !== undefined && (
                <td className="px-2 py-1 text-[11px] text-muted">{frame.rowLabels[r]}</td>
              )}
              {row.map((cell, c) => {
                const on = hi.has(`${r},${c}`);
                return (
                  <td key={c} className="p-0.5">
                    <motion.div
                      layout
                      className="grid h-9 w-11 place-items-center rounded border text-xs font-mono"
                      style={{
                        borderColor: on ? HI : "var(--border)",
                        background: on ? "rgba(52,211,153,0.14)" : "transparent",
                      }}
                    >
                      {cell === null ? "·" : String(cell)}
                    </motion.div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
