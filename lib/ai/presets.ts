// Built-in defaults for each provider. Everything here is overridable per-user in
// Settings — free model slugs and endpoints change, so these are just sensible
// starting points (current as of mid-2026). "claude" has no preset: it uses the
// local Claude Code session via the Agent SDK, not an HTTP endpoint.

import type { ProviderId } from "./types";

export interface ProviderPreset {
  label: string;
  baseURL: string; // OpenAI-compatible base (…/v1). chat/completions is appended.
  heavyModel: string;
  lightModel: string;
  supportsImages: boolean;
  envKey?: string; // env var that overrides a stored key
  signupUrl?: string; // where to get a key (shown in Settings)
  // Extra headers some providers want (e.g. OpenRouter attribution).
  extraHeaders?: Record<string, string>;
  // A short curated shortlist (model ids) surfaced at the top of the picker as
  // "recommended" — a good default even when the live /models list is empty.
  recommended?: string[];
}

// Providers that go through the generic OpenAI-compatible client.
export const OPENAI_COMPAT_PRESETS: Record<
  Exclude<ProviderId, "claude" | "custom">,
  ProviderPreset
> = {
  gemini: {
    label: "Google Gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    heavyModel: "gemini-2.5-flash",
    lightModel: "gemini-2.5-flash-lite",
    supportsImages: true,
    envKey: "GEMINI_API_KEY",
    signupUrl: "https://aistudio.google.com/apikey",
    recommended: [
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      "gemini-2.5-pro",
    ],
  },
  openrouter: {
    label: "OpenRouter",
    baseURL: "https://openrouter.ai/api/v1",
    heavyModel: "qwen/qwen3-coder:free",
    lightModel: "qwen/qwen3-coder:free",
    supportsImages: false,
    envKey: "OPENROUTER_API_KEY",
    signupUrl: "https://openrouter.ai/keys",
    extraHeaders: {
      "HTTP-Referer": "https://github.com/leetcode-dojo",
      "X-Title": "LeetCode Dojo",
    },
    recommended: [
      "qwen/qwen3-coder:free", // free, 1M ctx, strong coder
      "qwen/qwen3-next-80b-a3b-instruct:free", // free
      "deepseek/deepseek-chat", // paid, strong reasoning
      "qwen/qwen3-coder", // paid
    ],
  },
  groq: {
    label: "Groq",
    baseURL: "https://api.groq.com/openai/v1",
    heavyModel: "llama-3.3-70b-versatile",
    lightModel: "llama-3.3-70b-versatile",
    supportsImages: false,
    envKey: "GROQ_API_KEY",
    signupUrl: "https://console.groq.com/keys",
    recommended: [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
    ],
  },
  cerebras: {
    label: "Cerebras",
    baseURL: "https://api.cerebras.ai/v1",
    heavyModel: "llama-3.3-70b",
    lightModel: "llama-3.3-70b",
    supportsImages: false,
    envKey: "CEREBRAS_API_KEY",
    signupUrl: "https://cloud.cerebras.ai/",
    recommended: ["llama-3.3-70b", "qwen-3-235b-a22b-instruct"],
  },
  mistral: {
    label: "Mistral",
    baseURL: "https://api.mistral.ai/v1",
    heavyModel: "mistral-large-latest",
    lightModel: "mistral-small-latest",
    supportsImages: false,
    envKey: "MISTRAL_API_KEY",
    signupUrl: "https://console.mistral.ai/api-keys/",
    recommended: [
      "mistral-large-latest",
      "mistral-small-latest",
      "codestral-latest",
    ],
  },
};

// A neutral starting point for the "bring your own endpoint" provider.
export const CUSTOM_PRESET: ProviderPreset = {
  label: "Custom (OpenAI-compatible)",
  baseURL: "",
  heavyModel: "",
  lightModel: "",
  supportsImages: false,
  signupUrl: undefined,
};

export const CLAUDE_LABEL = "Claude (Claude Code session)";

export const ALL_PROVIDER_IDS: ProviderId[] = [
  "claude",
  "gemini",
  "openrouter",
  "groq",
  "cerebras",
  "mistral",
  "custom",
];

export function labelFor(id: ProviderId): string {
  if (id === "claude") return CLAUDE_LABEL;
  if (id === "custom") return CUSTOM_PRESET.label;
  return OPENAI_COMPAT_PRESETS[id].label;
}

export function presetFor(id: ProviderId): ProviderPreset | null {
  if (id === "claude") return null;
  if (id === "custom") return CUSTOM_PRESET;
  return OPENAI_COMPAT_PRESETS[id];
}

/** Env var that overrides a stored key for this provider, if any. */
export function envKeyFor(id: ProviderId): string | undefined {
  return presetFor(id)?.envKey;
}
