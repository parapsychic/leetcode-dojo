// Cloudflare Workers KV backend. Talks to the tiny worker the user deploys
// from the in-app guide (see CLOUDFLARE_WORKER_JS in ../presets.ts):
// GET → the stored JSON doc (404 when empty), PUT → overwrite, Bearer token.

import type { ProgressData } from "@/lib/store/progress";
import { parseProgressDoc } from "../schema";
import { syncFetch } from "../http";
import { SyncError, type SyncBackend } from "../types";

interface CloudflareConfig {
  url: string;
  token: string;
}

export function cloudflareBackend(cfg: CloudflareConfig): SyncBackend {
  const headers = { Authorization: `Bearer ${cfg.token}` };
  return {
    id: "cloudflare",
    label: "Cloudflare Workers KV",

    async pull(signal): Promise<ProgressData | null> {
      const res = await syncFetch("cloudflare", cfg.url, { headers }, signal);
      if (res.status === 404) return null;
      if (res.status === 401 || res.status === 403) {
        throw new SyncError("Unauthorized — check your sync token.", "auth", "cloudflare");
      }
      if (!res.ok) {
        throw new SyncError(`Worker returned HTTP ${res.status}`, "other", "cloudflare");
      }
      return parseProgressDoc(await res.text());
    },

    async push(data, signal): Promise<void> {
      const res = await syncFetch(
        "cloudflare",
        cfg.url,
        {
          method: "PUT",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
        signal,
      );
      if (res.status === 401 || res.status === 403) {
        throw new SyncError("Unauthorized — check your sync token.", "auth", "cloudflare");
      }
      if (!res.ok) {
        throw new SyncError(`Worker returned HTTP ${res.status}`, "other", "cloudflare");
      }
    },

    async healthCheck(signal) {
      try {
        const res = await syncFetch("cloudflare", cfg.url, { headers }, signal);
        // 404 = reachable + authorized, just nothing stored yet.
        if (res.ok || res.status === 404) return { ok: true };
        if (res.status === 401 || res.status === 403) {
          return { ok: false, error: "Unauthorized — check your sync token." };
        }
        return { ok: false, error: `Worker returned HTTP ${res.status}` };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
