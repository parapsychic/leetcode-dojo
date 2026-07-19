"use client";

// The Sync section: master toggles, backend chooser cards, per-backend config
// fields (or the Firebase sign-in widget), a collapsible step-by-step setup
// guide per backend, and Save & test / Sync now with a status line.

import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, Loader2, RefreshCw, XCircle } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import { ALL_SYNC_BACKEND_IDS, SYNC_PRESETS, type SyncFieldKey } from "@/lib/sync/presets";
import { Field, GuideSteps, Highlight, SettingRow, inputClass } from "./primitives";
import type { SearchMatch } from "./searchIndex";
import type { SyncPayload, SyncStatusPayload, TestState } from "./types";

export interface SyncFormState {
  enabled: boolean;
  backend: string | null;
  autoSync: boolean;
  folderPath: string;
  redisUrl: string;
  redisKey: string;
  cfUrl: string;
}

export type SyncTokenKey = "redisToken" | "cfToken";

interface Props {
  syncData: SyncPayload; // server truth: env flags, hasToken, firebase state
  form: SyncFormState;
  tokenEdits: Partial<Record<SyncTokenKey, string>>;
  match: SearchMatch | null;
  query: string;
  test: TestState;
  status: SyncStatusPayload | null;
  syncingNow: boolean;
  onForm: (patch: Partial<SyncFormState>) => void;
  onTokenEdit: (key: SyncTokenKey, value: string) => void;
  onSaveAndTest: () => void;
  onSyncNow: () => void;
  onFirebaseAuth: (kind: "signin" | "signup", email: string, password: string) => Promise<string | null>;
  onFirebaseSignOut: () => Promise<void>;
}

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  return h < 24 ? `${h}h ago` : new Date(iso).toLocaleString();
}

export function SyncSection(props: Props) {
  const { syncData, form, tokenEdits, match, query, test, status } = props;
  const selected = form.backend;
  const preset = selected ? SYNC_PRESETS[selected as keyof typeof SYNC_PRESETS] : null;
  // Guide open by default while the selected backend isn't configured yet.
  const [guideOpen, setGuideOpen] = useState<boolean | null>(null);
  const showGuide = guideOpen ?? !syncData.configured;

  function fieldValue(key: SyncFieldKey): { value: string; fromEnv: boolean; hasSaved: boolean } {
    switch (key) {
      case "folderPath":
        return { value: form.folderPath, fromEnv: syncData.folder.fromEnv, hasSaved: false };
      case "redisUrl":
        return { value: form.redisUrl, fromEnv: syncData.redis.urlFromEnv, hasSaved: false };
      case "redisKey":
        return { value: form.redisKey, fromEnv: false, hasSaved: false };
      case "redisToken":
        return {
          value: tokenEdits.redisToken ?? "",
          fromEnv: syncData.redis.tokenFromEnv,
          hasSaved: syncData.redis.hasToken,
        };
      case "cfUrl":
        return { value: form.cfUrl, fromEnv: syncData.cloudflare.urlFromEnv, hasSaved: false };
      case "cfToken":
        return {
          value: tokenEdits.cfToken ?? "",
          fromEnv: syncData.cloudflare.tokenFromEnv,
          hasSaved: syncData.cloudflare.hasToken,
        };
    }
  }

  function setField(key: SyncFieldKey, value: string) {
    switch (key) {
      case "folderPath":
        return props.onForm({ folderPath: value });
      case "redisUrl":
        return props.onForm({ redisUrl: value });
      case "redisKey":
        return props.onForm({ redisKey: value });
      case "cfUrl":
        return props.onForm({ cfUrl: value });
      case "redisToken":
        return props.onTokenEdit("redisToken", value);
      case "cfToken":
        return props.onTokenEdit("cfToken", value);
    }
  }

  return (
    <div>
      <SettingRow
        rowId="sync:enable"
        label="Enable sync"
        description="Keep progress in sync across your devices through the backend you pick below."
        match={match}
        query={query}
      >
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => props.onForm({ enabled: e.target.checked })}
          />
          Sync my progress
        </label>
      </SettingRow>

      <SettingRow
        rowId="sync:auto"
        label="Sync automatically"
        description="Push a few seconds after you solve something, and pull when the app opens. Off = only the “Sync now” button."
        match={match}
        query={query}
      >
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.autoSync}
            onChange={(e) => props.onForm({ autoSync: e.target.checked })}
          />
          Sync in the background
        </label>
      </SettingRow>

      {/* Backend chooser */}
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {ALL_SYNC_BACKEND_IDS.map((id) => {
          if (match && !match.rowIds.has(`sync:${id}`)) return null;
          const p = SYNC_PRESETS[id];
          const isSelected = selected === id;
          return (
            <Card
              key={id}
              // Picking a hosted backend implies wanting sync on — flip the
              // master switch too. The folder option still needs a path first,
              // so it leaves the switch alone.
              onClick={() =>
                props.onForm({ backend: id, ...(id !== "folder" ? { enabled: true } : {}) })
              }
              className={cn(
                "cursor-pointer p-4 transition-colors",
                isSelected ? "border-accent/60 bg-accent/5" : "hover:border-accent/30",
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "grid h-4 w-4 place-items-center rounded-full border",
                    isSelected ? "border-accent" : "border-border",
                  )}
                >
                  {isSelected && <span className="h-2 w-2 rounded-full bg-accent" />}
                </span>
                <span className="font-medium">
                  <Highlight text={p.label} query={match ? query : ""} />
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted">{p.tagline}</p>
              <p className="mt-2 text-[11px] text-muted/80">Requires: {p.requires}</p>
            </Card>
          );
        })}
      </div>

      {/* Selected backend config */}
      {preset && (!match || match.rowIds.has(`sync:${preset.id}`)) && (
        <Card className="mt-4 p-4">
          <div className="space-y-3">
            {preset.id === "firebase" ? (
              <FirebaseAuthWidget
                signedIn={syncData.firebase.signedIn}
                email={syncData.firebase.email}
                onAuth={props.onFirebaseAuth}
                onSignOut={props.onFirebaseSignOut}
              />
            ) : (
              preset.fields.map((f) => {
                const { value, fromEnv, hasSaved } = fieldValue(f.key);
                return (
                  <Field key={f.key} label={`${f.label}${f.envVar ? ` (or ${f.envVar} env var)` : ""}`}>
                    {fromEnv ? (
                      <input
                        disabled
                        value={`Set via ${f.envVar} environment variable`}
                        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted"
                      />
                    ) : (
                      <input
                        type={f.secret ? "password" : "text"}
                        value={value}
                        placeholder={
                          f.secret && hasSaved ? "•••••••• (saved — type to replace)" : f.placeholder
                        }
                        onChange={(e) => setField(f.key, e.target.value)}
                        className={inputClass}
                      />
                    )}
                  </Field>
                );
              })
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button variant="outline" size="sm" onClick={props.onSaveAndTest} disabled={test.loading}>
                {test.loading ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Testing…
                  </>
                ) : (
                  "Save & test"
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={props.onSyncNow} disabled={props.syncingNow}>
                {props.syncingNow ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Syncing…
                  </>
                ) : (
                  <>
                    <RefreshCw size={13} /> Sync now
                  </>
                )}
              </Button>
              {test.ok === true && (
                <span className="flex items-center gap-1 text-xs text-emerald-400">
                  <CheckCircle2 size={13} /> Reachable
                </span>
              )}
              {test.ok === false && (
                <span className="flex items-center gap-1 text-xs text-rose-400">
                  <XCircle size={13} /> Failed
                </span>
              )}
            </div>
            {test.ok === false && test.error && (
              <p className="whitespace-pre-wrap break-words rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {test.error}
              </p>
            )}

            {status && (
              <p className="text-xs text-muted">
                {status.lastSyncAt
                  ? `Last synced ${relTime(status.lastSyncAt)}${status.lastResult?.ok ? " · up to date" : ""}`
                  : "Not synced yet in this session."}
                {status.lastResult && !status.lastResult.ok && status.lastResult.error && (
                  <span className="text-rose-300"> · {status.lastResult.error}</span>
                )}
              </p>
            )}

            {/* Setup guide */}
            <div className="border-t border-border pt-3">
              <button
                onClick={() => setGuideOpen(!showGuide)}
                className="mb-3 flex items-center gap-1 text-sm font-medium text-accent hover:underline"
              >
                {showGuide ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                Setup guide
              </button>
              {showGuide && <GuideSteps steps={preset.guide} />}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function FirebaseAuthWidget({
  signedIn,
  email,
  onAuth,
  onSignOut,
}: {
  signedIn: boolean;
  email: string | null;
  onAuth: (kind: "signin" | "signup", email: string, password: string) => Promise<string | null>;
  onSignOut: () => Promise<void>;
}) {
  const [formEmail, setFormEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"signin" | "signup" | "signout" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(kind: "signin" | "signup") {
    setBusy(kind);
    setError(null);
    try {
      const err = await onAuth(kind, formEmail, password);
      if (err) setError(err);
      else setPassword("");
    } finally {
      setBusy(null);
    }
  }

  if (signedIn) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1.5 text-sm">
          <CheckCircle2 size={14} className="text-emerald-400" />
          Signed in as <span className="font-medium">{email ?? "your account"}</span>
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy === "signout"}
          onClick={async () => {
            setBusy("signout");
            try {
              await onSignOut();
            } finally {
              setBusy(null);
            }
          }}
        >
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Email">
          <input
            type="email"
            value={formEmail}
            placeholder="you@example.com"
            onChange={(e) => setFormEmail(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            value={password}
            placeholder="At least 6 characters"
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => submit("signin")} disabled={busy !== null}>
          {busy === "signin" ? (
            <>
              <Loader2 size={13} className="animate-spin" /> Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>
        <Button variant="outline" size="sm" onClick={() => submit("signup")} disabled={busy !== null}>
          {busy === "signup" ? (
            <>
              <Loader2 size={13} className="animate-spin" /> Creating…
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </div>
      {error && (
        <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      )}
    </div>
  );
}
