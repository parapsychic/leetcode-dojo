"use client";

import { useEffect, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from "lucide-react";
import type { VizSpec } from "@/lib/claude/schemas";
import {
  ArrayViz,
  LinkedListViz,
  TreeViz,
  GraphViz,
  RecursionViz,
  DPTableViz,
} from "@/components/viz/renderers";

export function VizPlayer({ spec }: { spec: VizSpec }) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const total = spec.frames.length;

  useEffect(() => {
    setI(0);
    setPlaying(false);
  }, [spec]);

  useEffect(() => {
    if (!playing) return;
    if (i >= total - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setI((x) => Math.min(x + 1, total - 1)), 1100);
    return () => clearTimeout(t);
  }, [playing, i, total]);

  const caption = (spec.frames[i] as { caption: string }).caption;

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-sm font-medium">{spec.title}</span>
        <span className="text-xs text-muted">
          Step {i + 1} / {total}
        </span>
      </div>

      <div className="min-h-[260px] px-2">{renderFrame(spec, i)}</div>

      <div className="border-t border-border px-4 py-2">
        <p className="mb-2 min-h-[2.5rem] text-sm text-foreground">{caption}</p>
        <div className="flex items-center gap-2">
          <Ctrl onClick={() => setI(0)} title="Restart">
            <RotateCcw size={15} />
          </Ctrl>
          <Ctrl onClick={() => setI((x) => Math.max(0, x - 1))} title="Previous">
            <SkipBack size={15} />
          </Ctrl>
          <button
            onClick={() => {
              if (i >= total - 1) setI(0);
              setPlaying((p) => !p);
            }}
            className="grid h-8 w-8 place-items-center rounded-full bg-accent text-black"
            title={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <Ctrl onClick={() => setI((x) => Math.min(total - 1, x + 1))} title="Next">
            <SkipForward size={15} />
          </Ctrl>
          <input
            type="range"
            min={0}
            max={total - 1}
            value={i}
            onChange={(e) => {
              setPlaying(false);
              setI(Number(e.target.value));
            }}
            className="ml-2 flex-1 accent-[var(--accent)]"
          />
        </div>
      </div>
    </div>
  );
}

function Ctrl({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}

function renderFrame(spec: VizSpec, i: number) {
  switch (spec.kind) {
    case "array":
      return <ArrayViz frame={spec.frames[i]} />;
    case "linkedlist":
      return <LinkedListViz frame={spec.frames[i]} />;
    case "tree":
      return <TreeViz frame={spec.frames[i]} />;
    case "graph":
      return <GraphViz frame={spec.frames[i]} />;
    case "recursion":
      return <RecursionViz frame={spec.frames[i]} />;
    case "dpTable":
      return <DPTableViz frame={spec.frames[i]} />;
  }
}
