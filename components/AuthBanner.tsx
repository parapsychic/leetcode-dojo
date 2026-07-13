"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

export function AuthBanner() {
  const [state, setState] = useState<"checking" | "ok" | "fail">("checking");

  useEffect(() => {
    let alive = true;
    fetch("/api/auth-check")
      .then((r) => r.json())
      .then((d: { ok: boolean }) => {
        if (alive) setState(d.ok ? "ok" : "fail");
      })
      .catch(() => alive && setState("fail"));
    return () => {
      alive = false;
    };
  }, []);

  if (state === "ok") return null;

  return (
    <div
      className={
        "border-b px-4 py-2 text-sm " +
        (state === "checking"
          ? "border-border bg-card text-muted"
          : "border-amber-500/40 bg-amber-500/10 text-amber-300")
      }
    >
      <div className="mx-auto flex max-w-7xl items-center gap-2">
        {state === "checking" ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            Connecting to your Claude Code session…
          </>
        ) : (
          <>
            <AlertTriangle size={15} />
            <span>
              Couldn&apos;t reach a logged-in Claude Code session. Open Claude Code
              and run <code className="rounded bg-black/30 px-1">/login</code>, then
              reload. The tutor features need it.
            </span>
          </>
        )}
      </div>
    </div>
  );
}
