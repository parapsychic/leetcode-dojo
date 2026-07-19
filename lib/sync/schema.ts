// Validation for ProgressData arriving from outside the app (import files,
// remote sync docs). Tolerant at the leaves (bad fields fall back to safe
// defaults) but strict about the overall shape — corrupt remote docs must
// surface as errors, never be silently treated as empty/absent, or the next
// push would clobber them.

import { z } from "zod";
import type { ProgressData } from "@/lib/store/progress";
import { SyncError } from "./types";

const MAX_PROBLEMS = 5000;

const zProblemProgress = z.object({
  status: z.enum(["unsolved", "attempted", "solved"]).catch("unsolved"),
  attempts: z.number().int().nonnegative().catch(0),
  hintsUsed: z.number().int().nonnegative().catch(0),
  bestTimeMs: z.number().nonnegative().nullable().catch(null),
  lastAttemptAt: z.string().nullable().catch(null),
  solvedAt: z.string().nullable().catch(null),
});

const zQuizResult = z.object({
  id: z.string(),
  topic: z.string().catch(""),
  scorePct: z.number().catch(0),
  total: z.number().int().nonnegative().catch(0),
  correct: z.number().int().nonnegative().catch(0),
  takenAt: z.string().catch(""),
});

// Containers are strict (a doc without a real problems/streak shape is not a
// progress file and must be rejected, not silently emptied); leaves are
// tolerant so one odd field never discards a whole document.
export const zProgressData = z.object({
  version: z.literal(1).catch(1),
  updatedAt: z.string().optional(),
  profile: z.object({ name: z.string().catch("") }),
  problems: z.record(z.string(), zProblemProgress),
  quizResults: z.array(zQuizResult),
  streak: z.object({
    current: z.number().int().nonnegative().catch(0),
    longest: z.number().int().nonnegative().catch(0),
    lastActiveDate: z.string().nullable().catch(null),
  }),
});

/** Validate an untrusted parsed value into a well-formed ProgressData. */
export function normalizeProgressDoc(value: unknown): ProgressData {
  const parsed = zProgressData.parse(value);
  // Enforce caps so a hostile/corrupt doc can't balloon the local store.
  const entries = Object.entries(parsed.problems).slice(0, MAX_PROBLEMS);
  return {
    ...parsed,
    problems: Object.fromEntries(entries),
    quizResults: parsed.quizResults.slice(0, 100),
  };
}

/** Parse a raw remote/sync JSON string. Throws SyncError("other") when invalid. */
export function parseProgressDoc(raw: string): ProgressData {
  try {
    return normalizeProgressDoc(JSON.parse(raw));
  } catch (err) {
    throw new SyncError(
      `Remote progress document is invalid: ${err instanceof Error ? err.message : String(err)}`,
      "other",
    );
  }
}
