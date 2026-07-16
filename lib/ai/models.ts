// Lists the models a provider exposes, normalized for the Settings model picker.
// OpenRouter's /models is public and rich (pricing + modalities); the other
// OpenAI-compatible providers expose a plainer /models list that needs the key.

import type { ProviderId } from "./types";
import type { ResolvedProvider } from "./config";
import { presetFor } from "./presets";
import { cacheGet, cacheSet } from "@/lib/cache/diskCache";

export interface ModelInfo {
  id: string;
  name?: string;
  free?: boolean; // known zero-cost (OpenRouter). undefined = unknown.
  vision?: boolean; // can accept images. undefined = unknown.
  contextLength?: number;
  recommended?: boolean;
}

export interface ListModelsResult {
  models: ModelInfo[];
  error?: string;
}

const CACHE_NS = "models";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24h

function modelsEndpoint(baseURL: string): string {
  return baseURL.replace(/\/+$/, "") + "/models";
}

function authHeaders(cfg: ResolvedProvider): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/json" };
  if (cfg.apiKey) h.Authorization = `Bearer ${cfg.apiKey}`;
  const extra = presetFor(cfg.id)?.extraHeaders;
  if (extra) Object.assign(h, extra);
  return h;
}

// ---- Provider-specific normalization ----

interface OpenRouterModel {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
  architecture?: { input_modalities?: string[] };
}

function normalizeOpenRouter(data: OpenRouterModel[]): ModelInfo[] {
  return data.map((m) => {
    const prompt = m.pricing?.prompt;
    const completion = m.pricing?.completion;
    const free =
      prompt !== undefined && completion !== undefined
        ? Number(prompt) === 0 && Number(completion) === 0
        : undefined;
    const modalities = m.architecture?.input_modalities;
    const vision = modalities ? modalities.includes("image") : undefined;
    return {
      id: m.id,
      name: m.name,
      free,
      vision,
      contextLength: m.context_length,
    };
  });
}

interface OpenAiModel {
  id: string;
  // Mistral surfaces capabilities; others usually don't.
  capabilities?: { vision?: boolean };
  context_length?: number;
  max_context_length?: number;
}

function normalizeOpenAiList(data: OpenAiModel[]): ModelInfo[] {
  return data
    .filter((m) => typeof m.id === "string")
    .map((m) => ({
      id: m.id,
      vision: m.capabilities?.vision,
      contextLength: m.context_length ?? m.max_context_length,
    }));
}

// Attach recommended flags and float recommended entries (in preset order) to the
// top. Recommended ids missing from the live list are still surfaced as options.
function applyRecommended(id: ProviderId, models: ModelInfo[]): ModelInfo[] {
  const recommended = presetFor(id)?.recommended ?? [];
  const rank = new Map(recommended.map((r, i) => [r, i]));
  const byId = new Map(models.map((m) => [m.id, m]));
  for (const rid of recommended) {
    const existing = byId.get(rid);
    if (existing) existing.recommended = true;
    else {
      const stub: ModelInfo = { id: rid, recommended: true };
      byId.set(rid, stub);
      models.push(stub);
    }
  }
  return [...byId.values()].sort((a, b) => {
    const ra = rank.has(a.id) ? rank.get(a.id)! : Infinity;
    const rb = rank.has(b.id) ? rank.get(b.id)! : Infinity;
    if (ra !== rb) return ra - rb; // recommended first, in curated order
    return a.id.localeCompare(b.id);
  });
}

export async function listModels(
  cfg: ResolvedProvider,
  signal?: AbortSignal,
  opts?: { fresh?: boolean },
): Promise<ListModelsResult> {
  // OpenRouter's list is public; the rest need a key.
  if (cfg.id !== "openrouter" && cfg.id !== "custom" && !cfg.apiKey) {
    return { models: applyRecommended(cfg.id, []), error: "Add an API key to load the full model list." };
  }
  if (!cfg.baseURL) {
    return { models: applyRecommended(cfg.id, []), error: "Set a base URL first." };
  }

  const cacheKey = `${cfg.id}:${cfg.baseURL}:${cfg.apiKey ? "keyed" : "anon"}`;
  if (!opts?.fresh) {
    const hit = await cacheGet<ModelInfo[]>(CACHE_NS, cacheKey);
    if (hit && hit.ageMs < CACHE_TTL_MS) {
      return { models: applyRecommended(cfg.id, hit.value) };
    }
  }

  try {
    const res = await fetch(modelsEndpoint(cfg.baseURL), {
      headers: authHeaders(cfg),
      signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return {
        models: applyRecommended(cfg.id, []),
        error: `Couldn't load models (${res.status}). ${detail.slice(0, 160)}`,
      };
    }
    const json = (await res.json()) as { data?: unknown[] };
    const data = Array.isArray(json.data) ? json.data : [];
    const normalized =
      cfg.id === "openrouter"
        ? normalizeOpenRouter(data as OpenRouterModel[])
        : normalizeOpenAiList(data as OpenAiModel[]);
    // Cache the raw normalized list (without recommended flags, which are cheap
    // to re-apply and may change with presets).
    await cacheSet(CACHE_NS, cacheKey, normalized);
    return { models: applyRecommended(cfg.id, normalized) };
  } catch (err) {
    return {
      models: applyRecommended(cfg.id, []),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
