import { NextRequest } from "next/server";
import { loadCharacterPack } from "@/lib/companion/pack";
import { getCompanionSettings } from "@/lib/companion/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const companion = await getCompanionSettings();
  const id = req.nextUrl.searchParams.get("id") || companion.characterId;
  try {
    const manifest = await loadCharacterPack(id);
    return Response.json({ manifest, settings: companion });
  } catch (err) {
    return Response.json(
      {
        error: "pack_unavailable",
        message: err instanceof Error ? err.message : String(err),
        settings: companion,
      },
      { status: 404 },
    );
  }
}
