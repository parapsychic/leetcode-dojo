// Installs a character pack from an uploaded zip into dataDir()/characters.
// This is the schema-enforcement point for packs from anywhere — hand-built,
// shared by other users, or emitted by the future character engine (whose
// output contract is exactly CharacterPackSchema; see docs/handoff-engine.md).
// Validation is deliberately loud: a malformed pack fails here with a message,
// not silently at render time.

import { promises as fs } from "fs";
import path from "path";
import { NextRequest } from "next/server";
import AdmZip from "adm-zip";
import {
  CharacterPackSchema,
  installedPacksDir,
  listCharacterPacks,
} from "@/lib/companion/pack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_ZIP_BYTES = 50 * 1024 * 1024;
// What a pack may contain. Anything else in the zip is skipped, not an error —
// engine output may carry logs/thumbnails we don't care about.
const ALLOWED_EXTENSIONS = new Set([
  ".json", ".png", ".webp", ".jpg", ".jpeg", ".wav", ".mp3", ".ogg",
]);

function fail(message: string, status = 400) {
  return Response.json({ error: "import_failed", message }, { status });
}

/** Thrown for user-fixable pack problems found mid-extraction (→ 400, staging cleaned). */
class BadPackError extends Error {}

export async function POST(req: NextRequest) {
  let file: File | null = null;
  try {
    const form = await req.formData();
    const entry = form.get("pack");
    if (entry instanceof File) file = entry;
  } catch {
    return fail("Expected a multipart form with a 'pack' zip file.");
  }
  if (!file) return fail("Expected a multipart form with a 'pack' zip file.");
  if (file.size > MAX_ZIP_BYTES) {
    return fail(`Zip is too large (max ${MAX_ZIP_BYTES / 1024 / 1024}MB).`);
  }

  let zip: AdmZip;
  try {
    zip = new AdmZip(Buffer.from(await file.arrayBuffer()));
  } catch {
    return fail("That file isn't a readable zip archive.");
  }

  // The pack may sit at the zip root or inside a single top-level folder
  // (what you get from zipping the folder itself). Find character.json.
  const entries = zip.getEntries().filter((e) => !e.isDirectory);
  const manifestEntry = entries.find(
    (e) => e.entryName === "character.json" || /^[^/]+\/character\.json$/.test(e.entryName),
  );
  if (!manifestEntry) {
    return fail("No character.json found at the zip root (or in a single top-level folder).");
  }
  const prefix = manifestEntry.entryName.slice(0, -"character.json".length);

  let packJson: unknown;
  try {
    packJson = JSON.parse(manifestEntry.getData().toString("utf8"));
  } catch {
    return fail("character.json isn't valid JSON.");
  }
  const parsed = CharacterPackSchema.safeParse(packJson);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail(
      `character.json doesn't match the pack format: ${first.path.join(".") || "(root)"} — ${first.message}`,
    );
  }
  const pack = parsed.data;

  // Extract to a staging dir first, then swap into place (reinstall = replace).
  // Staged INSIDE the characters root so the final rename never crosses
  // filesystems (os.tmpdir can be a different volume → EXDEV). Dot-prefixed,
  // so the roster scan's id sanitizer already skips it.
  await fs.mkdir(installedPacksDir(), { recursive: true });
  const staging = await fs.mkdtemp(path.join(installedPacksDir(), ".staging-"));
  try {
    for (const entry of entries) {
      if (!entry.entryName.startsWith(prefix)) continue;
      const rel = entry.entryName.slice(prefix.length);
      if (!rel) continue;
      if (!ALLOWED_EXTENSIONS.has(path.extname(rel).toLowerCase())) continue;
      // Zip-slip guard: the resolved target must stay inside the staging dir.
      // Thrown (not returned) so the catch below always cleans up staging.
      const target = path.resolve(staging, rel);
      if (target !== staging && !target.startsWith(staging + path.sep)) {
        throw new BadPackError(`Refusing unsafe path in zip: ${entry.entryName}`);
      }
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, entry.getData());
    }
    // The voice cache dir is part of the format even when empty.
    await fs.mkdir(path.join(staging, pack.voice.dir), { recursive: true });

    const dest = path.join(installedPacksDir(), pack.id);
    await fs.rm(dest, { recursive: true, force: true });
    await fs.rename(staging, dest);
  } catch (err) {
    await fs.rm(staging, { recursive: true, force: true }).catch(() => {});
    if (err instanceof BadPackError) return fail(err.message);
    return fail(
      `Couldn't install the pack: ${err instanceof Error ? err.message : String(err)}`,
      500,
    );
  }

  const characters = await listCharacterPacks();
  return Response.json({
    ok: true,
    installed: { id: pack.id, name: pack.name },
    characters,
  });
}
