// Backend factory: resolved sync settings → a concrete SyncBackend instance.

import { backendConfigured, getResolvedSync, type ResolvedSync } from "../config";
import type { SyncBackend, SyncBackendId } from "../types";
import { cloudflareBackend } from "./cloudflare";
import { firebaseBackend } from "./firebase";
import { folderBackend } from "./folder";
import { redisBackend } from "./redis";

/** Build a specific backend when it's configured, else null. */
export function backendFor(resolved: ResolvedSync, id: SyncBackendId): SyncBackend | null {
  if (!backendConfigured(resolved, id)) return null;
  switch (id) {
    case "folder":
      return folderBackend(resolved.folder.path);
    case "redis":
      return redisBackend({
        url: resolved.redis.url,
        token: resolved.redis.token!,
        key: resolved.redis.key,
      });
    case "cloudflare":
      return cloudflareBackend({
        url: resolved.cloudflare.url,
        token: resolved.cloudflare.token!,
      });
    case "firebase":
      return firebaseBackend(resolved.firebase.refreshToken!);
  }
}

/** The currently selected backend when sync is enabled and configured. */
export async function activeBackend(): Promise<SyncBackend | null> {
  const resolved = await getResolvedSync();
  if (!resolved.enabled || !resolved.backend) return null;
  return backendFor(resolved, resolved.backend);
}
