import { probeChain } from "@/lib/ai/router";
import { labelFor } from "@/lib/ai/presets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Reports whether *any* provider in the fallback chain is reachable, plus which
// one would serve. Powers the top-of-app banner.
export async function GET() {
  const probe = await probeChain();
  return Response.json({
    ok: probe.ok,
    // The AppImage runtime sets APPIMAGE in the Electron main process; the
    // spawned server inherits it. AppImage builds can't reach the natively
    // installed Claude Code, so the banner explains why Claude is down.
    isAppImage: Boolean(process.env.APPIMAGE),
    activeProvider: probe.activeProvider,
    activeProviderLabel: labelFor(probe.activeProvider),
    servedBy: probe.servedBy,
    servedByLabel: probe.servedBy ? labelFor(probe.servedBy) : undefined,
  });
}
