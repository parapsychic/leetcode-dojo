import { promises as fs } from "fs";
import path from "path";
import { dataDir } from "./paths";
import { mergeProgress } from "@/lib/sync/merge";

// ---- Types ----

export type ProblemStatus = "unsolved" | "attempted" | "solved";

export interface ProblemProgress {
  status: ProblemStatus;
  attempts: number;
  hintsUsed: number;
  bestTimeMs: number | null;
  lastAttemptAt: string | null; // ISO
  solvedAt: string | null; // ISO
}

export interface QuizResult {
  id: string;
  topic: string;
  scorePct: number;
  total: number;
  correct: number;
  takenAt: string; // ISO
}

export interface Streak {
  current: number;
  longest: number;
  lastActiveDate: string | null; // YYYY-MM-DD
}

export interface ProgressData {
  version: 1;
  /** ISO timestamp of the last local mutation; used by sync for merge ordering. */
  updatedAt?: string;
  profile: { name: string };
  problems: Record<string, ProblemProgress>;
  quizResults: QuizResult[];
  streak: Streak;
}

const EMPTY: ProgressData = {
  version: 1,
  profile: { name: "" }, // empty => first-run name prompt
  problems: {},
  quizResults: [],
  streak: { current: 0, longest: 0, lastActiveDate: null },
};

// ---- Storage location ----

function dataFile(): string {
  return path.join(dataDir(), "progress.json");
}

// ---- Read / write (serialized writes) ----

let writeChain: Promise<unknown> = Promise.resolve();

async function readData(): Promise<ProgressData> {
  try {
    const raw = await fs.readFile(dataFile(), "utf8");
    const parsed = JSON.parse(raw) as Partial<ProgressData>;
    const merged = { ...EMPTY, ...parsed, streak: { ...EMPTY.streak, ...parsed.streak } };
    if (!merged.profile) merged.profile = { name: "" };
    return merged;
  } catch {
    return structuredClone(EMPTY);
  }
}

async function writeData(data: ProgressData): Promise<void> {
  await fs.mkdir(dataDir(), { recursive: true });
  const tmp = dataFile() + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, dataFile());
}

async function mutate(
  fn: (d: ProgressData) => void | Promise<void>,
): Promise<ProgressData> {
  const run = async () => {
    const data = await readData();
    await fn(data);
    data.updatedAt = new Date().toISOString();
    await writeData(data);
    return data;
  };
  const result = writeChain.then(run, run);
  writeChain = result.catch(() => {});
  return result;
}

// ---- Public API ----

export async function getProgress(): Promise<ProgressData> {
  return readData();
}

function ensureProblem(d: ProgressData, id: string): ProblemProgress {
  if (!d.problems[id]) {
    d.problems[id] = {
      status: "unsolved",
      attempts: 0,
      hintsUsed: 0,
      bestTimeMs: null,
      lastAttemptAt: null,
      solvedAt: null,
    };
  }
  return d.problems[id];
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function bumpStreak(d: ProgressData): void {
  const today = todayStr();
  if (d.streak.lastActiveDate === today) return;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (d.streak.lastActiveDate === yesterday) {
    d.streak.current += 1;
  } else {
    d.streak.current = 1;
  }
  d.streak.longest = Math.max(d.streak.longest, d.streak.current);
  d.streak.lastActiveDate = today;
}

export async function recordHint(problemId: string): Promise<ProgressData> {
  return mutate((d) => {
    const pr = ensureProblem(d, problemId);
    pr.hintsUsed += 1;
  });
}

export async function recordAttempt(problemId: string): Promise<ProgressData> {
  return mutate((d) => {
    const pr = ensureProblem(d, problemId);
    pr.attempts += 1;
    pr.lastAttemptAt = new Date().toISOString();
    if (pr.status === "unsolved") pr.status = "attempted";
  });
}

export async function recordSolved(
  problemId: string,
  elapsedMs: number | null,
): Promise<ProgressData> {
  return mutate((d) => {
    const pr = ensureProblem(d, problemId);
    pr.status = "solved";
    pr.solvedAt = new Date().toISOString();
    pr.lastAttemptAt = pr.solvedAt;
    if (elapsedMs != null) {
      pr.bestTimeMs =
        pr.bestTimeMs == null ? elapsedMs : Math.min(pr.bestTimeMs, elapsedMs);
    }
    bumpStreak(d);
  });
}

export async function recordQuiz(
  result: Omit<QuizResult, "id" | "takenAt">,
): Promise<ProgressData> {
  return mutate((d) => {
    d.quizResults.unshift({
      ...result,
      // Random suffix keeps ids collision-free when results merge across devices.
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      takenAt: new Date().toISOString(),
    });
    d.quizResults = d.quizResults.slice(0, 100);
    bumpStreak(d);
  });
}

export async function setProfileName(name: string): Promise<ProgressData> {
  return mutate((d) => {
    d.profile.name = name.trim().slice(0, 40);
  });
}

// ---- Sync / import support ----
// Both go through mutate() so they serialize against normal app writes.
// The callback must assign field-by-field: mutate persists the same `d` object.

/** Overwrite the whole document (caller validates the input). */
export async function replaceProgress(next: ProgressData): Promise<ProgressData> {
  return mutate((d) => {
    d.profile = { name: next.profile.name };
    d.problems = next.problems;
    d.quizResults = next.quizResults;
    d.streak = next.streak;
  });
}

/** Field-level merge of an incoming doc (remote sync / import) into local. */
export async function mergeIntoProgress(incoming: ProgressData): Promise<ProgressData> {
  return mutate((d) => {
    const merged = mergeProgress(d, incoming);
    d.profile = merged.profile;
    d.problems = merged.problems;
    d.quizResults = merged.quizResults;
    d.streak = merged.streak;
  });
}
