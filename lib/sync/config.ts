// Sync settings live inside settings.json (lib/ai/config.ts) under the `sync`
// key — one file, one save path, one redacting API route. This module owns the
// shape, defaults, env-var overrides, and the "is this backend usable" logic.

import path from "path";
import { getSettings } from "@/lib/ai/config";
import type { SyncBackendId } from "./types";
import { FIREBASE_CONFIGURED } from "./firebaseProject";

export interface SyncSettings {
  /** Master switch. */
  enabled: boolean;
  backend: SyncBackendId | null;
  /** Debounced push after mutations + rate-limited pull on app load. */
  autoSync: boolean;
  folder: { path: string };
  redis: { url: string; token?: string; key: string };
  cloudflare: { url: string; token?: string };
  /** refreshToken is the stored secret; the password itself is never persisted. */
  firebase: { email?: string; refreshToken?: string };
}

export const DEFAULT_SYNC: SyncSettings = {
  enabled: false,
  backend: null,
  autoSync: true,
  folder: { path: "" },
  redis: { url: "", key: "efdx:progress" },
  cloudflare: { url: "" },
  firebase: {},
};

const SYNC_BACKEND_IDS: SyncBackendId[] = ["folder", "redis", "cloudflare", "firebase"];

export function isSyncBackendId(v: unknown): v is SyncBackendId {
  return typeof v === "string" && (SYNC_BACKEND_IDS as string[]).includes(v);
}

/** Deep-merge a possibly-partial stored blob over the defaults. */
export function normalizeSync(raw?: Partial<SyncSettings>): SyncSettings {
  const r = raw ?? {};
  return {
    enabled: r.enabled ?? DEFAULT_SYNC.enabled,
    backend: isSyncBackendId(r.backend) ? r.backend : null,
    autoSync: r.autoSync ?? DEFAULT_SYNC.autoSync,
    folder: { path: r.folder?.path ?? "" },
    redis: {
      url: r.redis?.url ?? "",
      token: r.redis?.token,
      key: r.redis?.key?.trim() || DEFAULT_SYNC.redis.key,
    },
    cloudflare: { url: r.cloudflare?.url ?? "", token: r.cloudflare?.token },
    firebase: { email: r.firebase?.email, refreshToken: r.firebase?.refreshToken },
  };
}

export async function getSyncSettings(): Promise<SyncSettings> {
  const s = await getSettings();
  return normalizeSync(s.sync);
}

// Env vars override stored values (mirrors resolveKey for AI providers).
export const SYNC_ENV = {
  folderPath: "EFDX_SYNC_FOLDER",
  redisUrl: "EFDX_SYNC_REDIS_URL",
  redisToken: "EFDX_SYNC_REDIS_TOKEN",
  cfUrl: "EFDX_SYNC_CF_URL",
  cfToken: "EFDX_SYNC_CF_TOKEN",
} as const;

export interface ResolvedSync extends SyncSettings {
  folderFromEnv: boolean;
  redisUrlFromEnv: boolean;
  redisTokenFromEnv: boolean;
  cfUrlFromEnv: boolean;
  cfTokenFromEnv: boolean;
  /** True when the selected backend has everything it needs to be called. */
  configured: boolean;
}

function env(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

export function backendConfigured(s: SyncSettings, id: SyncBackendId): boolean {
  switch (id) {
    case "folder":
      return Boolean(s.folder.path && path.isAbsolute(s.folder.path));
    case "redis":
      return Boolean(s.redis.url.startsWith("https://") && s.redis.token && s.redis.key);
    case "cloudflare":
      return Boolean(s.cloudflare.url.startsWith("https://") && s.cloudflare.token);
    case "firebase":
      return Boolean(FIREBASE_CONFIGURED && s.firebase.refreshToken);
  }
}

export function resolveSync(s: SyncSettings): ResolvedSync {
  const folderPath = env(SYNC_ENV.folderPath);
  const redisUrl = env(SYNC_ENV.redisUrl);
  const redisToken = env(SYNC_ENV.redisToken);
  const cfUrl = env(SYNC_ENV.cfUrl);
  const cfToken = env(SYNC_ENV.cfToken);

  const merged: SyncSettings = {
    ...s,
    folder: { path: folderPath ?? s.folder.path },
    redis: { ...s.redis, url: redisUrl ?? s.redis.url, token: redisToken ?? s.redis.token },
    cloudflare: {
      url: cfUrl ?? s.cloudflare.url,
      token: cfToken ?? s.cloudflare.token,
    },
  };

  return {
    ...merged,
    folderFromEnv: Boolean(folderPath),
    redisUrlFromEnv: Boolean(redisUrl),
    redisTokenFromEnv: Boolean(redisToken),
    cfUrlFromEnv: Boolean(cfUrl),
    cfTokenFromEnv: Boolean(cfToken),
    configured: merged.backend != null && backendConfigured(merged, merged.backend),
  };
}

export async function getResolvedSync(): Promise<ResolvedSync> {
  return resolveSync(await getSyncSettings());
}
