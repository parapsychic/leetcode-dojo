// Client-side shapes of GET /api/settings and GET /api/sync responses.

export interface ProviderRow {
  id: string;
  label: string;
  isClaude: boolean;
  isCustom: boolean;
  enabled: boolean;
  configured: boolean;
  hasKey: boolean;
  keyFromEnv: boolean;
  envKey?: string;
  baseURL: string;
  heavyModel: string;
  lightModel: string;
  supportsImages: boolean;
  signupUrl?: string;
}

export interface SyncPayload {
  enabled: boolean;
  backend: string | null;
  autoSync: boolean;
  configured: boolean;
  folder: { path: string; fromEnv: boolean };
  redis: {
    url: string;
    key: string;
    hasToken: boolean;
    urlFromEnv: boolean;
    tokenFromEnv: boolean;
    envUrl: string;
    envToken: string;
  };
  cloudflare: {
    url: string;
    hasToken: boolean;
    urlFromEnv: boolean;
    tokenFromEnv: boolean;
    envUrl: string;
    envToken: string;
  };
  firebase: { signedIn: boolean; email: string | null };
}

export interface SettingsPayload {
  activeProvider: string;
  fallbackChain: string[];
  providers: ProviderRow[];
  sync: SyncPayload;
}

export interface SyncStatusPayload {
  enabled: boolean;
  backend: string | null;
  configured: boolean;
  syncing: boolean;
  lastSyncAt: string | null;
  lastResult: { ok: boolean; error?: string } | null;
}

export interface TestState {
  loading?: boolean;
  ok?: boolean;
  error?: string;
}
