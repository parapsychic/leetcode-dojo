"use client";

// The globally-mounted companion. Lives in app/layout.tsx (a client island in
// the server root layout) so it survives every route change. Fetches the
// character pack + settings, subscribes to the companion bus, greets once per
// browser session, and renders the sprite + chat panel dock. z-40 keeps it
// under NameGate's z-50 modal and above page content.
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

const GREETED_KEY = "companion:greeted";
const MINIMIZED_KEY = "companion:minimized";
const COLLAPSE_BASE_MS = 6000;
const COLLAPSE_PER_CHAR_MS = 45;

interface PackResponse {
  manifest?: PackManifest;
  settings: CompanionSettings;
}

export function CompanionWidget() {
  const pathname = usePathname();
  const [manifest, setManifest] = useState<PackManifest | null>(null);
  const [settings, setSettings] = useState<CompanionSettings | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  // Lazy init: safe pre-hydration because the widget renders null until the
  // pack fetch resolves, so server and client markup agree regardless.
  const [minimized, setMinimized] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(MINIMIZED_KEY) === "1",
  );
  // The panel's open state is derived, not stored: it is open whenever the
  // newest line arrived after the last time it was folded away. That makes a
  // new line reopen it without an effect, and keeps the history intact.
  const [collapsedAt, setCollapsedAt] = useState(0);
  const [openedAt, setOpenedAt] = useState(0);
  const [inputFocused, setInputFocused] = useState(false);

  const brain = useCompanionBrain({
    manifest,
    chattiness: settings?.chattiness ?? "normal",
    userName,
  });

  const { messages, speaking, thinking, handleEvent, greet } = brain;
  const lastMessage = messages[messages.length - 1];

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
      .then((d: { profile?: { name?: string } }) => setUserName(d.profile?.name ?? null))
      .catch(() => {});
  }, [loadPack]);

  // Bus subscription. Settings changes re-fetch; everything else goes to the
  // brain — except on /settings, where proactive chatter would be noise.
  const pathnameRef = useRef(pathname);
  const enabledRef = useRef(false);
  useEffect(() => {
    pathnameRef.current = pathname;
    enabledRef.current = Boolean(settings?.enabled && manifest);
  }, [pathname, settings, manifest]);

  useEffect(() => {
    return subscribeCompanion((e: CompanionEvent) => {
      if (e.type === "settingsChanged") {
        loadPack();
        return;
      }
      if (!enabledRef.current) return;
      if (pathnameRef.current?.startsWith("/settings")) return;
      handleEvent(e);
    });
  }, [handleEvent, loadPack]);

  // Greeting: once per browser session, once the pack is ready.
  useEffect(() => {
    if (!settings?.enabled || !manifest) return;
    if (pathname?.startsWith("/settings")) return;
    try {
      if (sessionStorage.getItem(GREETED_KEY)) return;
      sessionStorage.setItem(GREETED_KEY, "1");
    } catch {
      // storage unavailable — greet anyway
    }
    greet();
  }, [settings?.enabled, manifest, greet, pathname]);

  // Open when she speaks, or when you ask for her — the second half matters on
  // an empty conversation, where there is no message to open the panel for.
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

  if (!settings?.enabled || !manifest) return null;

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

  const pack = manifest.pack;

  if (minimized) {
    return (
      <button
        onClick={() => setMin(false)}
        aria-label={`Show ${pack.name}`}
        className="fixed bottom-3 right-4 z-40 grid h-12 w-12 place-items-center rounded-full border border-accent/40 bg-card text-lg font-semibold text-accent shadow-lg transition-transform hover:scale-105"
      >
        {pack.name.charAt(0)}
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
