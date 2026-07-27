// Serves files from INSTALLED character packs (dataDir()/characters), which
// Next can't serve statically. Bundled packs never hit this route — their
// assets are static files under public/. Strictly sandboxed: pack-id checked,
// resolved path must stay inside the installed root, extensions allowlisted.

import { promises as fs } from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { installedPacksDir, sanitizePackId } from "@/lib/companion/pack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".json": "application/json",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  if (!segments || segments.length < 2) {
    return new Response("not found", { status: 404 });
  }

  const [rawId, ...rest] = segments;
  const id = sanitizePackId(rawId);
  if (!id || id !== rawId) return new Response("not found", { status: 404 });

  const type = CONTENT_TYPES[path.extname(rest[rest.length - 1]).toLowerCase()];
  if (!type) return new Response("not found", { status: 404 });

  const root = path.join(installedPacksDir(), id);
  const resolved = path.resolve(root, ...rest);
  if (!resolved.startsWith(root + path.sep)) {
    return new Response("not found", { status: 404 });
  }

  try {
    const data = await fs.readFile(resolved);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": type,
        // Packs are mutable (reinstall replaces files in place).
        "Cache-Control": "no-cache",
      },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
