"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2 } from "lucide-react";

interface AuthState {
  ok: boolean;
  /** True when running as a Linux AppImage, which can't reach the natively
   *  installed Claude Code — the messages below explain that instead of the
   *  generic "run /login" advice. */
  isAppImage?: boolean;
  activeProvider?: string;
  servedBy?: string;
  servedByLabel?: string;
  activeProviderLabel?: string;
}

export function AuthBanner() {
  const [state, setState] = useState<"checking" | "ok" | "fail">("checking");
  const [info, setInfo] = useState<AuthState | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth-check")
      .then((r) => r.json())
      .then((d: AuthState) => {
        if (!alive) return;
        setInfo(d);
        setState(d.ok ? "ok" : "fail");
      })
      .catch(() => alive && setState("fail"));
    return () => {
      alive = false;
    };
  }, []);

  // When healthy and being served by the primary provider, stay out of the way.
  // If a fallback is answering, show a small informational note.
  if (state === "ok") {
    if (info && info.servedBy && info.servedBy !== info.activeProvider) {
      return (
        <div className="border-b border-sky-500/30 bg-sky-500/10 px-4 py-2 text-sm text-sky-300">
          <div className="mx-auto flex max-w-7xl items-center gap-2">
            <span>
              Using fallback provider{" "}
              <strong>{info.servedByLabel ?? info.servedBy}</strong> —{" "}
              {info.activeProviderLabel ?? info.activeProvider} is unavailable
              {info.isAppImage && info.activeProvider === "claude"
                ? " (AppImage builds can't use your local Claude Code — install the .deb/.rpm/pacman package for that)"
                : ""}
              .
            </span>
            <Link href="/settings" className="underline underline-offset-2">
              Settings
            </Link>
          </div>
        </div>
      );
    }
    return null;
  }

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
            Connecting to your AI provider…
          </>
        ) : (
          <>
            <AlertTriangle size={15} />
            {info?.isAppImage ? (
              <span>
                No AI provider is reachable. You&apos;re running the AppImage
                build, which can&apos;t use the Claude Code installed on your
                system — install the .deb, .rpm, or Arch (.pacman) package from
                the releases page, or add an API-key provider in{" "}
                <Link href="/settings" className="underline underline-offset-2">
                  Settings
                </Link>
                . The tutor features need one.
              </span>
            ) : (
              <span>
                No AI provider is reachable. Open Claude Code and run{" "}
                <code className="rounded bg-black/30 px-1">/login</code>, or add
                a fallback provider in{" "}
                <Link href="/settings" className="underline underline-offset-2">
                  Settings
                </Link>
                . The tutor features need one.
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
