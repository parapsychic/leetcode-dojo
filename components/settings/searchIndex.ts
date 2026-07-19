// Static index of every settings row for the VS Code-style search box.
// A row matches when every whitespace-separated token of the query is a
// substring of its haystack (label + keywords + section title).

import { ALL_PROVIDER_IDS, labelFor } from "@/lib/ai/presets";
import { ALL_SYNC_BACKEND_IDS, SYNC_PRESETS } from "@/lib/sync/presets";

export type SectionId = "providers" | "sync" | "data" | "profile";

export const SECTIONS: { id: SectionId; title: string }[] = [
  { id: "providers", title: "AI Providers" },
  { id: "sync", title: "Sync" },
  { id: "data", title: "Data" },
  { id: "profile", title: "Profile" },
];

export interface IndexRow {
  sectionId: SectionId;
  rowId: string;
  label: string;
  keywords: string[];
}

const PROVIDER_ROWS: IndexRow[] = ALL_PROVIDER_IDS.map((id) => ({
  sectionId: "providers",
  rowId: `provider:${id}`,
  label: labelFor(id),
  keywords: ["provider", "api key", "model", "fallback", "llm", id],
}));

const SYNC_BACKEND_KEYWORDS: Record<string, string[]> = {
  folder: ["syncthing", "folder", "path", "p2p", "peer"],
  redis: ["redis", "upstash", "rest", "token", "key"],
  cloudflare: ["cloudflare", "worker", "workers", "kv", "wrangler", "token"],
  firebase: ["firebase", "cloud", "account", "email", "password", "sign in"],
};

const SYNC_ROWS: IndexRow[] = [
  {
    sectionId: "sync",
    rowId: "sync:enable",
    label: "Enable sync",
    keywords: ["sync", "enable", "devices", "backup"],
  },
  {
    sectionId: "sync",
    rowId: "sync:auto",
    label: "Sync automatically",
    keywords: ["sync", "auto", "automatic", "background"],
  },
  ...ALL_SYNC_BACKEND_IDS.map((id) => ({
    sectionId: "sync" as const,
    rowId: `sync:${id}`,
    label: SYNC_PRESETS[id].label,
    keywords: ["sync", "backend", ...(SYNC_BACKEND_KEYWORDS[id] ?? [])],
  })),
];

export const SETTINGS_INDEX: IndexRow[] = [
  ...PROVIDER_ROWS,
  ...SYNC_ROWS,
  {
    sectionId: "data",
    rowId: "data:export",
    label: "Export progress",
    keywords: ["export", "download", "backup", "json", "data"],
  },
  {
    sectionId: "data",
    rowId: "data:import",
    label: "Import progress",
    keywords: ["import", "restore", "upload", "merge", "replace", "json", "data"],
  },
  {
    sectionId: "profile",
    rowId: "profile:name",
    label: "Display name",
    keywords: ["profile", "name", "user"],
  },
];

export interface SearchMatch {
  rowIds: Set<string>;
  countsBySection: Record<SectionId, number>;
}

const SECTION_TITLES = new Map(SECTIONS.map((s) => [s.id, s.title.toLowerCase()]));

/** null when the query is empty (no filtering). */
export function matchQuery(query: string): SearchMatch | null {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  const rowIds = new Set<string>();
  const countsBySection: Record<SectionId, number> = {
    providers: 0,
    sync: 0,
    data: 0,
    profile: 0,
  };
  for (const row of SETTINGS_INDEX) {
    const haystack = `${row.label} ${row.keywords.join(" ")} ${SECTION_TITLES.get(row.sectionId)}`.toLowerCase();
    if (tokens.every((t) => haystack.includes(t))) {
      rowIds.add(row.rowId);
      countsBySection[row.sectionId] += 1;
    }
  }
  return { rowIds, countsBySection };
}
