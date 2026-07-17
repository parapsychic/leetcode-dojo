// Provider-agnostic AI layer. The rest of the app builds a plain {system, prompt}
// (+ optional image) via lib/claude/prompts.ts; a provider turns that into a
// streamed text response. Claude (via the Agent SDK) is one provider; every other
// provider goes through a single OpenAI-compatible client.

export type ProviderId =
  | "claude"
  | "gemini"
  | "openrouter"
  | "groq"
  | "cerebras"
  | "mistral"
  | "custom";

// Reasoning-heavy modes get the stronger model; everything else the lighter one.
export type ModelTier = "heavy" | "light";

export interface ChatImage {
  base64: string; // no data: prefix
  mediaType: string; // e.g. "image/png"
}

export interface ChatRequest {
  system: string;
  prompt: string;
  tier: ModelTier;
  image?: ChatImage;
  signal?: AbortSignal;
}

export interface HealthResult {
  ok: boolean;
  error?: string;
}

export interface AiProvider {
  id: ProviderId;
  label: string;
  supportsImages: boolean;
  /** Stream the model's reply as incremental text chunks. */
  streamChat(req: ChatRequest): AsyncGenerator<string>;
  /** Cheap reachability/auth probe used by the banner and Settings "Test". */
  healthCheck(signal?: AbortSignal): Promise<HealthResult>;
  /** The model that would be used for a tier — surfaced for cache keys/UI. */
  modelFor(tier: ModelTier): string;
}

export type ProviderErrorKind = "auth" | "rate_limit" | "unavailable" | "other";

/**
 * Shared error type across providers. `kind` decides whether the router should
 * fall through to the next provider (auth / rate_limit / unavailable) or surface
 * the error as-is (other).
 */
export class ProviderError extends Error {
  kind: ProviderErrorKind;
  providerId?: ProviderId;
  constructor(message: string, kind: ProviderErrorKind, providerId?: ProviderId) {
    super(message);
    this.name = "ProviderError";
    this.kind = kind;
    this.providerId = providerId;
  }
}

export function isRetryableKind(kind: ProviderErrorKind): boolean {
  return kind === "auth" || kind === "rate_limit" || kind === "unavailable";
}
