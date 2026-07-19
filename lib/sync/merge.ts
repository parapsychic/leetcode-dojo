// Field-level merge of two ProgressData docs. Pure, commutative, and idempotent,
// so repeated sync cycles between devices always converge (no double-counting).

import type {
  ProblemProgress,
  ProgressData,
  QuizResult,
  Streak,
} from "@/lib/store/progress";

const STATUS_RANK: Record<ProblemProgress["status"], number> = {
  unsolved: 0,
  attempted: 1,
  solved: 2,
};

/** Later of two ISO strings (lexicographic compare is safe for toISOString values). */
function laterOf(a: string | null | undefined, b: string | null | undefined): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return a >= b ? a : b;
}

/** Earlier of two ISO strings (used for solvedAt = first solve). */
function earlierOf(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a <= b ? a : b;
}

function mergeProblem(a: ProblemProgress, b: ProblemProgress): ProblemProgress {
  const bestTimeMs =
    a.bestTimeMs == null
      ? b.bestTimeMs
      : b.bestTimeMs == null
        ? a.bestTimeMs
        : Math.min(a.bestTimeMs, b.bestTimeMs);
  return {
    status: STATUS_RANK[a.status] >= STATUS_RANK[b.status] ? a.status : b.status,
    attempts: Math.max(a.attempts, b.attempts),
    hintsUsed: Math.max(a.hintsUsed, b.hintsUsed),
    bestTimeMs,
    lastAttemptAt: laterOf(a.lastAttemptAt, b.lastAttemptAt),
    solvedAt: earlierOf(a.solvedAt, b.solvedAt),
  };
}

function mergeName(a: ProgressData, b: ProgressData): string {
  const an = a.profile.name;
  const bn = b.profile.name;
  if (!an) return bn;
  if (!bn) return an;
  if (an === bn) return an;
  const au = a.updatedAt ?? "";
  const bu = b.updatedAt ?? "";
  if (au !== bu) return au > bu ? an : bn;
  // Deterministic tie-break: longer name, then lexicographic max.
  if (an.length !== bn.length) return an.length > bn.length ? an : bn;
  return an > bn ? an : bn;
}

function mergeQuizzes(a: QuizResult[], b: QuizResult[]): QuizResult[] {
  const byId = new Map<string, QuizResult>();
  for (const q of [...a, ...b]) {
    const prev = byId.get(q.id);
    if (!prev || q.takenAt > prev.takenAt) byId.set(q.id, q);
  }
  return [...byId.values()]
    .sort((x, y) => (x.takenAt > y.takenAt ? -1 : x.takenAt < y.takenAt ? 1 : 0))
    .slice(0, 100);
}

function mergeStreak(a: Streak, b: Streak): Streak {
  const longest = Math.max(a.longest, b.longest);
  // (current, lastActiveDate) travel as a pair from the more recently active doc;
  // mixing them would fabricate streaks neither device earned.
  const ad = a.lastActiveDate ?? "";
  const bd = b.lastActiveDate ?? "";
  if (ad === bd) {
    return { current: Math.max(a.current, b.current), longest, lastActiveDate: a.lastActiveDate };
  }
  const winner = ad > bd ? a : b;
  return { current: winner.current, longest, lastActiveDate: winner.lastActiveDate };
}

export function mergeProgress(a: ProgressData, b: ProgressData): ProgressData {
  const problems: Record<string, ProblemProgress> = {};
  for (const id of new Set([...Object.keys(a.problems), ...Object.keys(b.problems)])) {
    const pa = a.problems[id];
    const pb = b.problems[id];
    problems[id] = pa && pb ? mergeProblem(pa, pb) : { ...(pa ?? pb)! };
  }
  return {
    version: 1,
    updatedAt: laterOf(a.updatedAt, b.updatedAt) ?? undefined,
    profile: { name: mergeName(a, b) },
    problems,
    quizResults: mergeQuizzes(a.quizResults, b.quizResults),
    streak: mergeStreak(a.streak, b.streak),
  };
}
