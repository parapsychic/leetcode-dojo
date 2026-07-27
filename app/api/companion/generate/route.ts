// Character generation for the Add-character wizard. Orchestrates source
// gathering + the characterGen LLM call and returns a DRAFT pack — nothing is
// installed here; the wizard edits the draft and saves it through
// /api/companion/characters {action:"create"}.
//
// Search tiers (user decision): the router already prefers claude for this
// mode (native WebSearch via the Agent SDK); openrouter grounds itself via
// ":online". Only when neither will serve do we fetch wiki source material
// ourselves and inline it into the prompt. Pasted material always wins.

import { NextRequest } from "next/server";
import { runChat } from "@/lib/ai/router";
import { ProviderError } from "@/lib/ai/types";
import type { PromptContext } from "@/lib/claude/prompts";
import { extractJson, GeneratedPackSchema } from "@/lib/claude/schemas";
import { fetchCharacterSource, TOTAL_CAP } from "@/lib/companion/sourceFetch";
import { listCharacterPacks, type CharacterPack } from "@/lib/companion/pack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // web-search turns take a while

interface Body {
  kind: "famous" | "oc";
  characterName?: string;
  sourceTitle?: string;
  notes?: string;
  sourceMaterial?: string; // pasted by the user
  ocDescription?: string;
}

function fail(message: string, status = 400) {
  return Response.json({ error: "generate_failed", message }, { status });
}

function slugId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .replace(/^[^a-z0-9]+/, "");
  return slug || "character";
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return fail("Bad request body.");
  }

  const ctx: PromptContext = {};
  if (body.kind === "famous") {
    if (!body.characterName?.trim() || !body.sourceTitle?.trim()) {
      return fail("Character name and source title are required.");
    }
    ctx.characterName = body.characterName.trim();
    ctx.sourceTitle = body.sourceTitle.trim();
    ctx.notes = body.notes?.trim() || undefined;

    // Assemble source material: paste first (authoritative), then the wiki
    // fetch. Always fetched (not just for search-less providers): it's cached
    // for a day and costs ~a second, and the request may fall through mid-chain
    // to a provider with no search of its own — primaryFor can't know that a
    // configured claude session will fail auth at call time.
    const parts: string[] = [];
    if (body.sourceMaterial?.trim()) {
      parts.push(`[Provided by the user]\n${body.sourceMaterial.trim()}`);
    }
    const fetched = await fetchCharacterSource(ctx.characterName, ctx.sourceTitle);
    if (fetched) parts.push(fetched);
    if (parts.length) ctx.sourceMaterial = parts.join("\n\n").slice(0, TOTAL_CAP);
  } else if (body.kind === "oc") {
    if (!body.ocDescription?.trim()) {
      return fail("A description of your character is required.");
    }
    ctx.ocDescription = body.ocDescription.trim();
    ctx.characterName = body.characterName?.trim() || undefined;
  } else {
    return fail("Unknown kind.");
  }

  // Small fallback models occasionally truncate or drift off the format, so a
  // malformed generation gets ONE automatic retry before surfacing an error
  // (which names the model and says "try again" — genuinely the right advice).
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    let text: string;
    let providerId: string;
    try {
      ({ text, providerId } = await runChat("characterGen", ctx, req.signal));
    } catch (err) {
      if (err instanceof ProviderError && err.kind === "auth") {
        return fail(
          "No AI provider could answer — check your Claude Code session (/login) or add a provider in Settings.",
          401,
        );
      }
      return fail(err instanceof Error ? err.message : String(err), 502);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJson(text) ?? text);
    } catch {
      lastError = `The model (${providerId}) returned malformed JSON — usually a truncated response; try generating again.`;
      continue;
    }
    const generated = GeneratedPackSchema.safeParse(parsed);
    if (!generated.success) {
      const first = generated.error.issues[0];
      lastError = `The model (${providerId}) missed the pack format at ${first.path.join(".") || "(root)"} (${first.message}) — try generating again.`;
      continue;
    }

    // Server-supplied fields: version + a unique-ish slug id (the wizard's
    // editor shows it; create/update handles real collisions).
    const existing = new Set((await listCharacterPacks()).map((c) => c.id));
    let id = slugId(generated.data.name);
    if (existing.has(id)) {
      let n = 2;
      while (existing.has(`${id}${n}`)) n++;
      id = `${id}${n}`;
    }
    const pack: CharacterPack = { version: 1, id, ...generated.data };
    return Response.json({ pack, providerId });
  }
  return fail(lastError, 502);
}
