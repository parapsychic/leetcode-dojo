"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, RefreshCw, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ModelOption {
  id: string;
  name?: string;
  free?: boolean;
  vision?: boolean;
  contextLength?: number;
  recommended?: boolean;
}

interface Props {
  value: string;
  onChange: (id: string) => void;
  // Called when a model with known vision capability is picked, so the parent can
  // auto-set its "supports images" flag. undefined = unknown (don't change it).
  onVision?: (vision: boolean | undefined) => void;
  models: ModelOption[];
  loading?: boolean;
  error?: string;
  onRefresh?: () => void;
  placeholder?: string;
}

function humanCtx(n?: number): string | null {
  if (!n) return null;
  if (n >= 1_000_000) return `${Math.round(n / 1_000_000)}M ctx`;
  if (n >= 1000) return `${Math.round(n / 1000)}K ctx`;
  return `${n} ctx`;
}

function Tag({ tone, children }: { tone: "free" | "paid" | "vision" | "ctx"; children: React.ReactNode }) {
  const cls = {
    free: "bg-emerald-400/10 text-emerald-300",
    paid: "bg-amber-400/10 text-amber-300",
    vision: "bg-sky-400/10 text-sky-300",
    ctx: "bg-card text-muted",
  }[tone];
  return <span className={cn("rounded px-1.5 py-0.5 text-[10px]", cls)}>{children}</span>;
}

export function ModelCombobox({
  value,
  onChange,
  onVision,
  models,
  loading,
  error,
  onRefresh,
  placeholder,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Sync the field when the parent changes the value externally (React's
  // "adjust state during render" pattern — no effect, no cascading render).
  if (value !== prevValue) {
    setPrevValue(value);
    setQuery(value);
  }

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const q = query.trim().toLowerCase();
  // Filter whenever the field holds a search string rather than a committed model
  // id. (Typing keeps `value` in sync so custom slugs persist, so we can't compare
  // query vs value — instead we check whether the text is an exact model id.)
  const isCommittedSelection = models.some((m) => m.id === query);
  const searching = q.length > 0 && !isCommittedSelection;
  const filtered = searching
    ? models.filter(
        (m) =>
          m.id.toLowerCase().includes(q) || m.name?.toLowerCase().includes(q),
      )
    : models;
  const rec = filtered.filter((m) => m.recommended);
  const rest = filtered.filter((m) => !m.recommended);

  function select(m: ModelOption) {
    setQuery(m.id);
    onChange(m.id);
    if (typeof m.vision === "boolean") onVision?.(m.vision);
    setOpen(false);
  }

  function renderRow(m: ModelOption) {
    return (
      <button
        key={m.id}
        type="button"
        onClick={() => select(m)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent/10"
      >
        <span className="min-w-0 flex-1 truncate">
          {m.name && m.name !== m.id ? (
            <>
              <span className="truncate">{m.name}</span>{" "}
              <span className="text-[11px] text-muted">{m.id}</span>
            </>
          ) : (
            m.id
          )}
        </span>
        {m.free === true && <Tag tone="free">Free</Tag>}
        {m.free === false && <Tag tone="paid">Paid</Tag>}
        {m.vision && <Tag tone="vision">Vision</Tag>}
        {humanCtx(m.contextLength) && <Tag tone="ctx">{humanCtx(m.contextLength)}</Tag>}
        {m.id === value && <Check size={14} className="text-accent" />}
      </button>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <input
            value={query}
            placeholder={placeholder ?? "Search or type a model id"}
            onChange={(e) => {
              setQuery(e.target.value);
              onChange(e.target.value); // typed value is kept (custom models)
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 pr-8 text-sm outline-none focus:border-accent/50"
          />
          <button
            type="button"
            aria-label="Toggle model list"
            onClick={() => setOpen((o) => !o)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />}
          </button>
        </div>
        {onRefresh && (
          <button
            type="button"
            aria-label="Reload models"
            title="Reload model list"
            onClick={onRefresh}
            className="rounded-md border border-border p-2 text-muted hover:text-foreground"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-background shadow-xl">
          {loading && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted">
              <Loader2 size={13} className="animate-spin" /> Loading models…
            </div>
          )}
          {!loading && error && (
            <div className="px-3 py-2 text-xs text-amber-300">{error} You can still type a model id.</div>
          )}
          {!loading && rec.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-muted">
                Recommended
              </div>
              {rec.map(renderRow)}
            </>
          )}
          {!loading && rest.length > 0 && (
            <>
              {rec.length > 0 && (
                <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-muted">
                  All models{searching ? "" : ` (${rest.length})`}
                </div>
              )}
              {rest.map(renderRow)}
            </>
          )}
          {!loading && !error && rec.length === 0 && rest.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted">No matching models.</div>
          )}
        </div>
      )}
    </div>
  );
}
