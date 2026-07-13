"use client";

import { useCallback, useRef, useState } from "react";
import type { ClaudeMode, PromptContext } from "@/lib/claude/prompts";

export interface StreamState {
  text: string;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to stream a text response from /api/claude. Call `run(mode, ctx)`.
 * Returns live `text` as it streams.
 */
export function useClaudeStream() {
  const [state, setState] = useState<StreamState>({
    text: "",
    loading: false,
    error: null,
  });
  const ctrlRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    ctrlRef.current?.abort();
  }, []);

  const run = useCallback(
    async (
      mode: ClaudeMode,
      ctx: PromptContext,
      onChunk?: (full: string) => void,
    ): Promise<string> => {
      ctrlRef.current?.abort();
      const ctrl = new AbortController();
      ctrlRef.current = ctrl;
      setState({ text: "", loading: true, error: null });

      try {
        const res = await fetch("/api/claude", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, ctx }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || `Request failed (${res.status})`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setState({ text: acc, loading: true, error: null });
          onChunk?.(acc);
        }
        setState({ text: acc, loading: false, error: null });
        return acc;
      } catch (err) {
        if (ctrl.signal.aborted) {
          setState((s) => ({ ...s, loading: false }));
          return "";
        }
        const message = err instanceof Error ? err.message : String(err);
        setState((s) => ({ ...s, loading: false, error: message }));
        return "";
      }
    },
    [],
  );

  return { ...state, run, stop, reset: () => setState({ text: "", loading: false, error: null }) };
}

/** Fetch a structured (JSON) result from /api/claude (quiz / visualize). */
export async function fetchClaudeJson<T>(
  mode: ClaudeMode,
  ctx: PromptContext,
  signal?: AbortSignal,
): Promise<{ data?: T; error?: string }> {
  try {
    const res = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, ctx }),
      signal,
    });
    const json = await res.json();
    if (!res.ok) return { error: json.message || `Failed (${res.status})` };
    return { data: (json.quiz ?? json.viz ?? json.plan ?? json.daily) as T };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
