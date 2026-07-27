// The character roster: what packs exist (both roots), where installed ones
// live on disk (shown in Settings for manual drops), and deletion of installed
// packs. Deleting the active character resets the selection to the default.

import { promises as fs } from "fs";
import path from "path";
import { NextRequest } from "next/server";
import {
  CharacterPackSchema,
  installedPacksDir,
  listCharacterPacks,
  sanitizePackId,
} from "@/lib/companion/pack";
import { getCompanionSettings, DEFAULT_COMPANION } from "@/lib/companion/config";
import { updateSettings } from "@/lib/ai/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [characters, companion] = await Promise.all([
    listCharacterPacks(),
    getCompanionSettings(),
  ]);
  return Response.json({
    characters,
    dir: installedPacksDir(),
    activeId: companion.characterId,
  });
}

type PostBody =
  | { action: "delete"; id: string }
  // validate: schema-check a draft pack (the wizard's JSON tab).
  // create/update: write character.json into the installed root. "create"
  // refuses to clobber an existing *installed* pack; writing over a bundled id
  // is allowed on purpose — that's the "customize the built-in character" fork
  // (installed shadows bundled).
  | { action: "validate" | "create" | "update"; pack: unknown };

function packError(message: string) {
  return Response.json({ error: "invalid_pack", message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  if (body.action === "validate" || body.action === "create" || body.action === "update") {
    const parsed = CharacterPackSchema.safeParse(body.pack);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return packError(`${first.path.join(".") || "(root)"} — ${first.message}`);
    }
    if (body.action === "validate") return Response.json({ ok: true, id: parsed.data.id });

    const pack = parsed.data;
    const dir = path.join(installedPacksDir(), pack.id);
    const exists = await fs
      .access(path.join(dir, "character.json"))
      .then(() => true)
      .catch(() => false);
    if (body.action === "create" && exists) {
      return packError(
        `An installed character with id "${pack.id}" already exists — edit it instead, or change the name.`,
      );
    }
    if (body.action === "update" && !exists) {
      // Updating a bundled character forks it into the installed root (shadow).
      // Updating a nonexistent id is a create; both just write the file.
    }
    try {
      await fs.mkdir(path.join(dir, "sprites"), { recursive: true });
      await fs.mkdir(path.join(dir, pack.voice.dir), { recursive: true });
      await fs.writeFile(
        path.join(dir, "character.json"),
        JSON.stringify(pack, null, 2),
        "utf8",
      );
    } catch (err) {
      return Response.json(
        { error: "write_failed", message: err instanceof Error ? err.message : String(err) },
        { status: 500 },
      );
    }
    return Response.json({
      ok: true,
      installed: { id: pack.id, name: pack.name },
      characters: await listCharacterPacks(),
    });
  }

  if (body.action !== "delete") {
    return Response.json({ error: "bad_action" }, { status: 400 });
  }

  const id = sanitizePackId(String(body.id ?? ""));
  if (!id || id !== String(body.id)) {
    return Response.json({ error: "bad_id" }, { status: 400 });
  }

  // Only installed packs are deletable — bundled ones ship with the app.
  const root = installedPacksDir();
  const target = path.resolve(root, id);
  if (!target.startsWith(root + path.sep)) {
    return Response.json({ error: "bad_id" }, { status: 400 });
  }
  try {
    await fs.rm(target, { recursive: true, force: true });
  } catch {
    return Response.json({ error: "delete_failed" }, { status: 500 });
  }

  // If they deleted the active character, fall back to the default (or, when
  // the same id still exists as a bundled pack, the selection keeps working
  // and needs no reset).
  const companion = await getCompanionSettings();
  const remaining = await listCharacterPacks();
  let activeId = companion.characterId;
  if (activeId === id && !remaining.some((c) => c.id === id)) {
    activeId = DEFAULT_COMPANION.characterId;
    await updateSettings((s) => {
      (s.companion ??= {}).characterId = activeId;
    });
  }

  return Response.json({ ok: true, characters: remaining, activeId });
}
