// Shared types for the progress-sync layer. Mirrors the shape of lib/ai/types.ts:
// a small backend interface + a typed error whose `kind` the engine/UI can act on.

import type { ProgressData } from "@/lib/store/progress";

export type SyncBackendId = "folder" | "redis" | "cloudflare" | "firebase";

export type SyncErrorKind = "auth" | "network" | "not_found" | "config" | "other";

export class SyncError extends Error {
  kind: SyncErrorKind;
  backendId?: SyncBackendId;

  constructor(message: string, kind: SyncErrorKind, backendId?: SyncBackendId) {
    super(message);
    this.name = "SyncError";
    this.kind = kind;
    this.backendId = backendId;
  }
}

export interface SyncHealth {
  ok: boolean;
  error?: string;
}

export interface SyncBackend {
  id: SyncBackendId;
  label: string;
  /** Fetch the remote doc; null when nothing has ever been pushed. Throws SyncError. */
  pull(signal?: AbortSignal): Promise<ProgressData | null>;
  /** Overwrite the remote doc. Throws SyncError. */
  push(data: ProgressData, signal?: AbortSignal): Promise<void>;
  /** Cheap reachability/auth probe for the Settings "Test" button. */
  healthCheck(signal?: AbortSignal): Promise<SyncHealth>;
}

export interface SyncStatus {
  enabled: boolean;
  backend: SyncBackendId | null;
  configured: boolean;
  syncing: boolean;
  /** In-memory only — resets on server restart. */
  lastSyncAt: string | null;
  lastResult: { ok: boolean; error?: string } | null;
}
