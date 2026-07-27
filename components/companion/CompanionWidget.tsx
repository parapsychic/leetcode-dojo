"use client";

// The globally-mounted companion. Lives in app/layout.tsx (a client island in
// the server root layout) so it survives every route change. The outer
// component fetches the character pack + settings; the inner dock is keyed by
// the pack id, so switching characters REMOUNTS it — fresh brain, fresh
// history (each character's conversation lives under its own session key),
// fresh greeting. z-40 keeps it under NameGate's z-50 modal.
//
// Collapse, don't delete: the panel folds away when idle but the conversation
// is kept (and persisted for the session), so clicking her reopens the history.

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { subscribeCompanion, type CompanionEvent } from "@/lib/companion/bus";
import { useCompanionBrain } from "@/lib/companion/useCompanionBrain";
import type { PackManifest } from "@/lib/companion/pack";
import type { CompanionSettings } from "@/lib/companion/config";
import { CompanionSprite } from "./CompanionSprite";
import { SpeechBubble } from "./SpeechBubble";

const greetedKey = (characterId: string) => `companion:greeted:${characterId}`;
const MINIMIZED_KEY = "companion:minimized";
const COLLAPSE_BASE_MS = 6000;
const COLLAPSE_PER_CHAR_MS = 45;
/** Away this long (tab hidden) and she notices you coming back. */
const IDLE_RETURN_MS = 10 * 60_000;

interface PackResponse {
  manifest?: PackManifest;
  settings: CompanionSettings;
}

interface ProgressResponse {
  profile?: { name?: string };
  streak?: { current?: number };
  problems?: Record<string, { status?: string }>;
}

export function CompanionWidget() {
  const [manifest, setManifest] = useState<PackManifest | null>(null);
  const [settings, setSettings] = useState<CompanionSettings | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [templateVars, setTemplateVars] = useState<Record<string, string | number>>({});

  const loadPack = useCallback(() => {
    fetch("/api/companion/pack")
      .then(async (res) => {
        const data = (await res.json()) as PackResponse;
        setSettings(data.settings);
        setManifest(res.ok && data.manifest ? data.manifest : null);
      })
      .catch(() => {
        // API unreachable — stay hidden rather than broken.
        setSettings(null);
        setManifest(null);
      });
  }, []);

  useEffect(() => {
    loadPack();
    fetch("/api/progress")
      .then((r) => r.json())
      .then((d: ProgressResponse) => {
        setUserName(d.profile?.name ?? null);
        const solved = Object.values(d.problems ?? {}).filter(
          (p) => p.status === "solved",
        ).length;
        setTemplateVars({ streak: d.streak?.current ?? 0, solved });
      })
      .catch(() => {});
  }, [loadPack]);

  // Settings changes are handled here (they can swap the whole character);
  // everything else is the dock's business.
  useEffect(() => {
    return subscribeCompanion((e: CompanionEvent) => {
      if (e.type === "settingsChanged") loadPack();
    });
  }, [loadPack]);

  if (!settings?.enabled || !manifest) return null;

  return (
    <CompanionDock
      key={manifest.pack.id}
      manifest={manifest}
      settings={settings}
      userName={userName}
      templateVars={templateVars}
    />
  );
}

function CompanionDock({
  manifest,
  settings,
  userName,
  templateVars,
}: {
  manifest: PackManifest;
  settings: CompanionSettings;
  userName: string | null;
  templateVars: Record<string, string | number>;
}) {
  const pathname = usePathname();
  // Lazy init: safe pre-hydration because the parent renders nothing until the
  // pack fetch resolves, so server and client markup agree regardless.
  const [minimized, setMinimized] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(MINIMIZED_KEY) === "1",
  );
  // The panel's open state is derived, not stored: open when the newest line
  // arrived after the last fold, or when explicitly opened (which matters on
  // an empty conversation, where there is no message to open the panel for).
  const [collapsedAt, setCollapsedAt] = useState(0);
  const [openedAt, setOpenedAt] = useState(0);
  const [inputFocused, setInputFocused] = useState(false);

  const pack = manifest.pack;
  const brain = useCompanionBrain({
    manifest,
    characterId: pack.id,
    chattiness: settings.chattiness,
    userName,
    templateVars,
  });

  const { messages, speaking, thinking, handleEvent, greet, idleReturn } = brain;
  const lastMessage = messages[messages.length - 1];

  // Bus subscription — except on /settings, where proactive chatter is noise.
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    return subscribeCompanion((e: CompanionEvent) => {
      if (e.type === "settingsChanged") return; // parent handles
      if (pathnameRef.current?.startsWith("/settings")) return;
      handleEvent(e);
    });
  }, [handleEvent]);

  // Greeting: once per browser session per character.
  useEffect(() => {
    if (pathname?.startsWith("/settings")) return;
    try {
      if (sessionStorage.getItem(greetedKey(pack.id))) return;
      sessionStorage.setItem(greetedKey(pack.id), "1");
    } catch {
      // storage unavailable — greet anyway
    }
    greet();
  }, [greet, pack.id, pathname]);

  // Idle-return: she notices when you come back after a long absence.
  const hiddenAtRef = useRef<number | null>(null);
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
        return;
      }
      const away = hiddenAtRef.current ? Date.now() - hiddenAtRef.current : 0;
      hiddenAtRef.current = null;
      if (away >= IDLE_RETURN_MS && !pathnameRef.current?.startsWith("/settings")) {
        idleReturn();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [idleReturn]);

  const open =
    thinking ||
    inputFocused ||
    openedAt > collapsedAt ||
    Boolean(lastMessage && lastMessage.at > collapsedAt);

  const openPanel = () => setOpenedAt(Date.now());
  const closePanel = () => setCollapsedAt(Date.now());

  // Auto-collapse a beat after she finishes — never mid-reveal, never while the
  // reply box is focused. The conversation itself is kept either way. A panel
  // you opened by hand stays put; only her own lines time out.
  useEffect(() => {
    if (!open || speaking || thinking || inputFocused) return;
    if (!lastMessage || lastMessage.at < openedAt) return;
    const t = setTimeout(
      () => setCollapsedAt(Date.now()),
      COLLAPSE_BASE_MS + lastMessage.text.length * COLLAPSE_PER_CHAR_MS,
    );
    return () => clearTimeout(t);
  }, [open, speaking, thinking, inputFocused, lastMessage, openedAt]);

  // Unread dot: she spoke while tucked away in the corner.
  const unread = minimized && Boolean(lastMessage?.role === "assistant");

  const setMin = (v: boolean) => {
    setMinimized(v);
    if (!v) openPanel(); // restoring from the corner opens the conversation
    try {
      localStorage.setItem(MINIMIZED_KEY, v ? "1" : "0");
    } catch {
      // non-fatal
    }
  };

  if (minimized) {
    return (
      <button
        onClick={() => setMin(false)}
        aria-label={`Show ${pack.name}`}
        className="fixed bottom-3 right-4 z-40 transition-transform hover:scale-105"
      >
        {manifest.chibi ? (
          // eslint-disable-next-line @next/next/no-img-element -- local pack sprite
          <img
            src={manifest.chibi}
            alt=""
            draggable={false}
            className="h-24 w-24 select-none object-contain object-bottom drop-shadow-lg"
          />
        ) : (
          <span className="grid h-12 w-12 place-items-center rounded-full border border-accent/40 bg-card text-lg font-semibold text-accent shadow-lg">
            {pack.name.charAt(0)}
          </span>
        )}
        {unread && (
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-card bg-accent" />
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-3 right-4 z-40 flex flex-col items-end gap-1.5">
      <SpeechBubble
        visible={open}
        messages={messages}
        thinking={thinking}
        characterName={pack.name}
        onSend={brain.sendReply}
        onMinimize={() => {
          closePanel();
          setMin(true);
        }}
        onClear={brain.clearHistory}
        onInputFocusChange={setInputFocused}
      />
      <CompanionSprite
        sprites={manifest.sprites}
        defaultExpression={pack.defaultExpression}
        characterName={pack.name}
        expression={brain.activeExpression ?? pack.defaultExpression}
        mouthOpen={brain.mouthOpen}
        // Tap her to reopen the conversation (or fold it away again).
        onClick={() => (open ? closePanel() : openPanel())}
      />
    </div>
  );
}
