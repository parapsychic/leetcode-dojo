import { NextRequest } from "next/server";
import { openStream, runChat, primaryFor, type OpenStreamResult } from "@/lib/ai/router";
import { ProviderError } from "@/lib/ai/types";
import { guardStream } from "@/lib/claude/guard";
import { GUARDED_MODES, type ClaudeMode, type PromptContext } from "@/lib/claude/prompts";
import { VizSpecSchema, QuizSchema, CoachPlanSchema, DailyDigestSchema, extractJson } from "@/lib/claude/schemas";
import { cacheGet, cacheSet } from "@/lib/cache/diskCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const JSON_MODES: ClaudeMode[] = ["quiz", "visualize", "coachPlan", "daily"];

// Conversational modes whose replies depend on live, turn-by-turn judgement —
// caching them would make the interviewer/coach repeat themselves. Everything
// else (learning, stub generation, review, hints, quizzes…) is deterministic for
// a given input, so identical requests are served from disk instead of re-calling
// the model.
const UNCACHED_MODES: ClaudeMode[] = ["interview", "coach"];
const LLM_CACHE_NS = "llm";
const LLM_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function isCacheable(mode: ClaudeMode): boolean {
  return !UNCACHED_MODES.includes(mode);
}

// The cache key includes the provider + model that produces the answer, so a
// Gemini response is never served when Claude is active (and vice-versa). Reads
// use the *primary* candidate's signature; writes use whoever actually served —
// so the common (no-fallback) path caches perfectly, and a fallback answer is
// simply regenerated next time rather than risk a cross-provider hit.
function llmCacheKey(
  mode: ClaudeMode,
  ctx: PromptContext,
  sig: { providerId: string; model: string },
): string {
  return JSON.stringify({ mode, ctx, p: sig.providerId, m: sig.model });
}

interface Body {
  mode: ClaudeMode;
  ctx: PromptContext;
}

function authErrorResponse(message: string) {
  return Response.json(
    {
      error: "ai_auth",
      message:
        "Couldn't reach an AI provider. Check your Claude Code session (/login) or add a fallback provider in Settings. (" +
        message +
        ")",
    },
    { status: 401 },
  );
}

function providerErrorResponse(message: string) {
  return Response.json(
    {
      error: "ai_unavailable",
      message:
        "No AI provider could answer. Check Settings and your provider keys. (" +
        message +
        ")",
    },
    { status: 502 },
  );
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const { mode, ctx } = body;
  if (!mode) return Response.json({ error: "missing_mode" }, { status: 400 });

  const cacheable = isCacheable(mode);
  // Primary candidate signature for cache *reads*.
  const primarySig = (await primaryFor(mode)) ?? { providerId: "none", model: "none" };
  const readKey = llmCacheKey(mode, ctx, primarySig);

  // ---- Structured (JSON) modes: run to completion, validate, return JSON ----
  if (JSON_MODES.includes(mode)) {
    try {
      if (cacheable) {
        const hit = await cacheGet<Record<string, unknown>>(LLM_CACHE_NS, readKey);
        if (hit && hit.ageMs < LLM_TTL_MS) {
          return Response.json(hit.value, {
            headers: { "X-AI-Provider": primarySig.providerId },
          });
        }
      }
      const { text, providerId, model } = await runChat(mode, ctx, req.signal);
      const jsonStr = extractJson(text) ?? text;
      const parsed = JSON.parse(jsonStr);
      let payload: Record<string, unknown>;
      if (mode === "quiz") {
        payload = { quiz: QuizSchema.parse(parsed) };
      } else if (mode === "coachPlan") {
        payload = { plan: CoachPlanSchema.parse(parsed) };
      } else if (mode === "daily") {
        payload = { daily: DailyDigestSchema.parse(parsed) };
      } else {
        payload = { viz: VizSpecSchema.parse(parsed) };
      }
      if (cacheable) {
        await cacheSet(LLM_CACHE_NS, llmCacheKey(mode, ctx, { providerId, model }), payload);
      }
      return Response.json(payload, { headers: { "X-AI-Provider": providerId } });
    } catch (err) {
      if (err instanceof ProviderError && err.kind === "auth")
        return authErrorResponse(err.message);
      if (err instanceof ProviderError)
        return providerErrorResponse(err.message);
      return Response.json(
        {
          error: "parse_failed",
          message:
            "The AI response didn't match the expected format. Try again.",
        },
        { status: 502 },
      );
    }
  }

  // ---- Streaming text modes ----
  const guarded = GUARDED_MODES.includes(mode);
  const encoder = new TextEncoder();

  // Cache hit: replay the previously stored (already guarded) text as one chunk.
  if (cacheable) {
    const hit = await cacheGet<string>(LLM_CACHE_NS, readKey);
    if (hit && hit.ageMs < LLM_TTL_MS) {
      return new Response(hit.value, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
          "X-AI-Provider": primarySig.providerId,
        },
      });
    }
  }

  // Resolve the provider (may fall back) before building the stream so we can set
  // the provider header and cache under whoever actually serves.
  let opened: OpenStreamResult;
  try {
    opened = await openStream(mode, ctx, req.signal);
  } catch (err) {
    if (err instanceof ProviderError && err.kind === "auth")
      return authErrorResponse(err.message);
    return providerErrorResponse(
      err instanceof Error ? err.message : String(err),
    );
  }

  const writeKey = llmCacheKey(mode, ctx, {
    providerId: opened.providerId,
    model: opened.model,
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const src = guarded ? guardStream(opened.stream) : opened.stream;
        let full = "";
        for await (const chunk of src) {
          full += chunk;
          controller.enqueue(encoder.encode(chunk));
        }
        // Only cache complete, successful responses.
        if (cacheable && full.trim()) {
          await cacheSet(LLM_CACHE_NS, writeKey, full);
        }
        controller.close();
      } catch (err) {
        // A mid-stream failure (provider already committed) — surface inline.
        const message = err instanceof Error ? err.message : String(err);
        const prefix =
          err instanceof ProviderError && err.kind === "auth"
            ? "\n\n[⚠️ AI provider session unavailable — check /login or Settings.]"
            : "\n\n[⚠️ Error: " + message + "]";
        controller.enqueue(encoder.encode(prefix));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      "X-AI-Provider": opened.providerId,
    },
  });
}
