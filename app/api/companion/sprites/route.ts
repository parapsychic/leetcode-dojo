// Uploads sprite PNGs into an INSTALLED pack's sprites/ folder — so packs
// created by the wizard (which start sprite-less) can get art without
// re-zipping, and existing art can be replaced. Filenames are the pack
// convention (<expression>.png, <expression>_eyes-closed.png,
// <expression>_mouth-open.png, chibi.png) and are strictly sanitized.

import { promises as fs } from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { installedPacksDir, sanitizePackId } from "@/lib/companion/pack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const NAME_RE = /^[a-z0-9][a-z0-9-_]*\.png$/;

function fail(message: string, status = 400) {
  return Response.json({ error: "sprite_upload_failed", message }, { status });
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("Expected a multipart form.");
  }

  const rawId = String(form.get("id") ?? "");
  const id = sanitizePackId(rawId);
  if (!id || id !== rawId) return fail("Bad pack id.");

  const packDir = path.join(installedPacksDir(), id);
  const isInstalled = await fs
    .access(path.join(packDir, "character.json"))
    .then(() => true)
    .catch(() => false);
  if (!isInstalled) {
    return fail(
      "Sprites can only be uploaded to installed packs. (For a bundled character, customize it first — that forks it into your installed characters.)",
    );
  }

  const files = form.getAll("sprites").filter((f): f is File => f instanceof File);
  if (files.length === 0) return fail("No sprite files in the upload.");

  const wrote: string[] = [];
  for (const file of files) {
    const name = file.name.toLowerCase();
    if (!NAME_RE.test(name)) {
      return fail(
        `"${file.name}" — sprite files must be PNGs named like neutral.png, smug_eyes-closed.png, or chibi.png.`,
      );
    }
    if (file.size > MAX_FILE_BYTES) {
      return fail(`"${file.name}" is too large (max ${MAX_FILE_BYTES / 1024 / 1024}MB).`);
    }
    const target = path.resolve(packDir, "sprites", name);
    if (!target.startsWith(path.join(packDir, "sprites") + path.sep)) {
      return fail(`"${file.name}" — refusing unsafe filename.`);
    }
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, Buffer.from(await file.arrayBuffer()));
    wrote.push(name);
  }

  return Response.json({ ok: true, wrote });
}
