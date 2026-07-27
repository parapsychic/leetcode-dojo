"use client";

// The "Add character" wizard: a modal with three paths — import a zip (with a
// how-to guide), generate a famous character (AI + web search / wiki source),
// or generate an original character from the user's description. Both AI paths
// land in an editor (form tab + raw JSON tab, server-validated) with a
// "preview line" button that speaks one draft-persona line via the existing
// companion mode. Saving installs through /api/companion/characters; nothing
// is written until then. Also used as the editor for existing installed packs.

import { useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  FileArchive,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui";
import { useClaudeStream } from "@/lib/useClaudeStream";
import type { CharacterPack, CannedLine } from "@/lib/companion/pack";
import { cn } from "@/lib/utils";
import { CodeBlock } from "./primitives";

const STANDARD_EXPRESSIONS = ["neutral", "smug", "annoyed", "flustered", "proud", "thinking"];
const EVENT_KEYS = [
  "greeting", "greetingStreak", "greetingMorning", "greetingNight",
  "problemOpen", "solved", "streak", "suboptimal", "incorrect", "incomplete",
  "hintUsed", "quizGood", "quizBad", "idleReturn",
];
const EVENT_LABELS: Record<string, string> = {
  greeting: "Greeting", greetingStreak: "Greeting (streak going)",
  greetingMorning: "Greeting (morning)", greetingNight: "Greeting (late night)",
  problemOpen: "Opening a problem", solved: "Problem solved", streak: "Streak milestone",
  suboptimal: "Verdict: suboptimal", incorrect: "Verdict: incorrect",
  incomplete: "Verdict: incomplete", hintUsed: "Hint used",
  quizGood: "Quiz: good score", quizBad: "Quiz: bad score", idleReturn: "Back after a break",
};

const ZIP_TEMPLATE = `{
  "version": 1,
  "id": "mycharacter",
  "name": "My Character",
  "persona": "You are ... (personality, mannerisms, quirks)",
  "speechStyle": "1-3 short sentences. No emoji.",
  "defaultExpression": "neutral",
  "expressions": ["neutral", "smug", "annoyed", "flustered", "proud", "thinking"],
  "eventLines": {
    "greeting": [{ "expression": "neutral", "text": "Oh, {name}. You're back." }],
    "solved": [{ "expression": "proud", "text": "Nicely done." }],
    "incorrect": [{ "expression": "annoyed", "text": "Wrong. Check your edge cases." }]
  },
  "voice": { "enabled": false, "dir": "voice", "format": "wav" }
}`;

type Step = "path" | "zip" | "famous" | "oc" | "editor";

interface Props {
  /** When set, the wizard opens straight into the editor for this pack. */
  initialPack: CharacterPack | null;
  onClose: () => void;
  /** Fired after a successful install/save (zip or editor). */
  onInstalled: (id: string, refresh: true) => void;
}

// Mounted only while open ({wizardOpen && <CharacterWizard/>}), so every open
// is a fresh instance and state initializes from props — no reset effects.
export function CharacterWizard({ initialPack, onClose, onInstalled }: Props) {
  const editing = Boolean(initialPack); // true = updating an existing pack
  const [step, setStep] = useState<Step>(initialPack ? "editor" : "path");
  const [draft, setDraft] = useState<CharacterPack | null>(initialPack);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Famous / OC inputs
  const [famous, setFamous] = useState({ name: "", source: "", notes: "", paste: "" });
  const [oc, setOc] = useState({ name: "", desc: "" });

  // Editor
  const [tab, setTab] = useState<"form" | "json">("form");
  const [jsonText, setJsonText] = useState("");
  const preview = useClaudeStream();
  const zipRef = useRef<HTMLInputElement>(null);

  const patchDraft = (patch: Partial<CharacterPack>) =>
    setDraft((d) => (d ? { ...d, ...patch } : d));

  const patchLines = (key: string, lines: CannedLine[]) =>
    setDraft((d) => (d ? { ...d, eventLines: { ...d.eventLines, [key]: lines } } : d));

  async function generate(kind: "famous" | "oc") {
    setBusy(true);
    setError(null);
    try {
      const body =
        kind === "famous"
          ? {
              kind,
              characterName: famous.name,
              sourceTitle: famous.source,
              notes: famous.notes || undefined,
              sourceMaterial: famous.paste || undefined,
            }
          : { kind, characterName: oc.name || undefined, ocDescription: oc.desc };
      const res = await fetch("/api/companion/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { pack?: CharacterPack; message?: string };
      if (!res.ok || !data.pack) {
        setError(data.message ?? "Generation failed — try again.");
        return;
      }
      setDraft(data.pack);
      setStep("editor");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function importZip(file: File) {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("pack", file);
      const res = await fetch("/api/companion/import", { method: "POST", body });
      const data = (await res.json()) as {
        ok?: boolean;
        installed?: { id: string };
        message?: string;
      };
      if (!res.ok || !data.ok || !data.installed) {
        setError(data.message ?? "Import failed.");
        return;
      }
      onInstalled(data.installed.id, true);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      if (zipRef.current) zipRef.current.value = "";
    }
  }

  /** Current draft, folding in unsaved JSON-tab edits. Throws on bad JSON. */
  function resolveDraft(): CharacterPack {
    if (tab === "json") return JSON.parse(jsonText) as CharacterPack;
    if (!draft) throw new Error("nothing to save");
    return draft;
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      let pack: CharacterPack;
      try {
        pack = resolveDraft();
      } catch {
        setError("The JSON tab doesn't contain valid JSON.");
        return;
      }
      const res = await fetch("/api/companion/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: editing ? "update" : "create", pack }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        installed?: { id: string };
        message?: string;
      };
      if (!res.ok || !data.ok || !data.installed) {
        setError(data.message ?? "Save failed.");
        return;
      }
      onInstalled(data.installed.id, true);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  function previewLine() {
    const pack = (() => {
      try {
        return resolveDraft();
      } catch {
        setError("The JSON tab doesn't contain valid JSON.");
        return null;
      }
    })();
    if (!pack) return;
    setError(null);
    void preview.run("companion", {
      persona: pack.persona,
      speechStyle: pack.speechStyle,
      expressionList: pack.expressions,
      eventSummary:
        'They just solved a tricky problem after several failed attempts. React in character.',
    });
  }

  const switchTab = (next: "form" | "json") => {
    setError(null);
    if (next === "json" && draft) {
      setJsonText(JSON.stringify(draft, null, 2));
    } else if (next === "form") {
      try {
        setDraft(JSON.parse(jsonText) as CharacterPack);
      } catch {
        setError("Fix the JSON (or switch back after undoing) — it doesn't parse.");
        return;
      }
    }
    setTab(next);
  };

  const back = () => {
    setError(null);
    setStep("path");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          {step !== "path" && !editing && (
            <button onClick={back} className="text-muted hover:text-foreground" aria-label="Back">
              <ArrowLeft size={16} />
            </button>
          )}
          <h2 className="text-sm font-semibold">
            {editing ? `Edit ${draft?.name ?? "character"}` : "Add a character"}
          </h2>
          <button
            onClick={onClose}
            className="ml-auto text-muted hover:text-foreground"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {step === "path" && (
            <div className="grid gap-3 sm:grid-cols-3">
              <PathCard
                icon={<FileArchive size={18} />}
                title="Import a zip"
                blurb="You already have a pack folder (or the guide to make one)."
                onClick={() => setStep("zip")}
              />
              <PathCard
                icon={<Sparkles size={18} />}
                title="Famous character"
                blurb="Name them — the AI builds their persona true to the source."
                onClick={() => setStep("famous")}
              />
              <PathCard
                icon={<Wand2 size={18} />}
                title="Original character"
                blurb="Describe your own character; the AI drafts the full pack."
                onClick={() => setStep("oc")}
              />
            </div>
          )}

          {step === "zip" && (
            <div className="space-y-4 text-sm">
              <p className="text-muted">
                A pack is a folder zipped up. Only <code>character.json</code> is required — sprites
                can be added later.
              </p>
              <CodeBlock
                filename="mycharacter.zip contents"
                content={`mycharacter/
├── character.json          (required — see template below)
├── sprites/                (optional PNGs, transparent, same canvas)
│   ├── neutral.png         (base face; also: smug, annoyed, flustered, proud, thinking)
│   ├── neutral_eyes-closed.png   (blink variant, per expression)
│   ├── neutral_mouth-open.png    (talk variant, per expression)
│   └── chibi.png           (small full-body for the minimized corner)
└── voice/                  (leave empty — future voice cache)`}
              />
              <CodeBlock filename="character.json (minimal template)" content={ZIP_TEMPLATE} />
              <input
                ref={zipRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importZip(f);
                }}
              />
              <Button onClick={() => zipRef.current?.click()} disabled={busy}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                <span className="ml-1.5">{busy ? "Installing…" : "Choose zip…"}</span>
              </Button>
            </div>
          )}

          {step === "famous" && (
            <div className="space-y-3">
              <Field label="Character name (required)">
                <input
                  className={inputCls}
                  value={famous.name}
                  onChange={(e) => setFamous({ ...famous, name: e.target.value })}
                  placeholder="Makise Kurisu"
                />
              </Field>
              <Field label="From (required)">
                <input
                  className={inputCls}
                  value={famous.source}
                  onChange={(e) => setFamous({ ...famous, source: e.target.value })}
                  placeholder="Steins;Gate"
                />
              </Field>
              <Field label="Notes for the AI (optional)">
                <input
                  className={inputCls}
                  value={famous.notes}
                  onChange={(e) => setFamous({ ...famous, notes: e.target.value })}
                  placeholder="Lean into the tsundere side; she calls me 'assistant'"
                />
              </Field>
              <Field label="Paste source material (optional — wiki excerpts, quotes; used as the authority for obscure characters)">
                <textarea
                  className={cn(inputCls, "h-28 resize-y font-mono text-xs")}
                  value={famous.paste}
                  onChange={(e) => setFamous({ ...famous, paste: e.target.value })}
                />
              </Field>
              <p className="text-xs text-muted">
                Uses your configured AI (Claude first — it can search the web for canon details).
                Generation takes a moment; you can edit everything before saving.
              </p>
              <Button onClick={() => void generate("famous")} disabled={busy || !famous.name.trim() || !famous.source.trim()}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                <span className="ml-1.5">{busy ? "Generating…" : "Generate character"}</span>
              </Button>
            </div>
          )}

          {step === "oc" && (
            <div className="space-y-3">
              <Field label="Name (optional — the AI can pick one)">
                <input
                  className={inputCls}
                  value={oc.name}
                  onChange={(e) => setOc({ ...oc, name: e.target.value })}
                />
              </Field>
              <Field label="Describe your character (personality, speech quirks, likes/dislikes, how they'd react to your wins and mistakes)">
                <textarea
                  className={cn(inputCls, "h-40 resize-y")}
                  value={oc.desc}
                  onChange={(e) => setOc({ ...oc, desc: e.target.value })}
                  placeholder="A sleepy dragon librarian who hoards algorithms instead of gold. Speaks in short, dry sentences…"
                />
              </Field>
              <Button onClick={() => void generate("oc")} disabled={busy || !oc.desc.trim()}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                <span className="ml-1.5">{busy ? "Generating…" : "Generate character"}</span>
              </Button>
            </div>
          )}

          {step === "editor" && draft && (
            <div className="space-y-4">
              <div className="flex gap-1 rounded-lg border border-border bg-background p-1 text-xs">
                {(["form", "json"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => switchTab(t)}
                    className={cn(
                      "rounded-md px-3 py-1",
                      tab === t ? "bg-accent/20 font-medium text-accent" : "text-muted hover:text-foreground",
                    )}
                  >
                    {t === "form" ? "Form" : "Raw JSON"}
                  </button>
                ))}
              </div>

              {tab === "form" ? (
                <EditorForm draft={draft} editing={editing} patchDraft={patchDraft} patchLines={patchLines} />
              ) : (
                <textarea
                  className={cn(inputCls, "h-80 resize-y font-mono text-xs")}
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  spellCheck={false}
                />
              )}

              {(preview.text || preview.loading) && (
                <div className="rounded-lg border border-accent/30 bg-background p-3 text-sm">
                  <div className="mb-1 text-xs font-medium text-accent">Preview</div>
                  {preview.text || <Loader2 size={13} className="animate-spin text-muted" />}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {(step === "editor" || error) && (
          <div className="flex items-center gap-2 border-t border-border px-5 py-3">
            {error && <span className="min-w-0 flex-1 truncate text-xs text-rose-400">{error}</span>}
            {step === "editor" && (
              <>
                {!error && <span className="flex-1" />}
                <Button variant="outline" size="sm" onClick={previewLine} disabled={preview.loading}>
                  {preview.loading ? <Loader2 size={13} className="animate-spin" /> : "Preview line"}
                </Button>
                <Button size="sm" onClick={() => void save()} disabled={busy}>
                  {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  <span className="ml-1">{editing ? "Save changes" : "Save & install"}</span>
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent/50";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}

function PathCard({
  icon,
  title,
  blurb,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  blurb: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-border bg-background p-4 text-left transition-colors hover:border-accent hover:bg-accent/10"
    >
      <div className="mb-2 text-accent">{icon}</div>
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-1 text-xs leading-snug text-muted">{blurb}</div>
    </button>
  );
}

function EditorForm({
  draft,
  editing,
  patchDraft,
  patchLines,
}: {
  draft: CharacterPack;
  editing: boolean;
  patchDraft: (p: Partial<CharacterPack>) => void;
  patchLines: (key: string, lines: CannedLine[]) => void;
}) {
  // Canonical keys first, then any extras the pack carries.
  const keys = [
    ...EVENT_KEYS.filter((k) => draft.eventLines[k]),
    ...Object.keys(draft.eventLines).filter((k) => !EVENT_KEYS.includes(k)),
  ];
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <input
            className={inputCls}
            value={draft.name}
            onChange={(e) => patchDraft({ name: e.target.value })}
          />
        </Field>
        <Field label={editing ? "Id (fixed while editing)" : "Id (folder name)"}>
          <input
            className={cn(inputCls, "font-mono text-xs")}
            value={draft.id}
            disabled={editing}
            onChange={(e) =>
              patchDraft({ id: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, "") })
            }
          />
        </Field>
      </div>
      <Field label="Persona (who they are — fed to the AI for every line)">
        <textarea
          className={cn(inputCls, "h-28 resize-y")}
          value={draft.persona}
          onChange={(e) => patchDraft({ persona: e.target.value })}
        />
      </Field>
      <Field label="Speech style">
        <textarea
          className={cn(inputCls, "h-16 resize-y")}
          value={draft.speechStyle}
          onChange={(e) => patchDraft({ speechStyle: e.target.value })}
        />
      </Field>
      <Field label="Default expression">
        <select
          className={inputCls}
          value={draft.defaultExpression}
          onChange={(e) => patchDraft({ defaultExpression: e.target.value })}
        >
          {(draft.expressions.length ? draft.expressions : STANDARD_EXPRESSIONS).map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
      </Field>

      <div className="text-xs font-medium text-muted">
        Canned lines (slots: {"{name} {title} {score} {streak}"})
      </div>
      {keys.map((key) => {
        const lines = draft.eventLines[key] ?? [];
        return (
          <details key={key} className="rounded-lg border border-border bg-background">
            <summary className="cursor-pointer px-3 py-2 text-xs font-medium">
              {EVENT_LABELS[key] ?? key}
              <span className="ml-2 text-muted">({lines.length})</span>
            </summary>
            <div className="space-y-2 px-3 pb-3">
              {lines.map((line, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <select
                    className="rounded-md border border-border bg-card px-1.5 py-1 text-xs"
                    value={line.expression}
                    onChange={(e) => {
                      const next = [...lines];
                      next[i] = { ...line, expression: e.target.value };
                      patchLines(key, next);
                    }}
                  >
                    {(draft.expressions.length ? draft.expressions : STANDARD_EXPRESSIONS).map(
                      (x) => (
                        <option key={x} value={x}>
                          {x}
                        </option>
                      ),
                    )}
                  </select>
                  <input
                    className="min-w-0 flex-1 rounded-md border border-border bg-card px-2 py-1 text-xs"
                    value={line.text}
                    onChange={(e) => {
                      const next = [...lines];
                      next[i] = { ...line, text: e.target.value };
                      patchLines(key, next);
                    }}
                  />
                  <button
                    onClick={() => patchLines(key, lines.filter((_, j) => j !== i))}
                    className="text-muted hover:text-rose-400"
                    aria-label="Remove line"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <button
                onClick={() =>
                  patchLines(key, [
                    ...lines,
                    { expression: draft.defaultExpression, text: "" },
                  ])
                }
                className="flex items-center gap-1 text-xs text-accent hover:underline"
              >
                <Plus size={12} /> Add line
              </button>
            </div>
          </details>
        );
      })}
    </div>
  );
}
