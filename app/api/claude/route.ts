import { NextRequest } from "next/server";
import { streamClaude, runClaude, ClaudeAuthError } from "@/lib/claude/client";
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

// Identical {mode, ctx} ⇒ identical prompt ⇒ identical key. (diskCache hashes it.)
function llmCacheKey(mode: ClaudeMode, ctx: PromptContext): string {
  return JSON.stringify({ mode, ctx });
}

interface Body {
  mode: ClaudeMode;
  ctx: PromptContext;
}

function authErrorResponse(message: string) {
  return Response.json(
    {
      error: "claude_auth",
      message:
        "Couldn't reach your Claude Code session. Open Claude Code and run /login, then retry. (" +
        message +
        ")",
    },
    { status: 401 },
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
  const cacheKey = llmCacheKey(mode, ctx);

  // ---- Structured (JSON) modes: run to completion, validate, return JSON ----
  if (JSON_MODES.includes(mode)) {
    try {
      if (cacheable) {
        const hit = await cacheGet<Record<string, unknown>>(LLM_CACHE_NS, cacheKey);
        if (hit && hit.ageMs < LLM_TTL_MS) return Response.json(hit.value);
      }
      const text = await runClaude(mode, ctx, req.signal);
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
      if (cacheable) await cacheSet(LLM_CACHE_NS, cacheKey, payload);
      return Response.json(payload);
    } catch (err) {
      if (err instanceof ClaudeAuthError) return authErrorResponse(err.message);
      return Response.json(
        {
          error: "parse_failed",
          message:
            "Claude's response didn't match the expected format. Try again.",
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
    const hit = await cacheGet<string>(LLM_CACHE_NS, cacheKey);
    if (hit && hit.ageMs < LLM_TTL_MS) {
      return new Response(hit.value, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
        },
      });
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const raw = streamClaude(mode, ctx, req.signal);
        const src = guarded ? guardStream(raw) : raw;
        let full = "";
        for await (const chunk of src) {
          full += chunk;
          controller.enqueue(encoder.encode(chunk));
        }
        // Only cache complete, successful responses (the catch below never runs
        // here, so reaching this point means the stream finished cleanly).
        if (cacheable && full.trim()) {
          await cacheSet(LLM_CACHE_NS, cacheKey, full);
        }
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const prefix =
          err instanceof ClaudeAuthError
            ? "\n\n[⚠️ Claude Code session unavailable — open Claude Code and run /login.]"
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
    },
  });
}
