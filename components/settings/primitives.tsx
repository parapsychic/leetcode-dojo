"use client";

// Small shared pieces for the settings UI: search box, section nav, section
// and row wrappers with search filtering + highlighting, copy-able code
// blocks, and numbered guide steps.

import { useState } from "react";
import { Check, Copy, ExternalLink, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GuideStep } from "@/lib/sync/presets";
import { SECTIONS, type SearchMatch, type SectionId } from "./searchIndex";

// ---- Search box ----

export function SettingsSearch({
  query,
  onChange,
}: {
  query: string;
  onChange: (q: string) => void;
}) {
  return (
    <div className="relative">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input
        value={query}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onChange("");
        }}
        placeholder="Search settings"
        className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-9 text-sm outline-none focus:border-accent/50"
      />
      {query && (
        <button
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-foreground"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

// ---- Section nav (left sidebar) ----

export function SettingsNav({
  active,
  match,
  onSelect,
}: {
  active: SectionId;
  match: SearchMatch | null;
  onSelect: (id: SectionId) => void;
}) {
  return (
    <nav className="w-44 shrink-0">
      <ul className="sticky top-20 space-y-0.5">
        {SECTIONS.map((s) => {
          const count = match ? match.countsBySection[s.id] : null;
          const isActive = !match && active === s.id;
          return (
            <li key={s.id}>
              <button
                onClick={() => onSelect(s.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-sm transition-colors",
                  isActive
                    ? "bg-accent/15 text-accent"
                    : "text-muted hover:bg-card hover:text-foreground",
                  count === 0 && "opacity-40",
                )}
              >
                <span>{s.title}</span>
                {count !== null && count > 0 && (
                  <span className="rounded-full bg-card px-1.5 text-[10px] text-muted">{count}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ---- Section / row wrappers ----

export function SettingsSection({
  id,
  title,
  blurb,
  match,
  active,
  children,
}: {
  id: SectionId;
  title: string;
  blurb?: string;
  match: SearchMatch | null;
  active: SectionId;
  children: React.ReactNode;
}) {
  // No query: only the active section renders. With a query: only sections
  // that contain matches render.
  if (!match && active !== id) return null;
  if (match && match.countsBySection[id] === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      {blurb && <p className="mt-1 mb-4 text-sm text-muted">{blurb}</p>}
      {!blurb && <div className="mb-4" />}
      {children}
    </section>
  );
}

/** Highlight query tokens inside a label. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return <>{text}</>;
  // Highlight the first token that appears in the text (simple + predictable).
  const lower = text.toLowerCase();
  for (const t of tokens) {
    const i = lower.indexOf(t);
    if (i !== -1) {
      return (
        <>
          {text.slice(0, i)}
          <mark className="rounded bg-accent/25 px-0.5 text-foreground">
            {text.slice(i, i + t.length)}
          </mark>
          {text.slice(i + t.length)}
        </>
      );
    }
  }
  return <>{text}</>;
}

export function SettingRow({
  rowId,
  label,
  description,
  match,
  query,
  children,
}: {
  rowId: string;
  label: string;
  description?: string;
  match: SearchMatch | null;
  query: string;
  children?: React.ReactNode;
}) {
  if (match && !match.rowIds.has(rowId)) return null;
  return (
    <div className="py-3">
      <div className="mb-1 text-sm font-medium">
        <Highlight text={label} query={match ? query : ""} />
      </div>
      {description && <p className="mb-2 text-xs text-muted">{description}</p>}
      {children}
    </div>
  );
}

// ---- Field label (moved from the old SettingsView) ----

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}

export const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent/50";

// ---- Copy button + code block + guide steps ----

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      aria-label="Copy to clipboard"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-muted hover:text-foreground"
    >
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function CodeBlock({
  content,
  filename,
}: {
  content: string;
  filename?: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="font-mono text-[11px] text-muted">{filename ?? "shell"}</span>
        <CopyButton text={content} />
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed">
        <code>{content}</code>
      </pre>
    </div>
  );
}

export function GuideSteps({ steps }: { steps: GuideStep[] }) {
  return (
    <ol className="space-y-4">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/15 text-[11px] font-medium text-accent">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="text-sm font-medium">{step.title}</div>
            {step.body && <p className="text-xs leading-relaxed text-muted">{step.body}</p>}
            {step.link && (
              <a
                href={step.link.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
              >
                {step.link.label} <ExternalLink size={11} />
              </a>
            )}
            {step.code && <CodeBlock content={step.code.content} filename={step.code.filename} />}
          </div>
        </li>
      ))}
    </ol>
  );
}
