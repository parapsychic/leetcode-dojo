// Claude provider — wraps the Claude Code Agent SDK. Uses the local Claude Code
// session (no API key). This is the extraction of the original lib/claude/client.ts
// into the AiProvider shape.

import {
  query,
  type Options,
  type SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import {
  ProviderError,
  type AiProvider,
  type ChatRequest,
  type HealthResult,
  type ModelTier,
} from "../types";
import { CLAUDE_LABEL } from "../presets";

// Claude Code supplies the model; keep both tiers on Opus.
const MODEL_HEAVY = "claude-opus-4-8";
const MODEL_LIGHT = "claude-opus-4-8";

function baseOptions(system: string, model: string): Options {
  return {
    model,
    systemPrompt: system, // plain string => focused tutor, NOT the claude_code preset
    tools: [], // no filesystem/bash — text-only reasoning
    settingSources: [], // ignore user/project .claude settings for isolation
    permissionMode: "bypassPermissions",
    includePartialMessages: true,
    maxTurns: 1,
  };
}

function looksLikeAuthError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("not logged in") ||
    m.includes("unauthorized") ||
    m.includes("authentication") ||
    m.includes("login") ||
    m.includes("no credentials") ||
    m.includes("api key")
  );
}

function looksLikeRateLimit(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("rate limit") ||
    m.includes("usage limit") ||
    m.includes("quota") ||
    m.includes("overloaded") ||
    m.includes("429") ||
    m.includes("exceeded")
  );
}

function toProviderError(message: string): ProviderError {
  if (looksLikeAuthError(message))
    return new ProviderError(message, "auth", "claude");
  if (looksLikeRateLimit(message))
    return new ProviderError(message, "rate_limit", "claude");
  return new ProviderError(message, "unavailable", "claude");
}

// Single-turn streaming-input prompt carrying text + an image block (whiteboard).
async function* imagePrompt(
  text: string,
  image: { base64: string; mediaType: string },
): AsyncGenerator<SDKUserMessage> {
  yield {
    type: "user",
    parent_tool_use_id: null,
    session_id: "",
    message: {
      role: "user",
      content: [
        { type: "text", text },
        {
          type: "image",
          source: {
            type: "base64",
            media_type: image.mediaType as "image/png",
            data: image.base64,
          },
        },
      ],
    },
  } as unknown as SDKUserMessage;
}

function textFromAssistant(message: unknown): string {
  const content = (message as { message?: { content?: unknown } })?.message
    ?.content;
  if (!Array.isArray(content)) return "";
  return content
    .map((b) =>
      b && (b as { type?: string }).type === "text"
        ? (b as { text: string }).text
        : "",
    )
    .join("");
}

async function* streamChat(req: ChatRequest): AsyncGenerator<string> {
  const abortController = new AbortController();
  const signal = req.signal;
  if (signal) {
    if (signal.aborted) abortController.abort();
    else signal.addEventListener("abort", () => abortController.abort());
  }

  let streamedAny = false;
  let lastAssistantText = "";

  try {
    const model = req.tier === "heavy" ? MODEL_HEAVY : MODEL_LIGHT;
    const promptInput = req.image
      ? imagePrompt(req.prompt, {
          base64: req.image.base64,
          mediaType: req.image.mediaType,
        })
      : req.prompt;
    const q = query({
      prompt: promptInput,
      options: { ...baseOptions(req.system, model), abortController },
    });

    for await (const msg of q) {
      const m = msg as { type: string; event?: unknown };
      if (m.type === "stream_event") {
        const ev = m.event as {
          type?: string;
          delta?: { type?: string; text?: string };
        };
        if (
          ev?.type === "content_block_delta" &&
          ev.delta?.type === "text_delta"
        ) {
          streamedAny = true;
          yield ev.delta.text || "";
        }
      } else if (m.type === "assistant") {
        lastAssistantText = textFromAssistant(msg);
      }
    }

    if (!streamedAny && lastAssistantText) {
      yield lastAssistantText;
    }
  } catch (err) {
    if (signal?.aborted) return;
    const message = err instanceof Error ? err.message : String(err);
    throw toProviderError(message);
  }
}

export const claudeProvider: AiProvider = {
  id: "claude",
  label: CLAUDE_LABEL,
  supportsImages: true,
  modelFor(tier: ModelTier): string {
    return tier === "heavy" ? MODEL_HEAVY : MODEL_LIGHT;
  },
  streamChat,
  async healthCheck(signal?: AbortSignal): Promise<HealthResult> {
    try {
      let out = "";
      for await (const chunk of streamChat({
        system:
          "You are a health check. Reply with exactly the word ok and nothing else.",
        prompt: 'Reply with exactly the word "ok".',
        tier: "light",
        signal,
      })) {
        out += chunk;
      }
      return { ok: out.toLowerCase().includes("ok") };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
