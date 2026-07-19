// Metadata + in-app setup guides for each sync backend, mirroring how
// lib/ai/presets.ts describes AI providers. Client-safe: constants only.

import type { SyncBackendId } from "./types";
import { FIREBASE_CONFIGURED } from "./firebaseProject";

export interface GuideStep {
  title: string;
  body?: string;
  /** Rendered as a copyable code block. */
  code?: { language: string; content: string; filename?: string };
  link?: { label: string; url: string };
}

export type SyncFieldKey =
  | "folderPath"
  | "redisUrl"
  | "redisToken"
  | "redisKey"
  | "cfUrl"
  | "cfToken";

export interface SyncFieldSpec {
  key: SyncFieldKey;
  label: string;
  placeholder: string;
  /** Password input in the UI; server redacts to a hasToken boolean. */
  secret?: boolean;
  envVar?: string;
}

export interface SyncBackendPreset {
  id: SyncBackendId;
  label: string;
  /** One-liner on the chooser card. */
  tagline: string;
  /** What the user needs before starting. */
  requires: string;
  docsUrl?: string;
  /** Empty for firebase — it renders a sign-in widget instead. */
  fields: SyncFieldSpec[];
  guide: GuideStep[];
}

export const CLOUDFLARE_WORKER_JS = `// worker.js — LeetCode Dojo sync (single JSON blob in Workers KV)
export default {
  async fetch(request, env) {
    const auth = request.headers.get("Authorization") || "";
    if (auth !== \`Bearer \${env.SYNC_TOKEN}\`) {
      return new Response("unauthorized", { status: 401 });
    }
    if (request.method === "GET") {
      const doc = await env.PROGRESS.get("progress");
      if (doc === null) return new Response("not found", { status: 404 });
      return new Response(doc, { headers: { "Content-Type": "application/json" } });
    }
    if (request.method === "PUT") {
      const body = await request.text();
      if (body.length > 1_000_000) return new Response("too large", { status: 413 });
      try { JSON.parse(body); } catch { return new Response("bad json", { status: 400 }); }
      await env.PROGRESS.put("progress", body);
      return new Response(null, { status: 204 });
    }
    return new Response("method not allowed", { status: 405 });
  },
};
`;

export const CLOUDFLARE_WRANGLER_TOML = `name = "leetcode-dojo-sync"
main = "worker.js"
compatibility_date = "2026-01-01"

[[kv_namespaces]]
binding = "PROGRESS"
id = "<paste the id printed by: wrangler kv namespace create PROGRESS>"
`;

export const SYNC_PRESETS: Record<SyncBackendId, SyncBackendPreset> = {
  folder: {
    id: "folder",
    label: "Syncthing folder",
    tagline: "Peer-to-peer, no accounts. The app mirrors progress into a folder you sync.",
    requires: "Syncthing (or any folder-sync tool) on each device",
    docsUrl: "https://syncthing.net/",
    fields: [
      {
        key: "folderPath",
        label: "Synced folder (absolute path)",
        placeholder: "C:\\Users\\you\\Sync\\leetcode-dojo",
        envVar: "EFDX_SYNC_FOLDER",
      },
    ],
    guide: [
      {
        title: "Install Syncthing on each device",
        body: "Syncthing is a free, open-source peer-to-peer folder syncer — your data moves directly between your devices, no cloud account involved.",
        link: { label: "Get Syncthing", url: "https://syncthing.net/downloads/" },
      },
      {
        title: "Create a folder to sync",
        body: "Pick or create a folder, e.g. Sync/leetcode-dojo, and add it in the Syncthing UI.",
      },
      {
        title: "Share it between your devices",
        body: "In Syncthing: Add Remote Device on both machines, then share the folder with the other device (Folder → Edit → Sharing).",
      },
      {
        title: "Point the app at the folder",
        body: "Paste the folder's absolute path above — do this on each device (the path can differ per device). The app keeps a progress.sync.json file inside it and merges changes both ways.",
      },
      {
        title: "Enable sync",
        body: "Turn on “Enable sync”, then Save & test. Solve something and watch progress.sync.json update.",
      },
    ],
  },
  redis: {
    id: "redis",
    label: "Upstash Redis",
    tagline: "A free serverless Redis database you own. The app stores one small key over HTTPS.",
    requires: "Free Upstash account",
    docsUrl: "https://upstash.com/docs/redis",
    fields: [
      {
        key: "redisUrl",
        label: "REST URL",
        placeholder: "https://your-db.upstash.io",
        envVar: "EFDX_SYNC_REDIS_URL",
      },
      {
        key: "redisToken",
        label: "REST token",
        placeholder: "Paste your Upstash REST token",
        secret: true,
        envVar: "EFDX_SYNC_REDIS_TOKEN",
      },
      {
        key: "redisKey",
        label: "Key name",
        placeholder: "efdx:progress",
      },
    ],
    guide: [
      {
        title: "Create a free Upstash account",
        link: { label: "Open the Upstash console", url: "https://console.upstash.com/" },
      },
      {
        title: "Create a Redis database",
        body: "Click “Create Database”, pick any name and region, and choose the free plan. Your progress is a few KB — the free tier is far more than enough.",
      },
      {
        title: "Copy the REST credentials",
        body: "On the database page, find the “REST API” section and copy UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
      },
      {
        title: "Paste them here on each device",
        body: "Use the same URL, token, and key name on every device you want in sync. Note: this is the REST URL (https://…), not a redis:// connection string.",
      },
      {
        title: "Save & test, then enable sync",
      },
    ],
  },
  cloudflare: {
    id: "cloudflare",
    label: "Cloudflare Workers KV",
    tagline: "Deploy a tiny worker with wrangler; your progress lives in your own Cloudflare KV.",
    requires: "Free Cloudflare account + Node (for wrangler)",
    docsUrl: "https://developers.cloudflare.com/kv/",
    fields: [
      {
        key: "cfUrl",
        label: "Worker URL",
        placeholder: "https://leetcode-dojo-sync.you.workers.dev",
        envVar: "EFDX_SYNC_CF_URL",
      },
      {
        key: "cfToken",
        label: "Sync token",
        placeholder: "The token you set with: wrangler secret put SYNC_TOKEN",
        secret: true,
        envVar: "EFDX_SYNC_CF_TOKEN",
      },
    ],
    guide: [
      {
        title: "Install wrangler and log in",
        code: { language: "bash", content: "npm install -g wrangler\nwrangler login" },
        link: { label: "Create a free Cloudflare account", url: "https://dash.cloudflare.com/sign-up" },
      },
      {
        title: "Create a folder with these two files",
        code: { language: "javascript", filename: "worker.js", content: CLOUDFLARE_WORKER_JS },
      },
      {
        title: "…and the wrangler config",
        code: { language: "toml", filename: "wrangler.toml", content: CLOUDFLARE_WRANGLER_TOML },
      },
      {
        title: "Create the KV namespace",
        body: "Run this in that folder, then paste the printed id into wrangler.toml.",
        code: { language: "bash", content: "wrangler kv namespace create PROGRESS" },
      },
      {
        title: "Set your secret token",
        body: "Invent a long random string — this is the password that protects your data.",
        code: { language: "bash", content: "wrangler secret put SYNC_TOKEN" },
      },
      {
        title: "Deploy",
        body: "Copy the printed https://….workers.dev URL, then paste the URL and your token above on each device.",
        code: { language: "bash", content: "wrangler deploy" },
      },
    ],
  },
  firebase: {
    id: "firebase",
    label: "LeetCode Dojo cloud",
    tagline: "Zero setup — create an account and you're synced. Intermittent downtime.",
    requires: "Just an email + password",
    fields: [],
    guide: [
      {
        title: "Create an account (or sign in)",
        body: "Right here in the form above — that's the whole setup. Your progress syncs to a private per-account slot.",
      },
      {
        title: "Sign in on your other devices",
        body: "Use the same email + password on each device and enable sync.",
      },
      {
        title: "What this can and can't see",
        body: "Security rules ensure each account can only read and write its own data. Subject to rate-limits, quota-limits and frequent downtime. Prefer full control? Use one of the self-hosted options above.",
      },
    ],
  },
};

export const ALL_SYNC_BACKEND_IDS: SyncBackendId[] = (
  ["folder", "redis", "cloudflare", "firebase"] as SyncBackendId[]
).filter((id) => id !== "firebase" || FIREBASE_CONFIGURED);

export function syncPresetFor(id: SyncBackendId): SyncBackendPreset {
  return SYNC_PRESETS[id];
}
