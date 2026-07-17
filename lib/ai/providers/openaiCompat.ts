// Generic OpenAI-compatible chat provider. Gemini (via its OpenAI-compat
// endpoint), OpenRouter, Groq, Cerebras, Mistral, and any custom endpoint all
// speak this protocol, so one client covers them all. Built from a ResolvedProvider.

import {
  ProviderError,
  type AiProvider,
  type ChatRequest,
  type HealthResult,
  type ModelTier,
} from "../types";
import type { ResolvedProvider } from "../config";
import { presetFor } from "../presets";

interface ChatMessageContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

function userContent(req: ChatRequest): string | ChatMessageContentPart[] {
  if (!req.image) return req.prompt;
  return [
    { type: "text", text: req.prompt },
    {
      type: "image_url",
      image_url: {
        url: `data:${req.image.mediaType};base64,${req.image.base64}`,
      },
    },
  ];
}

function classifyStatus(status: number): "auth" | "rate_limit" | "unavailable" {
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rate_limit";
  return "unavailable"; // 5xx and anything else transient
}

export function makeOpenAiCompatProvider(cfg: ResolvedProvider): AiProvider {
  const preset = presetFor(cfg.id);
  const extraHeaders = preset?.extraHeaders ?? {};

  function endpoint(): string {
    return cfg.baseURL.replace(/\/+$/, "") + "/chat/completions";
  }

  function headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey ?? ""}`,
      ...extraHeaders,
    };
  }

  function modelFor(tier: ModelTier): string {
    return tier === "heavy" ? cfg.heavyModel : cfg.lightModel;
  }

  async function* streamChat(req: ChatRequest): AsyncGenerator<string> {
    // Only send the image to a model that can actually see it.
    const chatReq: ChatRequest =
      req.image && !cfg.supportsImages ? { ...req, image: undefined } : req;

    let res: Response;
    try {
      res = await fetch(endpoint(), {
        method: "POST",
        headers: headers(),
        signal: req.signal,
        body: JSON.stringify({
          model: modelFor(req.tier),
          stream: true,
          messages: [
            { role: "system", content: req.system },
            { role: "user", content: userContent(chatReq) },
          ],
        }),
      });
    } catch (err) {
      if (req.signal?.aborted) return;
      const message = err instanceof Error ? err.message : String(err);
      throw new ProviderError(message, "unavailable", cfg.id);
    }

    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      throw new ProviderError(
        `request failed (${res.status})${detail ? `: ${detail.slice(0, 300)}` : ""}`,
        classifyStatus(res.status),
        cfg.id,
      );
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let yielded = false;
    // Some providers (notably OpenRouter) report rate limits / errors as an
    // in-stream frame — `data: {"error":{"message":..,"code":429}}` — with HTTP
    // 200. Capture it so we can surface a real reason instead of an empty stream.
    let pendingError: ProviderError | null = null;

    const errorFrom = (e: { message?: string; code?: number }): ProviderError =>
      new ProviderError(
        e.message ?? "provider error",
        typeof e.code === "number" ? classifyStatus(e.code) : "unavailable",
        cfg.id,
      );

    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by blank lines; process complete lines.
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") {
            if (pendingError && !yielded) throw pendingError;
            return;
          }
          try {
            const json = JSON.parse(data) as {
              choices?: { delta?: { content?: string } }[];
              error?: { message?: string; code?: number };
            };
            if (json.error) {
              pendingError = errorFrom(json.error);
              continue;
            }
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) {
              yielded = true;
              yield delta;
            }
          } catch (e) {
            if (e instanceof ProviderError) throw e;
            // partial/again — ignore malformed frame
          }
        }
      }

      // Stream ended. Surface an error frame we saw but never got past.
      if (pendingError && !yielded) throw pendingError;
      // Or a plain JSON error body (HTTP 200, no SSE frames at all).
      if (!yielded) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith("{")) {
          let parsed: { error?: { message?: string; code?: number } } | null = null;
          try {
            parsed = JSON.parse(trimmed);
          } catch {
            parsed = null; // not a JSON body — nothing to surface
          }
          if (parsed?.error) throw errorFrom(parsed.error);
        }
      }
    } catch (err) {
      if (req.signal?.aborted) return;
      if (err instanceof ProviderError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      throw new ProviderError(message, "unavailable", cfg.id);
    }
  }

  return {
    id: cfg.id,
    label: cfg.label,
    supportsImages: cfg.supportsImages,
    modelFor,
    streamChat,
    async healthCheck(signal?: AbortSignal): Promise<HealthResult> {
      try {
        let out = "";
        for await (const chunk of streamChat({
          system: "Reply with exactly the word ok and nothing else.",
          prompt: 'Reply with exactly the word "ok".',
          tier: "light",
          signal,
        })) {
          out += chunk;
          if (out.length > 20) break; // enough to confirm reachability
        }
        return out.trim().length > 0
          ? { ok: true }
          : { ok: false, error: "Returned an empty response." };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  };
}
