"use client";

// VS Code-style settings: left section nav + a search box that filters
// individual settings rows across all sections. One sticky save bar persists
// AI-provider and sync settings together through POST /api/settings.

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import { matchQuery, type SectionId } from "./searchIndex";
import { SettingsNav, SettingsSearch, SettingsSection } from "./primitives";
import { ProvidersSection, type ModelListState } from "./ProvidersSection";
import { SyncSection, type SyncFormState, type SyncTokenKey } from "./SyncSection";
import { DataSection } from "./DataSection";
import { ProfileSection } from "./ProfileSection";
import type {
  ProviderRow,
  SettingsPayload,
  SyncStatusPayload,
  TestState,
} from "./types";

function orderRows(data: SettingsPayload): ProviderRow[] {
  const byId = new Map(data.providers.map((p) => [p.id, p]));
  const out: ProviderRow[] = [];
  const seen = new Set<string>();
  for (const id of data.fallbackChain) {
    const p = byId.get(id);
    if (p && !seen.has(id)) {
      out.push(p);
      seen.add(id);
    }
  }
  for (const p of data.providers) {
    if (!seen.has(p.id)) out.push(p);
  }
  return out;
}

function syncFormFrom(d: SettingsPayload): SyncFormState {
  return {
    enabled: d.sync.enabled,
    backend: d.sync.backend,
    autoSync: d.sync.autoSync,
    folderPath: d.sync.folder.path,
    redisUrl: d.sync.redis.url,
    redisKey: d.sync.redis.key,
    cfUrl: d.sync.cloudflare.url,
  };
}

export function SettingsView() {
  // ---- Provider state (moved from the old single-page SettingsView) ----
  const [rows, setRows] = useState<ProviderRow[]>([]);
  const [activeProvider, setActiveProvider] = useState("claude");
  const [keyEdits, setKeyEdits] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [tests, setTests] = useState<Record<string, TestState>>({});
  const [modelLists, setModelLists] = useState<Record<string, ModelListState>>({});

  const [isAppImage, setIsAppImage] = useState(false);

  // ---- Sync state ----
  const [syncData, setSyncData] = useState<SettingsPayload["sync"] | null>(null);
  const [syncForm, setSyncForm] = useState<SyncFormState | null>(null);
  const [tokenEdits, setTokenEdits] = useState<Partial<Record<SyncTokenKey, string>>>({});
  const [syncTest, setSyncTest] = useState<TestState>({});
  const [syncStatus, setSyncStatus] = useState<SyncStatusPayload | null>(null);
  const [syncingNow, setSyncingNow] = useState(false);

  // ---- Shell state ----
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<SectionId>("providers");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const match = matchQuery(query);

  function applyPayload(d: SettingsPayload) {
    setRows(orderRows(d));
    setActiveProvider(d.activeProvider);
    setSyncData(d.sync);
    setIsAppImage(Boolean(d.isAppImage));
  }

  async function refetchSettings(): Promise<SettingsPayload> {
    const d = (await fetch("/api/settings").then((r) => r.json())) as SettingsPayload;
    applyPayload(d);
    return d;
  }

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/api/settings").then((r) => r.json()) as Promise<SettingsPayload>,
      fetch("/api/sync").then((r) => r.json()) as Promise<SyncStatusPayload>,
    ])
      .then(([d, s]) => {
        if (!alive) return;
        applyPayload(d);
        setSyncForm(syncFormFrom(d));
        setSyncStatus(s);
        setLoading(false);
      })
      .catch(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  // ---- Provider handlers (behavior-preserving) ----

  async function loadModels(id: string, fresh = false) {
    setModelLists((m) => ({ ...m, [id]: { ...(m[id] ?? { models: [] }), loading: true } }));
    try {
      const res = await fetch(`/api/models?provider=${id}${fresh ? "&fresh=1" : ""}`);
      const data = (await res.json()) as { models: ModelListState["models"]; error?: string };
      setModelLists((m) => ({
        ...m,
        [id]: { models: data.models ?? [], loading: false, error: data.error, loaded: true },
      }));
    } catch (err) {
      setModelLists((m) => ({
        ...m,
        [id]: {
          models: m[id]?.models ?? [],
          loading: false,
          loaded: true,
          error: err instanceof Error ? err.message : String(err),
        },
      }));
    }
  }

  function onExpand(id: string) {
    const willOpen = !expanded[id];
    setExpanded((x) => ({ ...x, [id]: willOpen }));
    if (willOpen && !modelLists[id]?.loaded) loadModels(id);
  }

  function patchRow(id: string, patch: Partial<ProviderRow>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setSaved(false);
  }

  function move(index: number, dir: -1 | 1) {
    setRows((rs) => {
      const next = [...rs];
      const j = index + dir;
      if (j < 0 || j >= next.length) return rs;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
    setSaved(false);
  }

  function buildSavePayload() {
    const providers: Record<string, Record<string, unknown>> = {};
    for (const r of rows) {
      const o: Record<string, unknown> = {
        enabled: r.enabled,
        baseURL: r.baseURL,
        heavyModel: r.heavyModel,
        lightModel: r.lightModel,
        supportsImages: r.supportsImages,
      };
      // Only send a key when the user typed one (empty string = clear).
      if (r.id in keyEdits) o.apiKey = keyEdits[r.id];
      providers[r.id] = o;
    }
    const sync: Record<string, unknown> | undefined = syncForm
      ? {
          enabled: syncForm.enabled,
          backend: syncForm.backend,
          autoSync: syncForm.autoSync,
          folder: { path: syncForm.folderPath },
          redis: {
            url: syncForm.redisUrl,
            key: syncForm.redisKey,
            ...("redisToken" in tokenEdits ? { token: tokenEdits.redisToken } : {}),
          },
          cloudflare: {
            url: syncForm.cfUrl,
            ...("cfToken" in tokenEdits ? { token: tokenEdits.cfToken } : {}),
          },
        }
      : undefined;
    return {
      action: "save" as const,
      activeProvider,
      fallbackChain: rows.map((r) => r.id),
      providers,
      ...(sync ? { sync } : {}),
    };
  }

  async function save(): Promise<boolean> {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSavePayload()),
      });
      const ok = res.ok;
      if (ok) {
        setSaved(true);
        setKeyEdits({});
        setTokenEdits({});
        // Refresh redacted view (hasKey/hasToken flags etc.)
        const d = await refetchSettings();
        setSyncForm(syncFormFrom(d));
        // A newly-saved key unlocks the full model list — reload expanded cards.
        for (const id of Object.keys(expanded)) {
          if (expanded[id] && id !== "claude") loadModels(id, true);
        }
      }
      return ok;
    } finally {
      setSaving(false);
    }
  }

  async function test(id: string) {
    setTests((t) => ({ ...t, [id]: { loading: true } }));
    // Persist first so the test uses the latest key/model.
    const ok = await save();
    if (!ok) {
      setTests((t) => ({ ...t, [id]: { ok: false, error: "Couldn't save settings." } }));
      return;
    }
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", id }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      setTests((t) => ({ ...t, [id]: { ok: data.ok, error: data.error } }));
    } catch (err) {
      setTests((t) => ({
        ...t,
        [id]: { ok: false, error: err instanceof Error ? err.message : String(err) },
      }));
    }
  }

  // ---- Sync handlers ----

  async function refreshSyncStatus() {
    try {
      setSyncStatus((await fetch("/api/sync").then((r) => r.json())) as SyncStatusPayload);
    } catch {
      // banner stays as-is
    }
  }

  async function syncSaveAndTest() {
    setSyncTest({ loading: true });
    const ok = await save();
    if (!ok) {
      setSyncTest({ ok: false, error: "Couldn't save settings." });
      return;
    }
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", backend: syncForm?.backend }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      setSyncTest({ ok: data.ok, error: data.error });
    } catch (err) {
      setSyncTest({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  async function syncNow() {
    setSyncingNow(true);
    try {
      await save();
      const status = (await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "now" }),
      }).then((r) => r.json())) as SyncStatusPayload;
      setSyncStatus(status);
    } catch {
      await refreshSyncStatus();
    } finally {
      setSyncingNow(false);
    }
  }

  async function firebaseAuth(
    kind: "signin" | "signup",
    email: string,
    password: string,
  ): Promise<string | null> {
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: `firebase-${kind}`, email, password }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!data.ok) return data.error ?? "Sign-in failed.";
    await refetchSettings();
    return null;
  }

  async function firebaseSignOut() {
    await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "firebase-signout" }),
    }).catch(() => {});
    await refetchSettings();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted">
        <Loader2 size={16} className="animate-spin" /> Loading settings…
      </div>
    );
  }

  const noMatches =
    match &&
    Object.values(match.countsBySection).every((n) => n === 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <div className="mt-4">
        <SettingsSearch query={query} onChange={setQuery} />
      </div>

      <div className="mt-6 flex gap-8">
        <SettingsNav
          active={section}
          match={match}
          onSelect={(id) => {
            setSection(id);
            setQuery("");
          }}
        />

        <div className="min-w-0 flex-1">
          {noMatches && (
            <div className="py-16 text-center text-sm text-muted">
              No settings matching “{query}”.{" "}
              <button className="text-accent hover:underline" onClick={() => setQuery("")}>
                Clear
              </button>
            </div>
          )}

          <SettingsSection
            id="providers"
            title="AI Providers"
            blurb="Claude (your Claude Code session) is the default. Add fallback providers so the tutor keeps working when Claude hits its limit. Order below = the order they're tried. Keys are stored locally and never leave your machine."
            match={match}
            active={section}
          >
            {isAppImage && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>
                  You&apos;re running the <strong>AppImage</strong> build.
                  AppImages bundle their own runtime and can&apos;t use the
                  Claude Code installed on your system, so the default Claude
                  provider won&apos;t work here. To use Claude, install the
                  .deb, .rpm, or Arch (.pacman) package from the{" "}
                  <a
                    href="https://github.com/parapsychic/leetcode-dojo/releases"
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2"
                  >
                    releases page
                  </a>{" "}
                  — or configure an API-key provider below as your primary.
                </span>
              </div>
            )}
            <ProvidersSection
              rows={rows}
              activeProvider={activeProvider}
              keyEdits={keyEdits}
              expanded={expanded}
              tests={tests}
              modelLists={modelLists}
              match={match}
              query={query}
              onPatchRow={patchRow}
              onMove={move}
              onSetActive={(id) => {
                setActiveProvider(id);
                setSaved(false);
              }}
              onExpand={onExpand}
              onKeyEdit={(id, value) => {
                setKeyEdits((k) => ({ ...k, [id]: value }));
                setSaved(false);
              }}
              onTest={test}
              onRefreshModels={(id) => loadModels(id, true)}
            />
          </SettingsSection>

          <SettingsSection
            id="sync"
            title="Sync"
            blurb="Keep your progress in sync across devices. Pick a backend — every option is free, and each comes with a step-by-step guide."
            match={match}
            active={section}
          >
            {syncData && syncForm && (
              <SyncSection
                syncData={syncData}
                form={syncForm}
                tokenEdits={tokenEdits}
                match={match}
                query={query}
                test={syncTest}
                status={syncStatus}
                syncingNow={syncingNow}
                onForm={(patch) => {
                  setSyncForm((f) => (f ? { ...f, ...patch } : f));
                  setSaved(false);
                }}
                onTokenEdit={(key, value) => {
                  setTokenEdits((t) => ({ ...t, [key]: value }));
                  setSaved(false);
                }}
                onSaveAndTest={syncSaveAndTest}
                onSyncNow={syncNow}
                onFirebaseAuth={firebaseAuth}
                onFirebaseSignOut={firebaseSignOut}
              />
            )}
          </SettingsSection>

          <SettingsSection id="data" title="Data" match={match} active={section}>
            <DataSection match={match} query={query} />
          </SettingsSection>

          <SettingsSection id="profile" title="Profile" match={match} active={section}>
            <ProfileSection match={match} query={query} />
          </SettingsSection>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 mt-6 flex items-center gap-3 border-t border-border bg-background/70 px-4 py-3 backdrop-blur">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
        {saved && <span className="text-sm text-emerald-400">Saved.</span>}
      </div>
    </div>
  );
}
