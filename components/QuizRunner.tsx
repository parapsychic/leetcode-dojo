"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui";
import type { Quiz as QuizType } from "@/lib/claude/schemas";
import { cn } from "@/lib/utils";
import { emitCompanionEvent } from "@/lib/companion/bus";

/**
 * Presentational, interactive runner for an already-loaded quiz: pick answers,
 * submit, score, and (optionally) regenerate. Used both by the topic Quiz (which
 * fetches its own quiz) and the Discover paper quiz (which comes pre-loaded with
 * the daily digest). On submit it records the score to /api/progress.
 */
export function QuizRunner({
  quiz,
  progressTopic,
  onRegenerate,
  regenerateLabel = "New quiz",
}: {
  quiz: QuizType;
  /** Topic recorded against the score; defaults to the quiz's own topic. */
  progressTopic?: string;
  /** If provided, shows a button to generate a fresh quiz after submitting. */
  onRegenerate?: () => void;
  regenerateLabel?: string;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);

  function submit() {
    setSubmitted(true);
    const correct = quiz.questions.filter(
      (q) => answers[q.id] === q.correctIndex,
    ).length;
    emitCompanionEvent({
      type: "quiz",
      topic: progressTopic ?? quiz.topic,
      scorePct: Math.round((correct / quiz.questions.length) * 100),
    });
    fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "quiz",
        quiz: {
          topic: progressTopic ?? quiz.topic,
          total: quiz.questions.length,
          correct,
          scorePct: Math.round((correct / quiz.questions.length) * 100),
        },
      }),
    }).catch(() => {});
  }

  const correctCount = quiz.questions.filter(
    (q) => answers[q.id] === q.correctIndex,
  ).length;

  return (
    <div className="space-y-4">
      {quiz.questions.map((q, qi) => (
        <div key={q.id} className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 text-sm font-medium">
            {qi + 1}. {q.question}
          </div>
          <div className="space-y-2">
            {q.options.map((opt, oi) => {
              const chosen = answers[q.id] === oi;
              const isCorrect = oi === q.correctIndex;
              const show = submitted;
              return (
                <button
                  key={oi}
                  disabled={submitted}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    !show && chosen && "border-accent bg-accent/10",
                    !show && !chosen && "border-border hover:bg-background/60",
                    show && isCorrect && "border-emerald-400 bg-emerald-400/10",
                    show && chosen && !isCorrect && "border-rose-400 bg-rose-400/10",
                    show && !isCorrect && !chosen && "border-border opacity-60",
                  )}
                >
                  {show && isCorrect && <CheckCircle2 size={15} className="text-emerald-400" />}
                  {show && chosen && !isCorrect && <XCircle size={15} className="text-rose-400" />}
                  <span>{opt}</span>
                </button>
              );
            })}
          </div>
          {submitted && <p className="mt-2 text-xs text-muted">{q.explanation}</p>}
        </div>
      ))}

      {!submitted ? (
        <Button
          onClick={submit}
          disabled={Object.keys(answers).length < quiz.questions.length}
        >
          Submit answers
        </Button>
      ) : (
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-accent/15 px-3 py-2 text-sm font-medium text-accent">
            Score: {correctCount}/{quiz.questions.length}
          </span>
          {onRegenerate && (
            <Button variant="outline" onClick={onRegenerate}>
              {regenerateLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
