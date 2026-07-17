"use client";

import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  XCircle,
  Star,
  ExternalLink,
} from "lucide-react";
import { Button, Card } from "@/components/ui";
import { ModelCombobox, type ModelOption } from "@/components/ModelCombobox";
import { cn } from "@/lib/utils";

interface ModelListState {
  models: ModelOption[];
  loading: boolean;
  error?: string;
  loaded?: boolean;
}

interface ProviderRow {
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

interface SettingsPayload {
  activeProvider: string;
  fallbackChain: string[];
  providers: ProviderRow[];
}

interface TestState {
  loading?: boolean;
  ok?: boolean;
  error?: string;
}

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

export function SettingsView() {
  const [rows, setRows] = useState<ProviderRow[]>([]);
  const [activeProvider, setActiveProvider] = useState("claude");
  const [keyEdits, setKeyEdits] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [tests, setTests] = useState<Record<string, TestState>>({});
  const [modelLists, setModelLists] = useState<Record<string, ModelListState>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function loadModels(id: string, fresh = false) {
    setModelLists((m) => ({ ...m, [id]: { ...(m[id] ?? { models: [] }), loading: true } }));
    try {
      const res = await fetch(`/api/models?provider=${id}${fresh ? "&fresh=1" : ""}`);
      const data = (await res.json()) as { models: ModelOption[]; error?: string };
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

  useEffect(() => {
    let alive = true;
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d: SettingsPayload) => {
        if (!alive) return;
        setRows(orderRows(d));
        setActiveProvider(d.activeProvider);
        setLoading(false);
      })
      .catch(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

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
    return {
      action: "save" as const,
      activeProvider,
      fallbackChain: rows.map((r) => r.id),
      providers,
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
        // Refresh redacted view (hasKey flags etc.)
        const d: SettingsPayload = await fetch("/api/settings").then((r) => r.json());
        setRows(orderRows(d));
        setActiveProvider(d.activeProvider);
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

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted">
        <Loader2 size={16} className="animate-spin" /> Loading settings…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold">AI providers</h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        Claude (your Claude Code session) is the default. Add fallback providers so
        the tutor keeps working when Claude hits its limit. Order below = the order
        they&apos;re tried. Keys are stored locally and never leave your machine.
      </p>

      <div className="space-y-3">
        {rows.map((r, i) => {
          const isActive = activeProvider === r.id;
          const t = tests[r.id];
          const open = expanded[r.id];
          return (
            <Card key={r.id}>
              <div className="flex items-center gap-3 p-4">
                <div className="flex flex-col">
                  <button
                    aria-label="Move up"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    className="text-muted hover:text-foreground disabled:opacity-30"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    aria-label="Move down"
                    disabled={i === rows.length - 1}
                    onClick={() => move(i, 1)}
                    className="text-muted hover:text-foreground disabled:opacity-30"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>

                <button
                  aria-label="Set as primary"
                  onClick={() => {
                    setActiveProvider(r.id);
                    setSaved(false);
                  }}
                  className={cn(
                    "shrink-0",
                    isActive ? "text-amber-400" : "text-muted hover:text-foreground",
                  )}
                  title={isActive ? "Primary provider" : "Set as primary"}
                >
                  <Star size={16} fill={isActive ? "currentColor" : "none"} />
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.label}</span>
                    {isActive && (
                      <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] text-amber-400">
                        primary
                      </span>
                    )}
                    {r.supportsImages && (
                      <span className="rounded-full bg-sky-400/10 px-2 py-0.5 text-[10px] text-sky-300">
                        vision
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted">
                    {r.isClaude
                      ? "Uses your local Claude Code session — no key needed."
                      : r.configured
                        ? r.heavyModel
                        : "Needs an API key" + (r.envKey ? ` or ${r.envKey}` : "")}
                  </div>
                </div>

                {t?.ok === true && <CheckCircle2 size={16} className="text-emerald-400" />}
                {t?.ok === false && <XCircle size={16} className="text-rose-400" />}

                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={r.enabled}
                    onChange={(e) => patchRow(r.id, { enabled: e.target.checked })}
                  />
                  enabled
                </label>

                {!r.isClaude && (
                  <button
                    onClick={() => onExpand(r.id)}
                    className="rounded-md px-2 py-1 text-xs text-muted hover:bg-background"
                  >
                    {open ? "Hide" : "Configure"}
                  </button>
                )}
              </div>

              {open && !r.isClaude && (
                <div className="space-y-3 rounded-b-xl border-t border-border bg-background/40 p-4">
                  <Field label={`API key${r.envKey ? ` (or ${r.envKey} env var)` : ""}`}>
                    {r.keyFromEnv ? (
                      <input
                        disabled
                        value={`Set via ${r.envKey} environment variable`}
                        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted"
                      />
                    ) : (
                      <input
                        type="password"
                        value={keyEdits[r.id] ?? ""}
                        placeholder={r.hasKey ? "•••••••• (saved — type to replace)" : "Paste your key"}
                        onChange={(e) => {
                          setKeyEdits((k) => ({ ...k, [r.id]: e.target.value }));
                          setSaved(false);
                        }}
                        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent/50"
                      />
                    )}
                    {r.signupUrl && (
                      <a
                        href={r.signupUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs text-accent hover:underline"
                      >
                        Get a key <ExternalLink size={11} />
                      </a>
                    )}
                  </Field>

                  {r.isCustom && (
                    <Field label="Base URL (OpenAI-compatible, ending in /v1)">
                      <input
                        value={r.baseURL}
                        placeholder="https://your-endpoint/v1"
                        onChange={(e) => patchRow(r.id, { baseURL: e.target.value })}
                        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent/50"
                      />
                    </Field>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Model (heavy / reasoning)">
                      <ModelCombobox
                        value={r.heavyModel}
                        onChange={(v) => patchRow(r.id, { heavyModel: v })}
                        onVision={(vision) => {
                          if (typeof vision === "boolean") patchRow(r.id, { supportsImages: vision });
                        }}
                        models={modelLists[r.id]?.models ?? []}
                        loading={modelLists[r.id]?.loading}
                        error={modelLists[r.id]?.error}
                        onRefresh={() => loadModels(r.id, true)}
                      />
                    </Field>
                    <Field label="Model (light / fast)">
                      <ModelCombobox
                        value={r.lightModel}
                        onChange={(v) => patchRow(r.id, { lightModel: v })}
                        onVision={(vision) => {
                          if (typeof vision === "boolean") patchRow(r.id, { supportsImages: vision });
                        }}
                        models={modelLists[r.id]?.models ?? []}
                        loading={modelLists[r.id]?.loading}
                        error={modelLists[r.id]?.error}
                        onRefresh={() => loadModels(r.id, true)}
                      />
                    </Field>
                  </div>

                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={r.supportsImages}
                      onChange={(e) => patchRow(r.id, { supportsImages: e.target.checked })}
                    />
                    Model can see images (enables the whiteboard coach)
                  </label>

                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Button variant="outline" size="sm" onClick={() => test(r.id)} disabled={t?.loading}>
                        {t?.loading ? (
                          <>
                            <Loader2 size={13} className="animate-spin" /> Testing…
                          </>
                        ) : (
                          "Save & test"
                        )}
                      </Button>
                      {t?.ok === true && <span className="text-xs text-emerald-400">Reachable ✓</span>}
                      {t?.ok === false && <span className="text-xs text-rose-400">Failed</span>}
                    </div>
                    {t?.ok === false && t?.error && (
                      <p className="whitespace-pre-wrap break-words rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                        {t.error}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}
