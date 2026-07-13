import {
  query,
  type Options,
  type SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { buildPrompts, type ClaudeMode, type PromptContext } from "./prompts";

// Reasoning-heavy modes use Opus; light/structured modes can use a faster model.
const HEAVY: ClaudeMode[] = ["review", "interview"];
const MODEL_HEAVY = "claude-opus-4-8";
const MODEL_LIGHT = "claude-opus-4-8"; // keep on Opus; Claude Code provides the model

function modelFor(mode: ClaudeMode): string {
  return HEAVY.includes(mode) ? MODEL_HEAVY : MODEL_LIGHT;
}

function baseOptions(mode: ClaudeMode, system: string): Options {
  return {
    model: modelFor(mode),
    systemPrompt: system, // plain string => focused tutor, NOT the claude_code preset
    tools: [], // no filesystem/bash — text-only reasoning
    settingSources: [], // ignore user/project .claude settings for isolation
    permissionMode: "bypassPermissions",
    includePartialMessages: true,
    maxTurns: 1,
  };
}

export class ClaudeAuthError extends Error {}

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

// Build a single-turn streaming-input prompt carrying text + an image block.
// Used when the learner shares a whiteboard sketch with the coach.
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
  // SDKAssistantMessage.message.content is a list of content blocks.
  const content = (message as { message?: { content?: unknown } })?.message
    ?.content;
  if (!Array.isArray(content)) return "";
  return content
    .map((b) => (b && (b as { type?: string }).type === "text" ? (b as { text: string }).text : ""))
    .join("");
}

/**
 * Stream Claude's response text for a mode. Yields incremental text chunks.
 */
export async function* streamClaude(
  mode: ClaudeMode,
  ctx: PromptContext,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const { system, prompt } = buildPrompts(mode, ctx);
  const abortController = new AbortController();
  if (signal) {
    if (signal.aborted) abortController.abort();
    else signal.addEventListener("abort", () => abortController.abort());
  }

  let streamedAny = false;
  let lastAssistantText = "";

  try {
    const promptInput =
      ctx.imageBase64
        ? imagePrompt(prompt, {
            base64: ctx.imageBase64,
            mediaType: ctx.imageMediaType ?? "image/png",
          })
        : prompt;
    const q = query({
      prompt: promptInput,
      options: { ...baseOptions(mode, system), abortController },
    });

    for await (const msg of q) {
      const m = msg as { type: string; event?: unknown };
      if (m.type === "stream_event") {
        const ev = m.event as {
          type?: string;
          delta?: { type?: string; text?: string };
        };
        if (ev?.type === "content_block_delta" && ev.delta?.type === "text_delta") {
          streamedAny = true;
          yield ev.delta.text || "";
        }
      } else if (m.type === "assistant") {
        lastAssistantText = textFromAssistant(msg);
      } else if (m.type === "result") {
        // done
      }
    }

    // If partial streaming yielded nothing, emit the assembled assistant text.
    if (!streamedAny && lastAssistantText) {
      yield lastAssistantText;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (looksLikeAuthError(message)) {
      throw new ClaudeAuthError(message);
    }
    throw err;
  }
}

/** Collect the full response text (for JSON modes: quiz, visualize, variation). */
export async function runClaude(
  mode: ClaudeMode,
  ctx: PromptContext,
  signal?: AbortSignal,
): Promise<string> {
  let out = "";
  for await (const chunk of streamClaude(mode, ctx, signal)) out += chunk;
  return out;
}

/** Lightweight check that the Claude Code session is usable. */
export async function checkClaudeAuth(): Promise<{ ok: boolean; error?: string }> {
  try {
    const text = await runClaude("ask", {
      userMessage: 'Reply with exactly the word "ok".',
    });
    return { ok: text.toLowerCase().includes("ok") };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
