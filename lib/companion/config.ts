// Companion settings live inside settings.json (lib/ai/config.ts) under the
// `companion` key — same one-file, one-save-path pattern as `sync`. No secrets
// here, so no redaction/env machinery is needed.

import { getSettings } from "@/lib/ai/config";
import type { ProviderId } from "@/lib/ai/types";
import { ALL_PROVIDER_IDS } from "@/lib/ai/presets";

export type Chattiness = "quiet" | "normal" | "chatty";

export interface CompanionSettings {
  enabled: boolean;
  chattiness: Chattiness;
  characterId: string;
  /**
   * Optional dedicated provider/model for companion banter (e.g. a free-tier
   * Gemini Flash-Lite) so chatter never burns the tutoring provider's budget.
   * When unset, companion calls use the normal candidate chain.
   */
  provider?: ProviderId | null;
  model?: string | null;
}

export const DEFAULT_COMPANION: CompanionSettings = {
  enabled: true,
  chattiness: "normal",
  characterId: "kurisu",
  provider: null,
  model: null,
};

const CHATTINESS: Chattiness[] = ["quiet", "normal", "chatty"];

export function isChattiness(v: unknown): v is Chattiness {
  return typeof v === "string" && (CHATTINESS as string[]).includes(v);
}

function isProviderId(v: unknown): v is ProviderId {
  return typeof v === "string" && (ALL_PROVIDER_IDS as string[]).includes(v);
}

export function normalizeCompanion(
  raw?: Partial<CompanionSettings>,
): CompanionSettings {
  const r = raw ?? {};
  return {
    enabled: r.enabled ?? DEFAULT_COMPANION.enabled,
    chattiness: isChattiness(r.chattiness) ? r.chattiness : DEFAULT_COMPANION.chattiness,
    characterId:
      (typeof r.characterId === "string" && r.characterId.trim()) ||
      DEFAULT_COMPANION.characterId,
    provider: isProviderId(r.provider) ? r.provider : null,
    model: (typeof r.model === "string" && r.model.trim()) || null,
  };
}

export async function getCompanionSettings(): Promise<CompanionSettings> {
  const s = await getSettings();
  return normalizeCompanion(s.companion);
}
