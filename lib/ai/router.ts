// The fallback engine. Turns a (mode, ctx) into a streamed reply by walking the
// candidate chain (active provider first, then the configured fallbacks) and
// falling through to the next provider only *before the first byte* is emitted —
// once a provider starts answering we commit to it, so a mid-answer failure is
// surfaced rather than silently switching providers.

import { buildPrompts, type ClaudeMode, type PromptContext } from "@/lib/claude/prompts";
import {
  ProviderError,
  isRetryableKind,
  type AiProvider,
  type ChatImage,
  type ModelTier,
  type ProviderId,
} from "./types";
import {
  getSettings,
  resolveCandidateChain,
  resolveProvider,
  type AiSettings,
  type ResolvedProvider,
} from "./config";
import { normalizeCompanion } from "@/lib/companion/config";
import { claudeProvider } from "./providers/claude";
import { makeOpenAiCompatProvider } from "./providers/openaiCompat";

// Reasoning-heavy modes get the stronger model tier.
const HEAVY_MODES: ClaudeMode[] = ["review", "interview"];

function tierFor(mode: ClaudeMode): ModelTier {
  return HEAVY_MODES.includes(mode) ? "heavy" : "light";
}

function instantiate(cfg: ResolvedProvider): AiProvider {
  if (cfg.id === "claude") return claudeProvider;
  return makeOpenAiCompatProvider(cfg);
}

/**
 * The candidate chain for a mode. Companion banter may declare a dedicated
 * provider/model (typically a free tier) in settings — that candidate is
 * prepended so chatter never spends the tutoring provider's budget, while the
 * normal chain still backs it up. Every other mode uses the chain untouched.
 */
function candidatesFor(mode: ClaudeMode, settings: AiSettings): ResolvedProvider[] {
  const chain = resolveCandidateChain(settings);
  if (mode !== "companion") return chain;
  const companion = normalizeCompanion(settings.companion);
  if (!companion.provider || companion.provider === "claude") return chain;
  const r = resolveProvider(companion.provider, settings);
  if (!r.configured) return chain;
  // The user picked this provider explicitly for the companion, so it counts
  // even if it isn't enabled in the fallback chain. Companion runs on the
  // light tier, so a model override lands there.
  const preferred: ResolvedProvider = companion.model
    ? { ...r, lightModel: companion.model }
    : r;
  return [preferred, ...chain.filter((c) => c.id !== preferred.id)];
}

async function* prepend(
  first: string,
  rest: AsyncGenerator<string>,
): AsyncGenerator<string> {
  yield first;
  yield* rest;
}

export interface OpenStreamResult {
  providerId: ProviderId;
  model: string;
  stream: AsyncGenerator<string>;
}

/**
 * Resolve which provider will answer and return a stream already committed to it.
 * Throws ProviderError if every candidate fails (or a non-retryable error hits
 * before any provider commits).
 */
export async function openStream(
  mode: ClaudeMode,
  ctx: PromptContext,
  signal?: AbortSignal,
): Promise<OpenStreamResult> {
  const settings = await getSettings();
  const candidates = candidatesFor(mode, settings);
  if (candidates.length === 0) {
    throw new ProviderError(
      "No AI provider is configured. Open Settings to add one.",
      "unavailable",
    );
  }

  const { system, prompt } = buildPrompts(mode, ctx);
  const tier = tierFor(mode);
  const image: ChatImage | undefined = ctx.imageBase64
    ? { base64: ctx.imageBase64, mediaType: ctx.imageMediaType ?? "image/png" }
    : undefined;

  // For image requests, try image-capable providers first.
  let ordered = candidates;
  if (image) {
    const capable = candidates.filter((c) => c.supportsImages);
    if (capable.length) {
      ordered = [...capable, ...candidates.filter((c) => !c.supportsImages)];
    }
  }

  const errors: string[] = [];
  for (const cand of ordered) {
    if (signal?.aborted) break;
    const provider = instantiate(cand);
    const useImage = image && provider.supportsImages ? image : undefined;
    const effectivePrompt =
      image && !useImage
        ? `${prompt}\n\n(Note: a whiteboard image was attached, but the current model can't view images — reason from the text only.)`
        : prompt;

    const gen = provider.streamChat({
      system,
      prompt: effectivePrompt,
      tier,
      image: useImage,
      signal,
    });

    try {
      const first = await gen.next();
      if (first.done) {
        // Produced nothing — treat like an outage and try the next provider.
        if (signal?.aborted) break;
        errors.push(`${cand.label}: empty response`);
        continue;
      }
      return {
        providerId: cand.id,
        model: provider.modelFor(tier),
        stream: prepend(first.value, gen),
      };
    } catch (err) {
      const pe =
        err instanceof ProviderError
          ? err
          : new ProviderError(
              err instanceof Error ? err.message : String(err),
              "other",
              cand.id,
            );
      errors.push(`${cand.label}: ${pe.message}`);
      if (isRetryableKind(pe.kind)) continue; // fall through to next provider
      throw pe; // non-retryable: surface immediately
    }
  }

  throw new ProviderError(
    `All configured providers failed. ${errors.join(" | ")}`,
    "unavailable",
  );
}

/**
 * The provider + model that would serve this mode *first* (no fallback applied).
 * Used for cache reads so the common no-fallback path caches perfectly.
 */
export async function primaryFor(
  mode: ClaudeMode,
): Promise<{ providerId: ProviderId; model: string } | null> {
  const settings = await getSettings();
  const candidates = resolveCandidateChain(settings);
  if (candidates.length === 0) return null;
  const c = candidates[0];
  return { providerId: c.id, model: instantiate(c).modelFor(tierFor(mode)) };
}

export interface RunChatResult {
  text: string;
  providerId: ProviderId;
  model: string;
}

/** Collect the full response text (for JSON modes: quiz, visualize, daily…). */
export async function runChat(
  mode: ClaudeMode,
  ctx: PromptContext,
  signal?: AbortSignal,
): Promise<RunChatResult> {
  const { providerId, model, stream } = await openStream(mode, ctx, signal);
  let text = "";
  for await (const chunk of stream) text += chunk;
  return { text, providerId, model };
}

export interface ChainProbe {
  ok: boolean;
  activeProvider: ProviderId;
  servedBy?: ProviderId;
  tried: { id: ProviderId; label: string; ok: boolean; error?: string }[];
}

/**
 * Walk the candidate chain running each provider's health check until one is
 * reachable. Cheap in the common case (only the primary is probed).
 */
export async function probeChain(signal?: AbortSignal): Promise<ChainProbe> {
  const settings = await getSettings();
  const candidates = resolveCandidateChain(settings);
  const tried: ChainProbe["tried"] = [];
  for (const cand of candidates) {
    const res = await instantiate(cand).healthCheck(signal);
    tried.push({ id: cand.id, label: cand.label, ok: res.ok, error: res.error });
    if (res.ok) {
      return {
        ok: true,
        activeProvider: settings.activeProvider,
        servedBy: cand.id,
        tried,
      };
    }
  }
  return { ok: false, activeProvider: settings.activeProvider, tried };
}

/** Test a single provider (Settings "Test" button). */
export async function probeProvider(
  id: ProviderId,
  signal?: AbortSignal,
): Promise<{ id: ProviderId; ok: boolean; error?: string }> {
  const settings = await getSettings();
  const cfg = resolveProvider(id, settings);
  if (!cfg.configured) {
    return { id, ok: false, error: "Not configured (missing key, endpoint, or model)." };
  }
  const res = await instantiate(cfg).healthCheck(signal);
  return { id, ok: res.ok, error: res.error };
}
