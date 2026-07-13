"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Sparkles,
  Loader2,
  FileText,
  ExternalLink,
  Lightbulb,
  Brain,
  Compass,
} from "lucide-react";
import { Button, Card, Badge } from "@/components/ui";
import { Quiz } from "@/components/Quiz";
import { QuizRunner } from "@/components/QuizRunner";
import { fetchClaudeJson } from "@/lib/useClaudeStream";
import type { DailyDigest } from "@/lib/claude/schemas";

// Local-time YYYY-MM-DD — the cache key that makes the digest refresh once a day.
function todayKey(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function prettyDate(key: string): string {
  const d = new Date(`${key}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function DiscoverView() {
  const [date] = useState(todayKey);
  const [digest, setDigest] = useState<DailyDigest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Which "explore" topic the learner has opened a quiz for.
  const [openTopic, setOpenTopic] = useState<string | null>(null);
  const [showPaperQuiz, setShowPaperQuiz] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await fetchClaudeJson<DailyDigest>("daily", { date });
    if (error) setError(error);
    else setDigest(data ?? null);
    setLoading(false);
  }, [date]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-1 flex items-center gap-2">
        <Compass className="text-accent" />
        <h1 className="text-2xl font-semibold">Discover</h1>
      </div>
      <p className="mb-6 text-sm text-muted">
        A fresh computer-science paper and new topics to explore — refreshed once
        a day. <span className="text-foreground/70">{prettyDate(date)}</span>
      </p>

      {loading && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-6 text-sm text-muted">
          <Loader2 size={15} className="animate-spin" /> Curating today’s read…
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl border border-rose-400/30 bg-rose-400/5 p-4 text-sm text-rose-300">
          {error}
          <div className="mt-3">
            <Button variant="outline" onClick={load}>
              <Sparkles size={14} /> Try again
            </Button>
          </div>
        </div>
      )}

      {digest && !loading && (
        <div className="space-y-8">
          {/* ---- Paper of the day ---- */}
          <section>
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted">
              <FileText size={15} className="text-accent" /> Paper of the day
            </div>
            <Card className="p-5">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {digest.paper.field && <Badge>{digest.paper.field}</Badge>}
                {digest.paper.year && <Badge>{String(digest.paper.year)}</Badge>}
                {digest.paper.venue && <Badge>{digest.paper.venue}</Badge>}
              </div>
              <h2 className="text-lg font-semibold leading-snug">
                {digest.paper.title}
              </h2>
              <p className="mt-1 text-xs text-muted">{digest.paper.authors}</p>

              <p className="mt-4 text-sm leading-relaxed">{digest.paper.summary}</p>

              <div className="mt-4 rounded-lg border border-accent/20 bg-accent/5 p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-accent">
                  <Lightbulb size={13} /> Why read it
                </div>
                <p className="mt-1 text-sm text-foreground/80">
                  {digest.paper.whyRead}
                </p>
              </div>

              <div className="mt-4">
                <div className="mb-1.5 text-xs font-medium text-muted">
                  Key ideas
                </div>
                <ul className="list-disc space-y-1 pl-5 text-sm text-foreground/85">
                  {digest.paper.keyIdeas.map((idea, i) => (
                    <li key={i}>{idea}</li>
                  ))}
                </ul>
              </div>

              {digest.paper.url && (
                <a
                  href={digest.paper.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
                >
                  <ExternalLink size={14} /> Read the paper
                </a>
              )}
            </Card>

            {/* Quiz on the paper */}
            <div className="mt-4">
              {!showPaperQuiz ? (
                <Button onClick={() => setShowPaperQuiz(true)}>
                  <Brain size={15} /> Quiz me on this paper
                </Button>
              ) : (
                <>
                  <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-muted">
                    <Brain size={15} className="text-accent" /> Quiz: did it stick?
                  </div>
                  <QuizRunner
                    quiz={digest.paperQuiz}
                    progressTopic={`Paper: ${digest.paper.title}`}
                  />
                </>
              )}
            </div>
          </section>

          {/* ---- Topics to explore ---- */}
          <section>
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted">
              <Compass size={15} className="text-accent" /> Topics to explore
            </div>
            <div className="space-y-3">
              {digest.topics.map((t) => {
                const open = openTopic === t.name;
                return (
                  <Card key={t.name} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{t.name}</div>
                        <div className="mt-0.5 text-sm text-muted">{t.blurb}</div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => setOpenTopic(open ? null : t.name)}
                      >
                        <Brain size={14} /> {open ? "Hide quiz" : "Quiz me"}
                      </Button>
                    </div>
                    {open && (
                      <div className="mt-4 border-t border-border pt-4">
                        <Quiz topic={t.name} />
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
