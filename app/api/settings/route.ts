import { NextRequest } from "next/server";
import {
  getSettings,
  updateSettings,
  resolveProvider,
  type StoredProviderOverride,
} from "@/lib/ai/config";
import { probeProvider } from "@/lib/ai/router";
import {
  ALL_PROVIDER_IDS,
  presetFor,
  envKeyFor,
} from "@/lib/ai/presets";
import type { ProviderId } from "@/lib/ai/types";
import {
  isSyncBackendId,
  normalizeSync,
  resolveSync,
  SYNC_ENV,
} from "@/lib/sync/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function isProviderId(v: unknown): v is ProviderId {
  return typeof v === "string" && (ALL_PROVIDER_IDS as string[]).includes(v);
}

// Redacted view for the client: never returns raw API keys, only whether one is
// set (and whether it comes from an env var, which the UI shows as locked).
export async function GET() {
  const settings = await getSettings();
  const providers = ALL_PROVIDER_IDS.map((id) => {
    const r = resolveProvider(id, settings);
    const preset = presetFor(id);
    return {
      id,
      label: r.label,
      isClaude: id === "claude",
      isCustom: id === "custom",
      enabled: r.enabled,
      configured: r.configured,
      hasKey: Boolean(r.apiKey),
      keyFromEnv: r.keyFromEnv,
      envKey: envKeyFor(id),
      baseURL: r.baseURL,
      heavyModel: r.heavyModel,
      lightModel: r.lightModel,
      supportsImages: r.supportsImages,
      signupUrl: preset?.signupUrl,
    };
  });
  // Same redaction rule as API keys: secrets never leave the machine — only
  // hasToken/signedIn booleans (plus whether an env var supplies the value).
  const sync = resolveSync(normalizeSync(settings.sync));
  return Response.json({
    activeProvider: settings.activeProvider,
    fallbackChain: settings.fallbackChain,
    providers,
    sync: {
      enabled: sync.enabled,
      backend: sync.backend,
      autoSync: sync.autoSync,
      configured: sync.configured,
      folder: { path: sync.folder.path, fromEnv: sync.folderFromEnv },
      redis: {
        url: sync.redis.url,
        key: sync.redis.key,
        hasToken: Boolean(sync.redis.token),
        urlFromEnv: sync.redisUrlFromEnv,
        tokenFromEnv: sync.redisTokenFromEnv,
        envUrl: SYNC_ENV.redisUrl,
        envToken: SYNC_ENV.redisToken,
      },
      cloudflare: {
        url: sync.cloudflare.url,
        hasToken: Boolean(sync.cloudflare.token),
        urlFromEnv: sync.cfUrlFromEnv,
        tokenFromEnv: sync.cfTokenFromEnv,
        envUrl: SYNC_ENV.cfUrl,
        envToken: SYNC_ENV.cfToken,
      },
      firebase: {
        signedIn: Boolean(sync.firebase.refreshToken),
        email: sync.firebase.email ?? null,
      },
    },
  });
}

interface SyncSaveBody {
  enabled?: boolean;
  backend?: string | null;
  autoSync?: boolean;
  folder?: { path?: string };
  // Tokens follow the apiKey rule: a string sets ("" clears), undefined leaves untouched.
  redis?: { url?: string; token?: string; key?: string };
  cloudflare?: { url?: string; token?: string };
}

interface SaveBody {
  action: "save";
  activeProvider?: ProviderId;
  fallbackChain?: ProviderId[];
  providers?: Partial<Record<ProviderId, StoredProviderOverride>>;
  sync?: SyncSaveBody;
}

interface TestBody {
  action: "test";
  id: ProviderId;
}

type PostBody = SaveBody | TestBody;

export async function POST(req: NextRequest) {
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  if (body.action === "test") {
    if (!isProviderId(body.id))
      return Response.json({ error: "bad_provider" }, { status: 400 });
    const result = await probeProvider(body.id, req.signal);
    return Response.json(result);
  }

  if (body.action === "save") {
    const updated = await updateSettings((s) => {
      if (isProviderId(body.activeProvider)) s.activeProvider = body.activeProvider;
      if (Array.isArray(body.fallbackChain)) {
        s.fallbackChain = body.fallbackChain.filter(isProviderId);
      }
      if (body.providers) {
        for (const [id, override] of Object.entries(body.providers)) {
          if (!isProviderId(id) || !override) continue;
          const cur = (s.providers[id] ??= {});
          if (override.enabled !== undefined) cur.enabled = override.enabled;
          if (override.baseURL !== undefined) cur.baseURL = override.baseURL;
          if (override.heavyModel !== undefined) cur.heavyModel = override.heavyModel;
          if (override.lightModel !== undefined) cur.lightModel = override.lightModel;
          if (override.supportsImages !== undefined)
            cur.supportsImages = override.supportsImages;
          // apiKey: a string sets it (empty clears); undefined leaves it untouched,
          // so the client can save other fields without echoing the secret back.
          if (typeof override.apiKey === "string") {
            if (override.apiKey.trim() === "") delete cur.apiKey;
            else cur.apiKey = override.apiKey.trim();
          }
        }
      }
      if (body.sync) {
        const inc = body.sync;
        const cur = (s.sync ??= {});
        if (inc.enabled !== undefined) cur.enabled = Boolean(inc.enabled);
        if (inc.autoSync !== undefined) cur.autoSync = Boolean(inc.autoSync);
        if (inc.backend !== undefined) {
          cur.backend = isSyncBackendId(inc.backend) ? inc.backend : null;
        }
        if (inc.folder?.path !== undefined) {
          cur.folder = { path: String(inc.folder.path).trim() };
        }
        if (inc.redis) {
          const redis = (cur.redis ??= { url: "", key: "efdx:progress" });
          if (inc.redis.url !== undefined) redis.url = String(inc.redis.url).trim();
          if (inc.redis.key !== undefined) {
            redis.key = String(inc.redis.key).trim() || "efdx:progress";
          }
          if (typeof inc.redis.token === "string") {
            if (inc.redis.token.trim() === "") delete redis.token;
            else redis.token = inc.redis.token.trim();
          }
        }
        if (inc.cloudflare) {
          const cf = (cur.cloudflare ??= { url: "" });
          if (inc.cloudflare.url !== undefined) cf.url = String(inc.cloudflare.url).trim();
          if (typeof inc.cloudflare.token === "string") {
            if (inc.cloudflare.token.trim() === "") delete cf.token;
            else cf.token = inc.cloudflare.token.trim();
          }
        }
        // firebase credentials are managed by /api/sync (signin/signout), not here.
      }
    });
    return Response.json({ ok: true, activeProvider: updated.activeProvider });
  }

  return Response.json({ error: "bad_action" }, { status: 400 });
}
