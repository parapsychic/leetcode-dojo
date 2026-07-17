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
    activeProvider: probe.activeProvider,
    activeProviderLabel: labelFor(probe.activeProvider),
    servedBy: probe.servedBy,
    servedByLabel: probe.servedBy ? labelFor(probe.servedBy) : undefined,
  });
}
