// Generic persistent key/value cache backed by JSON files on disk.
// Survives server restarts (and Next.js dev module reloads), unlike an in-memory
// Map — which is what we need to stop hammering rate-limited upstreams (the
// alfa-leetcode-api) and to avoid re-paying for identical LLM calls.

import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { dataDir } from "@/lib/store/paths";

interface Entry<T> {
  value: T;
  at: number; // epoch ms when written
}

function cacheRoot(): string {
  return path.join(dataDir(), "cache");
}

// One file per key, named by a hash of the (often long) cache key so arbitrary
// keys map to safe filenames. Namespaced into a subdir per cache.
function keyToFile(namespace: string, key: string): string {
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  return path.join(cacheRoot(), namespace, `${hash}.json`);
}

/** Read a cached value, returning it with its age. null if missing/unreadable. */
export async function cacheGet<T>(
  namespace: string,
  key: string,
): Promise<{ value: T; ageMs: number } | null> {
  try {
    const raw = await fs.readFile(keyToFile(namespace, key), "utf8");
    const entry = JSON.parse(raw) as Entry<T>;
    return { value: entry.value, ageMs: Date.now() - entry.at };
  } catch {
    return null;
  }
}

/** Write a value to the cache (atomic via tmp + rename). */
export async function cacheSet<T>(
  namespace: string,
  key: string,
  value: T,
): Promise<void> {
  const file = keyToFile(namespace, key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify({ value, at: Date.now() } as Entry<T>), "utf8");
  await fs.rename(tmp, file);
}
