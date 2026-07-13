"use client";

import { useState } from "react";
import { Loader2, Brain } from "lucide-react";
import { Button } from "@/components/ui";
import { QuizRunner } from "@/components/QuizRunner";
import { fetchClaudeJson } from "@/lib/useClaudeStream";
import type { Quiz as QuizType } from "@/lib/claude/schemas";

export function Quiz({ topic }: { topic: string }) {
  const [quiz, setQuiz] = useState<QuizType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    setQuiz(null);
    const { data, error } = await fetchClaudeJson<QuizType>("quiz", { topic });
    if (error) setError(error);
    else setQuiz(data ?? null);
    setLoading(false);
  }

  if (!quiz) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <Brain size={28} className="mx-auto mb-2 text-accent" />
        <p className="mb-4 text-sm text-muted">
          Quiz yourself on {topic} concepts — 5 questions, instant feedback.
        </p>
        <Button onClick={generate} disabled={loading}>
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Brain size={15} />}
          Generate quiz
        </Button>
        {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}
      </div>
    );
  }

  return <QuizRunner quiz={quiz} progressTopic={topic} onRegenerate={generate} />;
}
