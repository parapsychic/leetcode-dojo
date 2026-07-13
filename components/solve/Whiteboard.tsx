"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Eraser, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface WhiteboardHandle {
  /** Returns the sketch as a downscaled PNG (base64, no data: prefix) plus a
   *  flag for whether anything has actually been drawn. */
  getImage: () => { base64: string; hasContent: boolean };
}

const COLORS = ["#e5e7eb", "#38bdf8", "#34d399", "#f59e0b", "#f43f5e"];
const MAX_EXPORT = 768; // cap the longest side of the exported PNG

/**
 * Zero-dependency freehand whiteboard. The learner sketches their thinking here
 * and the coach can pull the current drawing (auto-included when it has content).
 */
export const Whiteboard = forwardRef<WhiteboardHandle>(function Whiteboard(_, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const dirty = useRef(false);

  const [color, setColor] = useState(COLORS[0]);
  const [erasing, setErasing] = useState(false);
  const [width, setWidth] = useState(3);

  // Size the canvas backing store to its container (kept in CSS pixels = 1:1).
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const resize = () => {
      const w = Math.floor(wrap.clientWidth);
      const h = Math.floor(wrap.clientHeight);
      // While the Whiteboard tab is hidden the wrapper is 0×0 — skip, otherwise
      // we'd shrink the canvas to nothing and wipe the learner's drawing.
      if (w === 0 || h === 0) return;
      if (canvas.width === w && canvas.height === h) return; // no real change
      // Preserve the existing drawing across genuine resizes.
      const prev = document.createElement("canvas");
      prev.width = canvas.width;
      prev.height = canvas.height;
      prev.getContext("2d")?.drawImage(canvas, 0, 0);
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.drawImage(prev, 0, 0);
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  useImperativeHandle(ref, () => ({
    getImage() {
      const canvas = canvasRef.current;
      if (!canvas || !dirty.current) return { base64: "", hasContent: false };
      const scale = Math.min(1, MAX_EXPORT / Math.max(canvas.width, canvas.height));
      const out = document.createElement("canvas");
      out.width = Math.round(canvas.width * scale);
      out.height = Math.round(canvas.height * scale);
      const ctx = out.getContext("2d");
      if (!ctx) return { base64: "", hasContent: false };
      // Flatten onto a dark background so the PNG isn't transparent.
      ctx.fillStyle = "#0b0f17";
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(canvas, 0, 0, out.width, out.height);
      const base64 = out.toDataURL("image/png").split(",")[1] ?? "";
      return { base64, hasContent: true };
    },
  }));

  function pos(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent) {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
  }

  function move(e: React.PointerEvent) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    const from = last.current ?? p;
    ctx.globalCompositeOperation = erasing ? "destination-out" : "source-over";
    ctx.strokeStyle = color;
    ctx.lineWidth = erasing ? width * 6 : width;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    dirty.current = true;
  }

  function end() {
    drawing.current = false;
    last.current = null;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    dirty.current = false;
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => {
                setColor(c);
                setErasing(false);
              }}
              className={cn(
                "h-5 w-5 rounded-full border",
                !erasing && color === c ? "border-foreground" : "border-border",
              )}
              style={{ backgroundColor: c }}
              aria-label={`color ${c}`}
            />
          ))}
        </div>
        <Button
          variant={erasing ? "outline" : "ghost"}
          size="sm"
          onClick={() => setErasing(false)}
          title="Pen"
        >
          <Pencil size={13} /> Pen
        </Button>
        <Button
          variant={erasing ? "outline" : "ghost"}
          size="sm"
          onClick={() => setErasing(true)}
          title="Eraser"
        >
          <Eraser size={13} /> Eraser
        </Button>
        <input
          type="range"
          min={1}
          max={8}
          value={width}
          onChange={(e) => setWidth(Number(e.target.value))}
          className="w-20"
          title="Stroke width"
        />
        <Button variant="ghost" size="sm" onClick={clear} className="ml-auto" title="Clear">
          <Trash2 size={13} /> Clear
        </Button>
      </div>
      <div
        ref={wrapRef}
        className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-[#0b0f17]"
      >
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="h-full w-full touch-none"
          style={{ cursor: "crosshair" }}
        />
      </div>
      <p className="text-[11px] text-muted">
        Sketch your approach — when you have something drawn, the coach will glance
        at it on its next check-in.
      </p>
    </div>
  );
});
