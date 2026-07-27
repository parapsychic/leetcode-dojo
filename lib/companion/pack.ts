// Character pack loading. A pack is a folder containing character.json,
// sprites/, and voice/, living in one of two roots:
//
//   installed  dataDir()/characters/<id>   (user-added; zip import or manual copy)
//   bundled    public/characters/<id>      (ships with the app)
//
// An installed pack SHADOWS a bundled one with the same id (so users can even
// override the bundled character's art). Bundled assets are served statically
// by Next; installed assets go through GET /api/companion/asset/<id>/<path>.
// The app only ever consumes the manifest this module produces — and all pack
// storage access stays behind this module plus the asset/import routes, so a
// future multi-tenant backend swaps the storage driver here without touching
// the client, the pack format, or the validation. Pack *creation* (hand-made
// today, engine-generated later) is out of scope.

import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";
import { dataDir } from "@/lib/store/paths";

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

export type PackSource = "installed" | "bundled";

export interface SpriteVariants {
  /** URL of the base expression image, or null if the PNG isn't present. */
  base: string | null;
  eyesClosed: string | null;
  mouthOpen: string | null;
}

export interface PackManifest {
  pack: CharacterPack;
  source: PackSource;
  /** Per-expression sprite URLs, probed on disk so the client never 404s. */
  sprites: Record<string, SpriteVariants>;
  /** Small full-body sprite for the minimized dock, when the pack ships one. */
  chibi: string | null;
  /** True when at least the default expression's base sprite exists. */
  hasSprites: boolean;
  /** URL prefix for the pack's voice/ audio cache (phase 2). */
  voiceBase: string;
}

export interface PackSummary {
  id: string;
  name: string;
  source: PackSource;
  /** Best available thumbnail URL (chibi, else neutral base), or null. */
  thumb: string | null;
  /** Set when the folder exists but its character.json is missing/invalid. */
  error?: string;
}

export function installedPacksDir(): string {
  return path.join(dataDir(), "characters");
}

function bundledPacksDir(): string {
  // cwd is the project root in dev and the standalone `app/` dir in the
  // packaged Electron build — both contain `public/`.
  return path.join(process.cwd(), "public", "characters");
}

export function sanitizePackId(id: string): string {
  return id.replace(/[^a-z0-9-_]/gi, "").toLowerCase();
}

/** URL for a file inside a pack, respecting how that root is served. */
function assetUrl(source: PackSource, id: string, relPath: string): string {
  return source === "bundled"
    ? `/characters/${id}/${relPath}`
    : `/api/companion/asset/${id}/${relPath}`;
}

async function probe(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

/** The pack's folder + which root won (installed shadows bundled). */
async function resolvePackRoot(
  id: string,
): Promise<{ root: string; source: PackSource } | null> {
  const installed = path.join(installedPacksDir(), id);
  if (await probe(path.join(installed, "character.json"))) {
    return { root: installed, source: "installed" };
  }
  const bundled = path.join(bundledPacksDir(), id);
  if (await probe(path.join(bundled, "character.json"))) {
    return { root: bundled, source: "bundled" };
  }
  return null;
}

export async function loadCharacterPack(id: string): Promise<PackManifest> {
  const safeId = sanitizePackId(id);
  if (!safeId) throw new Error("bad pack id");
  const resolved = await resolvePackRoot(safeId);
  if (!resolved) throw new Error(`no character pack named "${safeId}"`);
  const { root, source } = resolved;
  const raw = await fs.readFile(path.join(root, "character.json"), "utf8");
  const pack = CharacterPackSchema.parse(JSON.parse(raw));

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
        variants[key] = assetUrl(source, safeId, `sprites/${file}`);
      }
    }
    sprites[expr] = variants;
  }

  const chibi = (await probe(path.join(root, "sprites", "chibi.png")))
    ? assetUrl(source, safeId, "sprites/chibi.png")
    : null;

  return {
    pack,
    source,
    sprites,
    chibi,
    hasSprites: Boolean(sprites[pack.defaultExpression]?.base),
    voiceBase: assetUrl(source, safeId, pack.voice.dir),
  };
}

async function listPackIds(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

/** Every pack in both roots, installed shadowing bundled, invalid ones flagged. */
export async function listCharacterPacks(): Promise<PackSummary[]> {
  const seen = new Map<string, PackSummary>();
  const roots: { dir: string; source: PackSource }[] = [
    { dir: installedPacksDir(), source: "installed" },
    { dir: bundledPacksDir(), source: "bundled" },
  ];
  for (const { dir, source } of roots) {
    for (const rawId of await listPackIds(dir)) {
      const id = sanitizePackId(rawId);
      if (!id || id !== rawId.toLowerCase() || seen.has(id)) continue;
      try {
        const raw = await fs.readFile(path.join(dir, rawId, "character.json"), "utf8");
        const pack = CharacterPackSchema.parse(JSON.parse(raw));
        const chibi = path.join(dir, rawId, "sprites", "chibi.png");
        const neutral = path.join(dir, rawId, "sprites", `${pack.defaultExpression}.png`);
        const thumb = (await probe(chibi))
          ? assetUrl(source, id, "sprites/chibi.png")
          : (await probe(neutral))
            ? assetUrl(source, id, `sprites/${pack.defaultExpression}.png`)
            : null;
        seen.set(id, { id, name: pack.name, source, thumb });
      } catch (err) {
        seen.set(id, {
          id,
          name: rawId,
          source,
          thumb: null,
          error: err instanceof Error ? err.message.slice(0, 200) : String(err),
        });
      }
    }
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}
