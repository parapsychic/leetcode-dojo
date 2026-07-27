"use client";

// Companion-character settings: enable toggle, character picker + zip install,
// chattiness, and an optional dedicated provider/model so banter runs on a
// free tier (e.g. Gemini Flash-Lite) instead of the tutoring provider. Form
// state lives in SettingsView so the sticky Save bar persists it with
// everything else; installs/deletes apply immediately (they're server actions,
// not form fields).

import { useEffect, useRef, useState } from "react";
import { Check, ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { ModelCombobox } from "@/components/ModelCombobox";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { CharacterPack, PackManifest } from "@/lib/companion/pack";
import type { ModelListState } from "./ProvidersSection";
import { CharacterWizard } from "./CharacterWizard";
import { CopyButton, SettingRow } from "./primitives";
import type { SearchMatch } from "./searchIndex";
import type { ProviderRow } from "./types";

interface CharacterSummary {
  id: string;
  name: string;
  source: "installed" | "bundled";
  thumb: string | null;
  error?: string;
}

interface CharactersResponse {
  characters: CharacterSummary[];
  dir: string;
  activeId: string;
}

export interface CompanionFormState {
  enabled: boolean;
  chattiness: "quiet" | "normal" | "chatty";
  characterId: string;
  provider: string | null;
  model: string | null;
}

const CHATTINESS_OPTIONS: {
  id: CompanionFormState["chattiness"];
  label: string;
  blurb: string;
}[] = [
  { id: "quiet", label: "Quiet", blurb: "Rare check-ins, big moments only." },
  { id: "normal", label: "Normal", blurb: "Reacts to solves, verdicts, streaks." },
  { id: "chatty", label: "Chatty", blurb: "Frequent banter and commentary." },
];

interface Props {
  form: CompanionFormState;
  providers: ProviderRow[];
  modelList: ModelListState | null;
  match: SearchMatch | null;
  query: string;
  onForm: (patch: Partial<CompanionFormState>) => void;
  onLoadModels: (providerId: string, fresh?: boolean) => void;
}

export function CompanionSection({
  form,
  providers,
  modelList,
  match,
  query,
  onForm,
  onLoadModels,
}: Props) {
  // Only OpenAI-compatible providers with a key make sense as a banter override
  // (claude is already the default chain head).
  const overrideChoices = providers.filter((p) => !p.isClaude && p.configured);

  // ---- Character roster (picker, wizard, sprites, delete) ----
  const [roster, setRoster] = useState<CharactersResponse | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardPack, setWizardPack] = useState<CharacterPack | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  // One hidden multi-file input shared by every row's "Add sprites" button.
  const spriteInputRef = useRef<HTMLInputElement>(null);
  const spriteTargetRef = useRef<string | null>(null);

  function refreshRoster() {
    fetch("/api/companion/characters")
      .then((r) => r.json())
      .then((d: CharactersResponse) => setRoster(d))
      .catch(() => {
        // keep the stale roster
      });
  }

  useEffect(() => {
    refreshRoster();
  }, []);

  function handleInstalled(id: string) {
    refreshRoster();
    onForm({ characterId: id }); // select it; the Save bar persists
    setNote({ ok: true, text: "Installed — hit Save settings to switch to them." });
  }

  async function openEditor(id: string) {
    setNote(null);
    try {
      const res = await fetch(`/api/companion/pack?id=${encodeURIComponent(id)}`);
      const data = (await res.json()) as { manifest?: PackManifest };
      if (!data.manifest) {
        setNote({ ok: false, text: "Couldn't load that pack." });
        return;
      }
      setWizardPack(data.manifest.pack);
      setWizardOpen(true);
    } catch {
      setNote({ ok: false, text: "Couldn't load that pack." });
    }
  }

  async function uploadSprites(files: FileList) {
    const id = spriteTargetRef.current;
    if (!id) return;
    setNote(null);
    const body = new FormData();
    body.append("id", id);
    for (const f of Array.from(files)) body.append("sprites", f);
    try {
      const res = await fetch("/api/companion/sprites", { method: "POST", body });
      const data = (await res.json()) as { ok?: boolean; wrote?: string[]; message?: string };
      if (!res.ok || !data.ok) {
        setNote({ ok: false, text: data.message ?? "Sprite upload failed." });
        return;
      }
      setNote({ ok: true, text: `Added ${data.wrote?.length ?? 0} sprite(s) to ${id}.` });
      void refreshRoster();
    } catch (err) {
      setNote({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      if (spriteInputRef.current) spriteInputRef.current.value = "";
    }
  }

  async function deletePack(id: string) {
    if (!window.confirm(`Delete the installed character "${id}"? This removes its files.`)) return;
    try {
      const res = await fetch("/api/companion/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        characters?: CharacterSummary[];
        activeId?: string;
      };
      if (data.ok) {
        setRoster((r) => (r ? { ...r, characters: data.characters ?? [] } : r));
        if (data.activeId && data.activeId !== form.characterId) {
          onForm({ characterId: data.activeId });
        }
      }
    } catch {
      // roster stays as-is
    }
  }

  const characters = roster?.characters ?? [];
  const installed = characters.filter((c) => c.source === "installed");

  return (
    <div>
      <SettingRow
        rowId="companion:enable"
        label="Enable companion"
        description="A character (Makise Kurisu by default) sits at the bottom of the screen — greeting you, reacting to solves and mistakes, and chatting back when you reply. She never reveals solutions."
        match={match}
        query={query}
      >
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => onForm({ enabled: e.target.checked })}
          />
          Show the companion on every page
        </label>
      </SettingRow>

      <SettingRow
        rowId="companion:character"
        label="Character"
        description="Who keeps you company. Installed packs shadow bundled ones with the same id."
        match={match}
        query={query}
      >
        <div className="flex max-w-lg items-center gap-3">
          {(() => {
            const active = characters.find((c) => c.id === form.characterId);
            return active?.thumb ? (
              // eslint-disable-next-line @next/next/no-img-element -- local pack sprite
              <img
                src={active.thumb}
                alt=""
                className="h-12 w-12 rounded-lg border border-border bg-card object-contain object-bottom"
              />
            ) : null;
          })()}
          <select
            value={form.characterId}
            onChange={(e) => onForm({ characterId: e.target.value })}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent/50"
          >
            {characters.length === 0 && <option value={form.characterId}>{form.characterId}</option>}
            {characters.map((c) => (
              <option key={c.id} value={c.id} disabled={Boolean(c.error)}>
                {c.name}
                {c.source === "installed" ? " (installed)" : ""}
                {c.error ? " — invalid pack" : ""}
              </option>
            ))}
          </select>
        </div>
      </SettingRow>

      <SettingRow
        rowId="companion:install"
        label="Characters"
        description="Add characters by zip, or let the AI generate one — a famous character (true to their source) or an original of your own design. Everything is editable before and after install."
        match={match}
        query={query}
      >
        <div className="flex max-w-lg flex-col gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setWizardPack(null);
                setWizardOpen(true);
              }}
            >
              <Plus size={14} />
              <span className="ml-1">Add character</span>
            </Button>
            {note && (
              <span className={cn("text-xs", note.ok ? "text-emerald-400" : "text-rose-400")}>
                {note.text}
              </span>
            )}
          </div>

          <input
            ref={spriteInputRef}
            type="file"
            accept=".png"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void uploadSprites(e.target.files);
            }}
          />

          {installed.length > 0 && (
            <ul className="space-y-1">
              {installed.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm"
                >
                  {c.thumb && (
                    // eslint-disable-next-line @next/next/no-img-element -- local pack sprite
                    <img src={c.thumb} alt="" className="h-8 w-8 object-contain object-bottom" />
                  )}
                  <span className="min-w-0 flex-1 truncate">
                    {c.name}
                    {c.error && <span className="ml-2 text-xs text-rose-400">invalid: {c.error}</span>}
                  </span>
                  <button
                    onClick={() => void openEditor(c.id)}
                    aria-label={`Edit ${c.name}`}
                    title="Edit character"
                    className="text-muted hover:text-accent"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => {
                      spriteTargetRef.current = c.id;
                      spriteInputRef.current?.click();
                    }}
                    aria-label={`Add sprites to ${c.name}`}
                    title="Add sprite PNGs"
                    className="text-muted hover:text-accent"
                  >
                    <ImagePlus size={14} />
                  </button>
                  <button
                    onClick={() => void deletePack(c.id)}
                    aria-label={`Delete ${c.name}`}
                    title="Delete"
                    className="text-muted hover:text-rose-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {roster?.dir && (
            <div className="flex items-center gap-2 text-xs text-muted">
              <span className="shrink-0">Or copy a pack folder into:</span>
              <code className="min-w-0 truncate rounded bg-background px-1.5 py-0.5">{roster.dir}</code>
              <CopyButton text={roster.dir} />
            </div>
          )}
        </div>
      </SettingRow>

      {wizardOpen && (
        <CharacterWizard
          initialPack={wizardPack}
          onClose={() => setWizardOpen(false)}
          onInstalled={handleInstalled}
        />
      )}

      <SettingRow
        rowId="companion:chattiness"
        label="Chattiness"
        description="How often she speaks up on her own. Replies to you are always answered."
        match={match}
        query={query}
      >
        <div className="grid max-w-lg gap-2 sm:grid-cols-3">
          {CHATTINESS_OPTIONS.map((opt) => {
            const selected = form.chattiness === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => onForm({ chattiness: opt.id })}
                aria-pressed={selected}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left transition-colors",
                  selected
                    ? "border-accent bg-accent/20 ring-1 ring-accent"
                    : "border-border bg-card opacity-75 hover:border-accent/30 hover:opacity-100",
                )}
              >
                <div className={cn("flex items-center gap-1.5 text-sm font-medium", selected && "text-accent")}>
                  {selected && <Check size={13} />}
                  {opt.label}
                </div>
                <div className="mt-0.5 text-[11px] leading-snug text-muted">{opt.blurb}</div>
              </button>
            );
          })}
        </div>
      </SettingRow>

      <SettingRow
        rowId="companion:model"
        label="Companion model"
        description="Optional: run her banter on a dedicated provider so it never spends your tutoring budget. A generous free tier like Gemini Flash-Lite is ideal — configure the provider under AI Providers first, then pick it here."
        match={match}
        query={query}
      >
        <div className="flex max-w-lg flex-col gap-2">
          <select
            value={form.provider ?? ""}
            onChange={(e) => {
              const provider = e.target.value || null;
              onForm({ provider, model: null });
              if (provider) onLoadModels(provider);
            }}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent/50"
          >
            <option value="">Default (main provider chain)</option>
            {overrideChoices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          {form.provider && (
            <ModelCombobox
              value={form.model ?? ""}
              onChange={(id) => onForm({ model: id })}
              models={modelList?.models ?? []}
              loading={modelList?.loading}
              error={modelList?.error}
              onRefresh={() => onLoadModels(form.provider!, true)}
              placeholder="Model for banter (blank = provider's light model)"
            />
          )}
          {overrideChoices.length === 0 && (
            <p className="text-xs text-muted">
              No fallback provider is configured yet — add one (with an API key) in the AI
              Providers section to enable this.
            </p>
          )}
        </div>
      </SettingRow>
    </div>
  );
}
