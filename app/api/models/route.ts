import { NextRequest } from "next/server";
import { getSettings, resolveProvider } from "@/lib/ai/config";
import { listModels } from "@/lib/ai/models";
import { ALL_PROVIDER_IDS } from "@/lib/ai/presets";
import type { ProviderId } from "@/lib/ai/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isProviderId(v: unknown): v is ProviderId {
  return typeof v === "string" && (ALL_PROVIDER_IDS as string[]).includes(v);
}

// GET /api/models?provider=<id> — lists the models the provider exposes, tagged
// with free/vision/recommended for the Settings picker. Never returns keys.
export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get("provider");
  if (!isProviderId(provider)) {
    return Response.json({ error: "bad_provider", models: [] }, { status: 400 });
  }
  if (provider === "claude") {
    // Claude's model is fixed (Claude Code supplies it) — nothing to pick.
    return Response.json({ models: [] });
  }
  const fresh = req.nextUrl.searchParams.get("fresh") === "1";
  const settings = await getSettings();
  const cfg = resolveProvider(provider, settings);
  const result = await listModels(cfg, req.signal, { fresh });
  return Response.json(result);
}
