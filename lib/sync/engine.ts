// The sync engine: one serialized pull→merge→push cycle at a time, a debounced
// trigger for after-mutation pushes, and a rate-limited auto trigger for app
// load. State lives on globalThis because next dev can compile this module
// into several route bundles — a plain module-level timer would be duplicated.

import { getProgress, mergeIntoProgress, type ProgressData } from "@/lib/store/progress";
import { backendFor } from "./backends";
import { backendConfigured, getResolvedSync } from "./config";
import { mergeProgress } from "./merge";
import { SyncError, type SyncStatus } from "./types";

const DEBOUNCE_MS = 4_000;
const AUTO_MIN_INTERVAL_MS = 5 * 60_000;

interface EngineState {
  chain: Promise<unknown>;
  debounce: ReturnType<typeof setTimeout> | null;
  lastAutoAt: number;
  syncing: boolean;
  lastSyncAt: string | null;
  lastResult: { ok: boolean; error?: string } | null;
}

const g = globalThis as typeof globalThis & { __efdxSyncEngine?: EngineState };

function state(): EngineState {
  return (g.__efdxSyncEngine ??= {
    chain: Promise.resolve(),
    debounce: null,
    lastAutoAt: 0,
    syncing: false,
    lastSyncAt: null,
    lastResult: null,
  });
}

// ---- Content comparison (ignores updatedAt so timestamp-only diffs don't churn) ----

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const entries = Object.entries(v as Record<string, unknown>)
    .filter(([, val]) => val !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, val]) => `${JSON.stringify(k)}:${stableStringify(val)}`);
  return `{${entries.join(",")}}`;
}

function sameContent(a: ProgressData, b: ProgressData): boolean {
  return (
    stableStringify({ ...a, updatedAt: undefined }) ===
    stableStringify({ ...b, updatedAt: undefined })
  );
}

// ---- The cycle ----

async function runCycle(opts: { force?: boolean }): Promise<{ ok: boolean; error?: string }> {
  const resolved = await getResolvedSync();
  if (!resolved.enabled) return { ok: false, error: "Sync is disabled." };
  if (!resolved.backend) return { ok: false, error: "No sync backend selected." };
  if (!backendConfigured(resolved, resolved.backend)) {
    return { ok: false, error: "The selected backend isn't fully configured yet." };
  }
  const backend = backendFor(resolved, resolved.backend)!;

  try {
    if (opts.force) {
      // Import-replace path: push local as-is, skip pull/merge once.
      await backend.push(await getProgress());
      return { ok: true };
    }

    // A pull failure (network, auth, corrupt doc) aborts here — the remote is
    // never overwritten unless we could read it.
    const remote = await backend.pull();
    let local = await getProgress();

    if (remote === null) {
      await backend.push(local);
      return { ok: true };
    }

    const merged = mergeProgress(local, remote);
    if (!sameContent(merged, local)) {
      // Re-merges against the freshest local inside the serialized store write,
      // so a mutation racing this cycle is never lost.
      local = await mergeIntoProgress(remote);
    }
    if (!sameContent(local, remote)) {
      await backend.push(local);
    }
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof SyncError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    return { ok: false, error: message };
  }
}

function enqueue(opts: { force?: boolean }): Promise<{ ok: boolean; error?: string }> {
  const st = state();
  const run = async () => {
    st.syncing = true;
    try {
      const result = await runCycle(opts);
      st.lastResult = result;
      if (result.ok) st.lastSyncAt = new Date().toISOString();
      return result;
    } finally {
      st.syncing = false;
    }
  };
  const p = st.chain.then(run, run);
  st.chain = p.catch(() => {});
  return p;
}

// ---- Public API ----

export async function getSyncStatus(): Promise<SyncStatus> {
  const st = state();
  const resolved = await getResolvedSync();
  return {
    enabled: resolved.enabled,
    backend: resolved.backend,
    configured: resolved.configured,
    syncing: st.syncing,
    lastSyncAt: st.lastSyncAt,
    lastResult: st.lastResult,
  };
}

/** Explicit "Sync now": always runs (and reports why it can't). */
export async function syncNow(): Promise<SyncStatus> {
  await enqueue({});
  return getSyncStatus();
}

/** Push local as-is without pulling first (import-replace). */
export async function forcePush(): Promise<SyncStatus> {
  await enqueue({ force: true });
  return getSyncStatus();
}

/** Debounced auto-push after a progress mutation. Fire-and-forget. */
export function scheduleSync(): void {
  const st = state();
  if (st.debounce) clearTimeout(st.debounce);
  st.debounce = setTimeout(() => {
    st.debounce = null;
    void (async () => {
      const resolved = await getResolvedSync();
      if (!resolved.enabled || !resolved.autoSync || !resolved.configured) return;
      await enqueue({});
    })().catch(() => {});
  }, DEBOUNCE_MS);
  // Don't keep the process alive just for a pending sync.
  st.debounce.unref?.();
}

/** Rate-limited auto-pull, pinged by the client on app load. */
export async function autoSync(): Promise<{ started: boolean; status: SyncStatus }> {
  const st = state();
  const resolved = await getResolvedSync();
  const eligible =
    resolved.enabled &&
    resolved.autoSync &&
    resolved.configured &&
    !st.syncing &&
    Date.now() - st.lastAutoAt >= AUTO_MIN_INTERVAL_MS;
  if (eligible) {
    st.lastAutoAt = Date.now();
    await enqueue({});
  }
  return { started: eligible, status: await getSyncStatus() };
}
