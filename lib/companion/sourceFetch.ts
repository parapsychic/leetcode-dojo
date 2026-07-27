// Best-effort source material for character generation, used when the serving
// provider has no web search of its own (claude searches natively; openrouter
// uses ":online"). Character lore lives almost entirely on MediaWiki sites, so
// instead of a general search API (which would need a key) this hits the free
// MediaWiki APIs: Wikipedia search + extract, then the franchise's Fandom wiki
// (subdomain guessed from the source title — Fandom slugs are typically the
// title with punctuation stripped). Every failure degrades to "" — generation
// then proceeds on model knowledge and whatever the user pasted.

import { cacheGet, cacheSet } from "@/lib/cache/diskCache";

const CACHE_NS = "wiki";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;
const PER_SOURCE_CAP = 4000;
export const TOTAL_CAP = 8000;

async function getJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "User-Agent": "leetcode-dojo companion (local app)" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** MediaWiki search → best-matching page title, on any MediaWiki host. */
async function searchTitle(apiBase: string, query: string): Promise<string | null> {
  const data = (await getJson(
    `${apiBase}?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=1&format=json&origin=*`,
  )) as { query?: { search?: { title?: string }[] } } | null;
  return data?.query?.search?.[0]?.title ?? null;
}

/** MediaWiki plain-text extract of a page, sliced to the per-source cap. */
async function pageExtract(apiBase: string, title: string): Promise<string> {
  const data = (await getJson(
    `${apiBase}?action=query&prop=extracts&explaintext=1&redirects=1&titles=${encodeURIComponent(title)}&format=json&origin=*`,
  )) as { query?: { pages?: Record<string, { extract?: string }> } } | null;
  const pages = data?.query?.pages;
  if (!pages) return "";
  const first = Object.values(pages)[0];
  return (first?.extract ?? "").slice(0, PER_SOURCE_CAP);
}

/** Candidate fandom.com subdomain slugs for a franchise title. */
function fandomSlugs(sourceTitle: string): string[] {
  const words = sourceTitle.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().split(/\s+/);
  const joined = words.join("");
  const hyphen = words.join("-");
  return [...new Set([joined, hyphen])].filter(Boolean);
}

/**
 * Fetch character source text: Wikipedia + the franchise's Fandom wiki.
 * Cached for a day; returns "" when nothing could be fetched.
 */
export async function fetchCharacterSource(
  characterName: string,
  sourceTitle: string,
): Promise<string> {
  const cacheKey = JSON.stringify({ characterName, sourceTitle });
  const hit = await cacheGet<string>(CACHE_NS, cacheKey);
  if (hit && hit.ageMs < CACHE_TTL_MS) return hit.value;

  const parts: string[] = [];

  // 1. Wikipedia — reliable host, may only have franchise-level coverage.
  const wpApi = "https://en.wikipedia.org/w/api.php";
  const wpTitle = await searchTitle(wpApi, `${characterName} ${sourceTitle}`);
  if (wpTitle) {
    const text = await pageExtract(wpApi, wpTitle);
    if (text) parts.push(`[Wikipedia: ${wpTitle}]\n${text}`);
  }

  // 2. Fandom — the deep character pages. Try guessed subdomains until one
  //    responds to a search for the character.
  for (const slug of fandomSlugs(sourceTitle)) {
    const fdApi = `https://${slug}.fandom.com/api.php`;
    const fdTitle = await searchTitle(fdApi, characterName);
    if (!fdTitle) continue;
    const text = await pageExtract(fdApi, fdTitle);
    if (text) {
      parts.push(`[${slug}.fandom.com: ${fdTitle}]\n${text}`);
      break;
    }
  }

  const result = parts.join("\n\n").slice(0, TOTAL_CAP);
  await cacheSet(CACHE_NS, cacheKey, result).catch(() => {});
  return result;
}
