"use client";

// The AI-provider cards, extracted behavior-preserving from the old
// SettingsView: fallback-chain order via move up/down, star = primary,
// expandable config with key input + model pickers + "Save & test".

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
import { Field, Highlight, inputClass } from "./primitives";
import type { SearchMatch } from "./searchIndex";
import type { ProviderRow, TestState } from "./types";

export interface ModelListState {
  models: ModelOption[];
  loading: boolean;
  error?: string;
  loaded?: boolean;
}

interface Props {
  rows: ProviderRow[];
  activeProvider: string;
  keyEdits: Record<string, string>;
  expanded: Record<string, boolean>;
  tests: Record<string, TestState>;
  modelLists: Record<string, ModelListState>;
  match: SearchMatch | null;
  query: string;
  onPatchRow: (id: string, patch: Partial<ProviderRow>) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onSetActive: (id: string) => void;
  onExpand: (id: string) => void;
  onKeyEdit: (id: string, value: string) => void;
  onTest: (id: string) => void;
  onRefreshModels: (id: string) => void;
}

export function ProvidersSection({
  rows,
  activeProvider,
  keyEdits,
  expanded,
  tests,
  modelLists,
  match,
  query,
  onPatchRow,
  onMove,
  onSetActive,
  onExpand,
  onKeyEdit,
  onTest,
  onRefreshModels,
}: Props) {
  return (
    <div className="space-y-3">
      {rows.map((r, i) => {
        if (match && !match.rowIds.has(`provider:${r.id}`)) return null;
        const isActive = activeProvider === r.id;
        const t = tests[r.id];
        // While searching, cards render collapsed (expanding stays manual).
        const open = !match && expanded[r.id];
        return (
          <Card key={r.id}>
            <div className="flex items-center gap-3 p-4">
              <div className="flex flex-col">
                <button
                  aria-label="Move up"
                  disabled={i === 0}
                  onClick={() => onMove(i, -1)}
                  className="text-muted hover:text-foreground disabled:opacity-30"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  aria-label="Move down"
                  disabled={i === rows.length - 1}
                  onClick={() => onMove(i, 1)}
                  className="text-muted hover:text-foreground disabled:opacity-30"
                >
                  <ChevronDown size={16} />
                </button>
              </div>

              <button
                aria-label="Set as primary"
                onClick={() => onSetActive(r.id)}
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
                  <span className="font-medium">
                    <Highlight text={r.label} query={match ? query : ""} />
                  </span>
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
                  onChange={(e) => onPatchRow(r.id, { enabled: e.target.checked })}
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
                      onChange={(e) => onKeyEdit(r.id, e.target.value)}
                      className={inputClass}
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
                      onChange={(e) => onPatchRow(r.id, { baseURL: e.target.value })}
                      className={inputClass}
                    />
                  </Field>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Model (heavy / reasoning)">
                    <ModelCombobox
                      value={r.heavyModel}
                      onChange={(v) => onPatchRow(r.id, { heavyModel: v })}
                      onVision={(vision) => {
                        if (typeof vision === "boolean") onPatchRow(r.id, { supportsImages: vision });
                      }}
                      models={modelLists[r.id]?.models ?? []}
                      loading={modelLists[r.id]?.loading}
                      error={modelLists[r.id]?.error}
                      onRefresh={() => onRefreshModels(r.id)}
                    />
                  </Field>
                  <Field label="Model (light / fast)">
                    <ModelCombobox
                      value={r.lightModel}
                      onChange={(v) => onPatchRow(r.id, { lightModel: v })}
                      onVision={(vision) => {
                        if (typeof vision === "boolean") onPatchRow(r.id, { supportsImages: vision });
                      }}
                      models={modelLists[r.id]?.models ?? []}
                      loading={modelLists[r.id]?.loading}
                      error={modelLists[r.id]?.error}
                      onRefresh={() => onRefreshModels(r.id)}
                    />
                  </Field>
                </div>

                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={r.supportsImages}
                    onChange={(e) => onPatchRow(r.id, { supportsImages: e.target.checked })}
                  />
                  Model can see images (enables the whiteboard coach)
                </label>

                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => onTest(r.id)} disabled={t?.loading}>
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
  );
}
