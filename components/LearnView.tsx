"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Eye, Brain, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui";
import { Markdown } from "@/components/Markdown";
import { Quiz } from "@/components/Quiz";
import { VizPlayer } from "@/components/viz/VizPlayer";
import { useClaudeStream, fetchClaudeJson } from "@/lib/useClaudeStream";
import type { VizSpec } from "@/lib/claude/schemas";
import { cn } from "@/lib/utils";

type Tab = "explain" | "visualize" | "quiz";

export function LearnView({ topic }: { topic: string }) {
  const [tab, setTab] = useState<Tab>("explain");

  // Explain
  const explain = useClaudeStream();
  const [focus, setFocus] = useState("");
  const [explainStarted, setExplainStarted] = useState(false);

  // Visualize
  const [viz, setViz] = useState<VizSpec | null>(null);
  const [vizLoading, setVizLoading] = useState(false);
  const [vizError, setVizError] = useState<string | null>(null);
  const [vizQuery, setVizQuery] = useState("");

  useEffect(() => {
    explain.run("explain", { topic });
    setExplainStarted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic]);

  async function runExplain() {
    explain.run("explain", { topic, userMessage: focus || undefined });
  }

  async function runViz() {
    setVizLoading(true);
    setVizError(null);
    setViz(null);
    const { data, error } = await fetchClaudeJson<VizSpec>("visualize", {
      topic,
      userMessage: vizQuery || `a representative ${topic} algorithm`,
    });
    if (error) setVizError(error);
    else setViz(data ?? null);
    setVizLoading(false);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-5 flex items-center gap-3">
        <Link href="/learn" className="text-muted hover:text-foreground">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-2xl font-semibold">{topic}</h1>
      </div>

      <div className="mb-5 flex gap-1 border-b border-border text-sm">
        {([
          ["explain", "Explain", BookOpen],
          ["visualize", "Visualize", Eye],
          ["quiz", "Quiz", Brain],
        ] as const).map(([k, label, Icon]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2",
              tab === k ? "border-b-2 border-accent text-accent" : "text-muted hover:text-foreground",
            )}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === "explain" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runExplain()}
              placeholder={`Focus on something specific in ${topic}… (optional)`}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent/50"
            />
            <Button variant="outline" onClick={runExplain} disabled={explain.loading}>
              {explain.loading ? <Loader2 size={14} className="animate-spin" /> : <BookOpen size={14} />}
              Explain
            </Button>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            {explain.text ? (
              <Markdown>{explain.text}</Markdown>
            ) : explainStarted && explain.loading ? (
              <div className="flex items-center gap-2 text-sm text-muted">
                <Loader2 size={14} className="animate-spin" /> Thinking…
              </div>
            ) : (
              <p className="text-sm text-muted">Press Explain to begin.</p>
            )}
            {explain.error && <p className="mt-2 text-xs text-rose-400">{explain.error}</p>}
          </div>
        </div>
      )}

      {tab === "visualize" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              value={vizQuery}
              onChange={(e) => setVizQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runViz()}
              placeholder={`What should we visualize? e.g. "binary search on a sorted array"`}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent/50"
            />
            <Button onClick={runViz} disabled={vizLoading}>
              {vizLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Visualize
            </Button>
          </div>
          {vizLoading && (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-6 text-sm text-muted">
              <Loader2 size={15} className="animate-spin" /> Building the animation…
            </div>
          )}
          {vizError && (
            <div className="rounded-xl border border-rose-400/30 bg-rose-400/5 p-4 text-sm text-rose-300">
              {vizError} — try rephrasing or pick a simpler example.
            </div>
          )}
          {viz && <VizPlayer spec={viz} />}
          {!viz && !vizLoading && !vizError && (
            <p className="text-sm text-muted">
              Describe an algorithm or data-structure operation and watch it run
              step by step.
            </p>
          )}
        </div>
      )}

      {tab === "quiz" && <Quiz topic={topic} />}
    </div>
  );
}
