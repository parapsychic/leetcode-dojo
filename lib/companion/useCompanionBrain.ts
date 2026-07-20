"use client";

// The companion's event → spoken-line pipeline. Owns director state, the
// current playback, the conversation history, and the LLM call for banter.
// Solution-leak safety lives here structurally: LLM calls send ONLY the pack
// persona + an event summary + chat history — never code or problem content.
//
// The message list is the single source of truth: it drives what the bubble
// renders, what gets persisted, and what the LLM receives as prior context.

import { useCallback, useEffect, useRef, useState } from "react";
import { useClaudeStream } from "@/lib/useClaudeStream";
import type { PromptContext } from "@/lib/claude/prompts";
import { getLastActivityAt, type CompanionEvent } from "./bus";
import {
  decide,
  fillTemplate,
  initialDirectorState,
  noteProactive,
  pickCanned,
} from "./director";
import { createTextReveal, type LinePlayback } from "./playLine";
import type { Chattiness } from "./config";
import type { PackManifest } from "./pack";

const TYPING_QUIET_MS = 5000;
const TYPING_RETRY_MS = 8000;
/** How much history the bubble keeps (and persists). */
const HISTORY_MAX = 40;
/** How many recent turns the model is given as context. */
const LLM_CONTEXT_TURNS = 10;
const HISTORY_KEY = "companion:history";
const TAG_SCAN_LIMIT = 40;

export interface CompanionMessage {
  id: number;
  role: "user" | "assistant";
  /** Revealed text so far (assistant lines type themselves out). */
  text: string;
  expression?: string;
  done: boolean;
  at: number;
}

interface BrainInput {
  manifest: PackManifest | null;
  chattiness: Chattiness;
  userName: string | null;
}

function loadHistory(): CompanionMessage[] {
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY);
    const parsed = raw ? (JSON.parse(raw) as CompanionMessage[]) : [];
    if (!Array.isArray(parsed)) return [];
    // Anything mid-reveal when the page unloaded is shown as finished.
    return parsed.slice(-HISTORY_MAX).map((m) => ({ ...m, done: true }));
  } catch {
    return [];
  }
}

export function useCompanionBrain(input: BrainInput) {
  // Restored lazily: sessionStorage is unavailable during SSR, and loadHistory
  // swallows that — the widget renders nothing until its pack fetch lands, so
  // server and client markup agree either way.
  const [messages, setMessages] = useState<CompanionMessage[]>(loadHistory);
  const [mouthOpen, setMouthOpen] = useState(false);
  const [thinking, setThinking] = useState(false);

  const inputRef = useRef(input);
  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  const { run, stop } = useClaudeStream();
  const directorRef = useRef(initialDirectorState());
  const playbackRef = useRef<LinePlayback | null>(null);
  const speakingRef = useRef(false);
  const pendingRef = useRef<(() => void) | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesRef = useRef<CompanionMessage[]>(messages);
  // Resume past any restored history — reusing an id would make a new line
  // overwrite an old one (they're patched by id) and duplicate React keys.
  const lineIdRef = useRef(messages.reduce((max, m) => Math.max(max, m.id), 0));
  // Full text of the line currently revealing, so an interrupted line can be
  // finalized in the history rather than left truncated mid-word.
  const activeRef = useRef<{ id: number; full: string } | null>(null);

  const commit = useCallback(
    (next: (prev: CompanionMessage[]) => CompanionMessage[]) => {
      const value = next(messagesRef.current).slice(-HISTORY_MAX);
      messagesRef.current = value;
      setMessages(value);
      try {
        sessionStorage.setItem(HISTORY_KEY, JSON.stringify(value));
      } catch {
        // storage full/blocked — the in-memory copy still works
      }
    },
    [],
  );

  const patch = useCallback(
    (id: number, fields: Partial<CompanionMessage>) => {
      commit((prev) => prev.map((m) => (m.id === id ? { ...m, ...fields } : m)));
    },
    [commit],
  );

  useEffect(() => {
    return () => {
      playbackRef.current?.cancel();
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      stop();
    };
  }, [stop]);

  /** Stop the current reveal, keeping the full line in the history. */
  const finalizeActive = useCallback(() => {
    playbackRef.current?.cancel();
    playbackRef.current = null;
    speakingRef.current = false;
    const active = activeRef.current;
    if (active) {
      patch(active.id, { text: active.full, done: true });
      activeRef.current = null;
    }
    setMouthOpen(false);
  }, [patch]);

  /** Begin a new spoken line; returns the playback to push text into. */
  const beginLine = useCallback(
    (expression: string): LinePlayback => {
      finalizeActive();
      speakingRef.current = true;
      const id = ++lineIdRef.current;
      activeRef.current = { id, full: "" };
      commit((prev) => [
        ...prev,
        { id, role: "assistant", text: "", expression, done: false, at: Date.now() },
      ]);
      const playback = createTextReveal({
        onText: (revealed) => patch(id, { text: revealed }),
        onMouth: setMouthOpen,
        onDone: () => {
          speakingRef.current = false;
          if (activeRef.current?.id === id) {
            patch(id, { text: activeRef.current.full, done: true });
            activeRef.current = null;
          } else {
            patch(id, { done: true });
          }
          const queued = pendingRef.current;
          pendingRef.current = null;
          queued?.();
        },
      });
      playbackRef.current = playback;
      return playback;
    },
    [commit, finalizeActive, patch],
  );

  /** Push text into the active line, tracking the full string for finalization. */
  const pushLine = useCallback((playback: LinePlayback, text: string) => {
    if (activeRef.current) activeRef.current.full = text;
    playback.push(text);
  }, []);

  const speakText = useCallback(
    (text: string, expression: string) => {
      const pack = inputRef.current.manifest?.pack;
      const expr =
        pack && pack.expressions.includes(expression)
          ? expression
          : (pack?.defaultExpression ?? "neutral");
      const playback = beginLine(expr);
      pushLine(playback, text);
      playback.finish();
    },
    [beginLine, pushLine],
  );

  const speakCanned = useCallback(
    (eventKey: string, vars: Record<string, string | number>): boolean => {
      const manifest = inputRef.current.manifest;
      if (!manifest) return false;
      const canned = pickCanned(manifest.pack, eventKey, directorRef.current);
      if (!canned) return false;
      const allVars = { name: inputRef.current.userName ?? "", ...vars };
      speakText(fillTemplate(canned.text, allVars), canned.expression);
      return true;
    },
    [speakText],
  );

  const speakLlm = useCallback(
    async (opts: { eventSummary?: string; userMessage?: string; fallbackKey?: string }) => {
      const manifest = inputRef.current.manifest;
      if (!manifest) return;
      const pack = manifest.pack;
      directorRef.current.lastLlmAt = Date.now();
      setThinking(true);

      const ctx: PromptContext = {
        persona: pack.persona,
        speechStyle: pack.speechStyle,
        expressionList: pack.expressions,
        eventSummary: opts.eventSummary,
        userMessage: opts.userMessage,
        userName: inputRef.current.userName ?? undefined,
        transcript: messagesRef.current
          .filter((m) => m.text.trim())
          .slice(-LLM_CONTEXT_TURNS)
          .map((m) => ({ role: m.role, content: m.text })),
      };

      // Incremental "[expression] line" parser: hold output until the tag is
      // resolved (or the scan limit passes), then stream the remainder. The
      // holder keeps TS from narrowing the closure-assigned playback away.
      const state: { playback: LinePlayback | null; consumed: number } = {
        playback: null,
        consumed: 0,
      };

      const handleChunk = (acc: string) => {
        if (!state.playback) {
          const m = acc.match(/^\s*\[([^\]\n]{1,30})\]\s*/);
          if (m) {
            const tag = m[1].trim().toLowerCase();
            const expr = pack.expressions.includes(tag) ? tag : pack.defaultExpression;
            state.consumed = m[0].length;
            setThinking(false);
            state.playback = beginLine(expr);
            pushLine(state.playback, acc.slice(state.consumed));
            return;
          }
          if (acc.length < TAG_SCAN_LIMIT && !acc.includes("]")) return; // keep waiting
          // No usable tag — speak everything with the default face.
          setThinking(false);
          state.playback = beginLine(pack.defaultExpression);
          pushLine(state.playback, acc.slice(state.consumed));
          return;
        }
        pushLine(state.playback, acc.slice(state.consumed));
      };

      const text = await run("companion", ctx, handleChunk);
      setThinking(false);
      if (!text.trim()) {
        // Provider failed or rate-limited: banter must never surface an error.
        finalizeActive();
        if (opts.fallbackKey) speakCanned(opts.fallbackKey, {});
        return;
      }
      handleChunk(text);
      state.playback?.finish();
    },
    [beginLine, finalizeActive, pushLine, run, speakCanned],
  );

  /** Proactive path with quiet-while-typing: defer once, then drop. */
  const speakProactively = useCallback((fn: () => void) => {
    const attempt = (isRetry: boolean) => {
      if (speakingRef.current) return; // never talk over an active line
      if (Date.now() - getLastActivityAt() < TYPING_QUIET_MS) {
        if (isRetry) return; // second strike — drop it
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(() => attempt(true), TYPING_RETRY_MS);
        return;
      }
      noteProactive(directorRef.current, Date.now());
      fn();
    };
    attempt(false);
  }, []);

  const handleEvent = useCallback(
    (event: CompanionEvent) => {
      const { manifest, chattiness } = inputRef.current;
      if (!manifest) return;
      const decision = decide(event, chattiness, directorRef.current);
      switch (decision.kind) {
        case "drop":
          return;
        case "display": {
          // Absorbed coach nudge — important; queue it if a line is playing.
          const show = () => {
            const m = decision.text.match(/^\s*\[([^\]\n]{1,30})\]\s*/);
            const tag = m ? m[1].trim().toLowerCase() : null;
            const text = m ? decision.text.slice(m[0].length) : decision.text;
            speakText(text, tag ?? "thinking");
          };
          if (speakingRef.current) pendingRef.current = show;
          else show();
          return;
        }
        case "canned":
          speakProactively(() => speakCanned(decision.eventKey, decision.vars));
          return;
        case "llm": {
          const fallbackKey =
            event.type === "verdict" ? event.verdict : event.type === "solved" ? "solved" : undefined;
          const speak = () =>
            void speakLlm({ eventSummary: decision.eventSummary, fallbackKey });
          if (event.type === "solved" && speakingRef.current) {
            pendingRef.current = speak; // celebrations queue rather than drop
            return;
          }
          speakProactively(speak);
          return;
        }
      }
    },
    [speakCanned, speakLlm, speakProactively, speakText],
  );

  /** Session greeting (widget gates it to once per browser session). */
  const greet = useCallback(() => {
    speakProactively(() => speakCanned("greeting", {}));
  }, [speakCanned, speakProactively]);

  /** User typed a reply — always answered, interrupts anything playing. */
  const sendReply = useCallback(
    (message: string) => {
      const trimmed = message.trim();
      if (!trimmed) return;
      pendingRef.current = null;
      finalizeActive();
      commit((prev) => [
        ...prev,
        { id: ++lineIdRef.current, role: "user", text: trimmed, done: true, at: Date.now() },
      ]);
      void speakLlm({ userMessage: trimmed });
    },
    [commit, finalizeActive, speakLlm],
  );

  const clearHistory = useCallback(() => {
    finalizeActive();
    pendingRef.current = null;
    commit(() => []);
  }, [commit, finalizeActive]);

  const lastMessage = messages[messages.length - 1];
  const activeExpression =
    [...messages].reverse().find((m) => m.role === "assistant")?.expression ?? null;

  return {
    messages,
    /** True while the newest assistant line is still typing itself out. */
    speaking: Boolean(lastMessage && lastMessage.role === "assistant" && !lastMessage.done),
    activeExpression,
    mouthOpen,
    thinking,
    handleEvent,
    greet,
    sendReply,
    clearHistory,
  };
}
