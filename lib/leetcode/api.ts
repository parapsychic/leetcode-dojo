// Server-side fetcher for the alfa-leetcode-api, with two-tier caching (in-memory
// + persistent disk) and a graceful fallback so the app stays usable if the API
// is rate-limited/down. The disk cache survives restarts and, on a fetch failure,
// is served STALE rather than re-hitting the upstream — which is what keeps us
// from tripping the API's rate limit on every page load.

import { cacheGet, cacheSet } from "@/lib/cache/diskCache";

const API_BASE =
  process.env.LEETCODE_API_BASE || "https://alfa-leetcode-api.onrender.com";

const CACHE_NS = "leetcode";

export interface LeetCodeProblem {
  slug: string;
  questionId?: string;
  title: string;
  difficulty?: string;
  /** HTML problem statement. */
  content: string | null;
  topicTags?: { name: string; slug: string }[];
  hints?: string[];
  /** True when served from the network; false when this is a fallback stub. */
  live: boolean;
}

interface CacheEntry {
  value: LeetCodeProblem;
  at: number;
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 1000 * 60 * 60 * 6; // 6h

async function fetchWithTimeout(url: string, ms = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function getProblem(slug: string): Promise<LeetCodeProblem> {
  // 1) Fresh in-memory hit.
  const mem = cache.get(slug);
  if (mem && Date.now() - mem.at < TTL_MS) return mem.value;

  // 2) Fresh disk hit (survives restarts) — re-warm memory and return.
  const disk = await cacheGet<LeetCodeProblem>(CACHE_NS, slug);
  if (disk && disk.ageMs < TTL_MS) {
    cache.set(slug, { value: disk.value, at: Date.now() - disk.ageMs });
    return disk.value;
  }

  // 3) Cache stale or absent → hit the network.
  try {
    const res = await fetchWithTimeout(
      `${API_BASE}/select?titleSlug=${encodeURIComponent(slug)}`,
    );
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = (await res.json()) as Record<string, unknown>;

    const value: LeetCodeProblem = {
      slug,
      questionId: (data.questionId as string) || undefined,
      title: (data.questionTitle as string) || (data.title as string) || slug,
      difficulty: (data.difficulty as string) || undefined,
      content: (data.question as string) || null,
      topicTags: (data.topicTags as LeetCodeProblem["topicTags"]) || [],
      hints: (data.hints as string[]) || [],
      live: true,
    };
    cache.set(slug, { value, at: Date.now() });
    await cacheSet(CACHE_NS, slug, value);
    return value;
  } catch {
    // Network failed (often a rate limit). Prefer ANY cached copy, even stale —
    // a slightly old statement beats re-hammering the API or showing a bare stub.
    if (mem) return mem.value;
    if (disk) return disk.value;
    // Fallback stub — keeps the solve view working even when the API is down.
    const stub: LeetCodeProblem = {
      slug,
      title: slug
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
      content: null,
      topicTags: [],
      hints: [],
      live: false,
    };
    return stub;
  }
}

export function leetcodeUrl(slug: string): string {
  return `https://leetcode.com/problems/${slug}/`;
}
