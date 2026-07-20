"use client";

// Companion-character settings: enable toggle, chattiness, and an optional
// dedicated provider/model so banter runs on a free tier (e.g. Gemini
// Flash-Lite) instead of the tutoring provider. Form state lives in
// SettingsView so the sticky Save bar persists it with everything else.

import { ModelCombobox } from "@/components/ModelCombobox";
import { cn } from "@/lib/utils";
import type { ModelListState } from "./ProvidersSection";
import { SettingRow } from "./primitives";
import type { SearchMatch } from "./searchIndex";
import type { ProviderRow } from "./types";

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
        rowId="companion:chattiness"
        label="Chattiness"
        description="How often she speaks up on her own. Replies to you are always answered."
        match={match}
        query={query}
      >
        <div className="grid max-w-lg gap-2 sm:grid-cols-3">
          {CHATTINESS_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => onForm({ chattiness: opt.id })}
              className={cn(
                "rounded-lg border px-3 py-2 text-left transition-colors",
                form.chattiness === opt.id
                  ? "border-accent/60 bg-accent/10"
                  : "border-border bg-card hover:border-accent/30",
              )}
            >
              <div className="text-sm font-medium">{opt.label}</div>
              <div className="mt-0.5 text-[11px] leading-snug text-muted">{opt.blurb}</div>
            </button>
          ))}
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
