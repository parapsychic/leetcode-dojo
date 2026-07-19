// Upstash Redis backend (REST). The whole doc is one string value under a
// single key. Commands go as a JSON array in the POST body — never in the URL
// path, where a multi-KB blob would have to be URL-encoded.
//
// Plain redis:// (TCP) is intentionally not supported yet; the config layer
// rejects non-https URLs before we get here.

import type { ProgressData } from "@/lib/store/progress";
import { parseProgressDoc } from "../schema";
import { syncFetch } from "../http";
import { SyncError, type SyncBackend } from "../types";

interface RedisConfig {
  url: string;
  token: string;
  key: string;
}

async function command(cfg: RedisConfig, cmd: unknown[], signal?: AbortSignal): Promise<unknown> {
  if (!cfg.url.startsWith("https://")) {
    throw new SyncError(
      "TCP redis:// isn't supported yet — use your database's Upstash REST URL (https://…).",
      "config",
      "redis",
    );
  }
  const res = await syncFetch(
    "redis",
    cfg.url,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cmd),
    },
    signal,
  );
  if (res.status === 401 || res.status === 403) {
    throw new SyncError("Unauthorized — check your Upstash REST token.", "auth", "redis");
  }
  const data = (await res.json().catch(() => null)) as
    | { result?: unknown; error?: string }
    | null;
  if (!res.ok || !data || typeof data.error === "string") {
    throw new SyncError(
      data?.error || `Upstash request failed (HTTP ${res.status})`,
      "other",
      "redis",
    );
  }
  return data.result;
}

export function redisBackend(cfg: RedisConfig): SyncBackend {
  return {
    id: "redis",
    label: "Upstash Redis",

    async pull(signal): Promise<ProgressData | null> {
      const result = await command(cfg, ["GET", cfg.key], signal);
      if (result == null) return null;
      if (typeof result !== "string") {
        throw new SyncError("Unexpected value type stored at the sync key.", "other", "redis");
      }
      return parseProgressDoc(result);
    },

    async push(data, signal): Promise<void> {
      await command(cfg, ["SET", cfg.key, JSON.stringify(data)], signal);
    },

    async healthCheck(signal) {
      try {
        await command(cfg, ["PING"], signal);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
