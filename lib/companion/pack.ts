// Character pack loading. A pack is a folder under public/characters/<id>/
// containing character.json, sprites/, and voice/. The app only ever consumes
// the manifest this module produces — pack *creation* (hand-assembled today,
// engine-generated later) is out of scope, which is what keeps the companion
// feature decoupled from any future rigging/voice tooling.

import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";

const CannedLineSchema = z.object({
  expression: z.string(),
  text: z.string().min(1),
});

export const CharacterPackSchema = z.object({
  version: z.literal(1),
  id: z.string().regex(/^[a-z0-9][a-z0-9-_]*$/),
  name: z.string().min(1),
  persona: z.string().min(1),
  speechStyle: z.string().min(1),
  defaultExpression: z.string(),
  expressions: z.array(z.string()).min(1),
  eventLines: z.record(z.string(), z.array(CannedLineSchema)),
  voice: z
    .object({
      enabled: z.boolean(),
      dir: z.string().default("voice"),
      format: z.string().default("wav"),
    })
    .default({ enabled: false, dir: "voice", format: "wav" }),
});

export type CharacterPack = z.infer<typeof CharacterPackSchema>;
export type CannedLine = z.infer<typeof CannedLineSchema>;

export interface SpriteVariants {
  /** URL of the base expression image, or null if the PNG isn't present. */
  base: string | null;
  eyesClosed: string | null;
  mouthOpen: string | null;
}

export interface PackManifest {
  pack: CharacterPack;
  /** Per-expression sprite URLs, probed on disk so the client never 404s. */
  sprites: Record<string, SpriteVariants>;
  /** True when at least the default expression's base sprite exists. */
  hasSprites: boolean;
  /** URL prefix for the pack's voice/ audio cache (phase 2). */
  voiceBase: string;
}

function packRoot(id: string): string {
  // cwd is the project root in dev and the standalone `app/` dir in the
  // packaged Electron build — both contain `public/`.
  return path.join(process.cwd(), "public", "characters", id);
}

async function probe(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

export async function loadCharacterPack(id: string): Promise<PackManifest> {
  const safeId = id.replace(/[^a-z0-9-_]/gi, "");
  if (!safeId) throw new Error("bad pack id");
  const root = packRoot(safeId);
  const raw = await fs.readFile(path.join(root, "character.json"), "utf8");
  const pack = CharacterPackSchema.parse(JSON.parse(raw));

  const urlBase = `/characters/${safeId}`;
  const sprites: Record<string, SpriteVariants> = {};
  for (const expr of pack.expressions) {
    const variants: SpriteVariants = { base: null, eyesClosed: null, mouthOpen: null };
    const entries: [keyof SpriteVariants, string][] = [
      ["base", `${expr}.png`],
      ["eyesClosed", `${expr}_eyes-closed.png`],
      ["mouthOpen", `${expr}_mouth-open.png`],
    ];
    for (const [key, file] of entries) {
      if (await probe(path.join(root, "sprites", file))) {
        variants[key] = `${urlBase}/sprites/${file}`;
      }
    }
    sprites[expr] = variants;
  }

  return {
    pack,
    sprites,
    hasSprites: Boolean(sprites[pack.defaultExpression]?.base),
    voiceBase: `${urlBase}/${pack.voice.dir}`,
  };
}
