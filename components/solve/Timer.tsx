"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";

export function useTimer() {
  const [elapsed, setElapsed] = useState(0); // ms
  const [running, setRunning] = useState(true);
  const startRef = useRef<number>(Date.now());
  const baseRef = useRef<number>(0);

  useEffect(() => {
    if (!running) return;
    startRef.current = Date.now();
    const iv = setInterval(() => {
      setElapsed(baseRef.current + (Date.now() - startRef.current));
    }, 250);
    return () => clearInterval(iv);
  }, [running]);

  const pause = () => {
    baseRef.current = baseRef.current + (Date.now() - startRef.current);
    setRunning(false);
  };
  const resume = () => setRunning(true);
  const reset = () => {
    baseRef.current = 0;
    startRef.current = Date.now();
    setElapsed(0);
  };

  return { elapsed, running, pause, resume, reset, toggle: () => (running ? pause() : resume()) };
}

export function TimerDisplay({
  elapsed,
  running,
  onToggle,
  onReset,
}: {
  elapsed: number;
  running: boolean;
  onToggle: () => void;
  onReset: () => void;
}) {
  const totalSec = Math.floor(elapsed / 1000);
  const m = Math.floor(totalSec / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-sm tabular-nums">
        {m}:{s}
      </span>
      <button
        onClick={onToggle}
        className="rounded p-1 text-muted hover:bg-card hover:text-foreground"
        title={running ? "Pause" : "Resume"}
      >
        {running ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <button
        onClick={onReset}
        className="rounded p-1 text-muted hover:bg-card hover:text-foreground"
        title="Reset"
      >
        <RotateCcw size={14} />
      </button>
    </div>
  );
}
