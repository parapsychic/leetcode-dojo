// Small fetch wrapper shared by the HTTP sync backends: every remote call gets
// a hard timeout so a hung "Sync now" can't wedge the UI, and network-level
// failures surface as SyncError("network").

import { SyncError, type SyncBackendId } from "./types";

const TIMEOUT_MS = 15_000;

export async function syncFetch(
  backendId: SyncBackendId,
  url: string,
  init: RequestInit = {},
  signal?: AbortSignal,
): Promise<Response> {
  const signals = [AbortSignal.timeout(TIMEOUT_MS)];
  if (signal) signals.push(signal);
  try {
    return await fetch(url, { ...init, signal: AbortSignal.any(signals) });
  } catch (err) {
    const message =
      err instanceof Error && err.name === "TimeoutError"
        ? `Request timed out after ${TIMEOUT_MS / 1000}s`
        : err instanceof Error
          ? err.message
          : String(err);
    throw new SyncError(message, "network", backendId);
  }
}
