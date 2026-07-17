// Persisted AI settings: which provider is active, the fallback order, and
// per-provider overrides (keys, models, endpoint). Stored as settings.json next
// to progress.json in the per-user data dir. Serialized writes + atomic rename,
// mirroring lib/store/progress.ts.

import { promises as fs } from "fs";
import path from "path";
import { dataDir } from "@/lib/store/paths";
import type { ProviderId } from "./types";
import { ALL_PROVIDER_IDS, envKeyFor, labelFor, presetFor } from "./presets";

export interface StoredProviderOverride {
  apiKey?: string;
  baseURL?: string;
  heavyModel?: string;
  lightModel?: string;
  supportsImages?: boolean;
  enabled?: boolean;
}

export interface AiSettings {
  version: 1;
  activeProvider: ProviderId;
  fallbackChain: ProviderId[];
  providers: Partial<Record<ProviderId, StoredProviderOverride>>;
}

// Fully-resolved config the router/providers actually use.
export interface ResolvedProvider {
  id: ProviderId;
  label: string;
  enabled: boolean;
  apiKey?: string;
  baseURL: string;
  heavyModel: string;
  lightModel: string;
  supportsImages: boolean;
  /** True when the provider can actually be called (claude always; others need key + endpoint + model). */
  configured: boolean;
  /** Whether an env var currently supplies the key (so the UI won't let it be edited away). */
  keyFromEnv: boolean;
}

const DEFAULT_SETTINGS: AiSettings = {
  version: 1,
  activeProvider: "claude",
  fallbackChain: [],
  providers: {},
};

function settingsFile(): string {
  return path.join(dataDir(), "settings.json");
}

let writeChain: Promise<unknown> = Promise.resolve();

export async function getSettings(): Promise<AiSettings> {
  try {
    const raw = await fs.readFile(settingsFile(), "utf8");
    const parsed = JSON.parse(raw) as Partial<AiSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      providers: parsed.providers ?? {},
      fallbackChain: sanitizeChain(parsed.fallbackChain),
      activeProvider: isProviderId(parsed.activeProvider)
        ? parsed.activeProvider
        : "claude",
    };
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

async function writeSettings(data: AiSettings): Promise<void> {
  await fs.mkdir(dataDir(), { recursive: true });
  const tmp = settingsFile() + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, settingsFile());
}

export async function updateSettings(
  fn: (s: AiSettings) => void | Promise<void>,
): Promise<AiSettings> {
  const run = async () => {
    const data = await getSettings();
    await fn(data);
    await writeSettings(data);
    return data;
  };
  const result = writeChain.then(run, run);
  writeChain = result.catch(() => {});
  return result;
}

function isProviderId(v: unknown): v is ProviderId {
  return typeof v === "string" && (ALL_PROVIDER_IDS as string[]).includes(v);
}

function sanitizeChain(chain: unknown): ProviderId[] {
  if (!Array.isArray(chain)) return [];
  const seen = new Set<ProviderId>();
  for (const id of chain) {
    if (isProviderId(id)) seen.add(id);
  }
  return [...seen];
}

/** Env var wins over a stored key so ops can inject keys without touching the file. */
export function resolveKey(
  id: ProviderId,
  override?: StoredProviderOverride,
): { key?: string; fromEnv: boolean } {
  const envName = envKeyFor(id);
  const envVal = envName ? process.env[envName]?.trim() : undefined;
  if (envVal) return { key: envVal, fromEnv: true };
  const stored = override?.apiKey?.trim();
  return { key: stored || undefined, fromEnv: false };
}

export function resolveProvider(
  id: ProviderId,
  settings: AiSettings,
): ResolvedProvider {
  const override = settings.providers[id] ?? {};
  const preset = presetFor(id); // null for claude
  const { key, fromEnv } = resolveKey(id, override);

  const baseURL = override.baseURL?.trim() || preset?.baseURL || "";
  const heavyModel = override.heavyModel?.trim() || preset?.heavyModel || "";
  const lightModel =
    override.lightModel?.trim() || preset?.lightModel || heavyModel;
  const supportsImages =
    override.supportsImages ?? preset?.supportsImages ?? false;

  const configured =
    id === "claude"
      ? true
      : Boolean(key && baseURL && heavyModel);

  return {
    id,
    label: labelFor(id),
    enabled: override.enabled ?? id === "claude", // claude on by default
    apiKey: key,
    baseURL,
    heavyModel,
    lightModel,
    supportsImages,
    configured,
    keyFromEnv: fromEnv,
  };
}

export function resolveAllProviders(settings: AiSettings): ResolvedProvider[] {
  return ALL_PROVIDER_IDS.map((id) => resolveProvider(id, settings));
}

/**
 * The ordered list of providers to try: active provider first, then the
 * fallback chain, deduped, keeping only enabled + configured ones.
 */
export function resolveCandidateChain(settings: AiSettings): ResolvedProvider[] {
  const order: ProviderId[] = [settings.activeProvider, ...settings.fallbackChain];
  const seen = new Set<ProviderId>();
  const out: ResolvedProvider[] = [];
  for (const id of order) {
    if (seen.has(id)) continue;
    seen.add(id);
    const r = resolveProvider(id, settings);
    if (r.enabled && r.configured) out.push(r);
  }
  return out;
}
