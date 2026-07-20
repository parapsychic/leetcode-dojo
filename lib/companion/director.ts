// The companion's "when to speak, and how" policy. Pure functions + a small
// mutable state record owned by the widget. Two jobs:
//   1. Anti-annoyance: cooldowns, hourly caps, probability gates per chattiness.
//   2. Token budget: route routine events to canned pack lines (zero LLM calls);
//      reserve the LLM for context-rich moments and user replies.
// eventSummary strings are built ONLY from event fields — never code, problem
// statements, or review text — which is what keeps the companion unable to
// leak solutions no matter how it is prompted.

import type { Chattiness } from "./config";
import type { CompanionEvent } from "./bus";
import type { CannedLine, CharacterPack } from "./pack";

export interface ChattinessPreset {
  /** Minimum ms between proactive lines. */
  minGapMs: number;
  /** Max proactive lines per rolling hour. */
  maxPerHour: number;
  /** Probability a routine event (problemOpen, hint…) gets a line at all. */
  routineProb: number;
}

export const CHATTINESS_PRESETS: Record<Chattiness, ChattinessPreset> = {
  quiet: { minGapMs: 240_000, maxPerHour: 4, routineProb: 0.3 },
  normal: { minGapMs: 90_000, maxPerHour: 10, routineProb: 0.7 },
  chatty: { minGapMs: 40_000, maxPerHour: 20, routineProb: 1.0 },
};

export interface DirectorState {
  proactiveAt: number[]; // timestamps of proactive lines (rolling hour)
  lastLlmAt: number;
  lastCannedIndex: Record<string, number>;
}

export function initialDirectorState(): DirectorState {
  return { proactiveAt: [], lastLlmAt: 0, lastCannedIndex: {} };
}

export type Decision =
  | { kind: "drop" }
  | { kind: "canned"; eventKey: string; vars: Record<string, string | number> }
  | { kind: "llm"; eventSummary: string }
  | { kind: "display"; text: string }; // pre-generated (absorbed coach nudge)

const HOUR_MS = 3_600_000;
const LLM_VERDICT_GAP_MS = 60_000;
const RICH_SOLVE_MS = 25 * 60_000;

function proactiveAllowed(
  state: DirectorState,
  preset: ChattinessPreset,
  now: number,
  routine: boolean,
): boolean {
  state.proactiveAt = state.proactiveAt.filter((t) => now - t < HOUR_MS);
  if (state.proactiveAt.length >= preset.maxPerHour) return false;
  const last = state.proactiveAt[state.proactiveAt.length - 1] ?? 0;
  if (now - last < preset.minGapMs) return false;
  if (routine && Math.random() > preset.routineProb) return false;
  return true;
}

/** Record that a proactive line was actually spoken (call after decide → speak). */
export function noteProactive(state: DirectorState, now: number): void {
  state.proactiveAt.push(now);
}

export function decide(
  event: CompanionEvent,
  chattiness: Chattiness,
  state: DirectorState,
  now = Date.now(),
): Decision {
  const preset = CHATTINESS_PRESETS[chattiness];
  switch (event.type) {
    case "settingsChanged":
      return { kind: "drop" };

    case "coachLine":
      // Already generated (and persona-voiced) by the coach call — free to show.
      return { kind: "display", text: event.text };

    case "problemOpen": {
      if (!proactiveAllowed(state, preset, now, true)) return { kind: "drop" };
      return { kind: "canned", eventKey: "problemOpen", vars: { title: event.title } };
    }

    case "hint": {
      if (!proactiveAllowed(state, preset, now, true)) return { kind: "drop" };
      return { kind: "canned", eventKey: "hintUsed", vars: { title: event.title } };
    }

    case "quiz": {
      if (!proactiveAllowed(state, preset, now, false)) return { kind: "drop" };
      const key = event.scorePct >= 70 ? "quizGood" : "quizBad";
      return { kind: "canned", eventKey: key, vars: { score: event.scorePct, topic: event.topic } };
    }

    case "solved": {
      // Celebrations always fire (no cooldown — a solve is the whole point),
      // but they still count toward the hourly budget.
      const rich =
        event.attempts >= 3 || (event.elapsedMs !== null && event.elapsedMs >= RICH_SOLVE_MS);
      if (rich && now - state.lastLlmAt >= preset.minGapMs) {
        const mins = event.elapsedMs ? Math.round(event.elapsedMs / 60_000) : null;
        return {
          kind: "llm",
          eventSummary: `They just solved the problem "${event.title}"${
            mins ? ` after about ${mins} minutes` : ""
          }${event.attempts > 1 ? ` and ${event.attempts} attempts` : ""}. Congratulate them your way.`,
        };
      }
      return { kind: "canned", eventKey: "solved", vars: { title: event.title } };
    }

    case "verdict": {
      if (!proactiveAllowed(state, preset, now, false)) return { kind: "drop" };
      if (now - state.lastLlmAt >= LLM_VERDICT_GAP_MS) {
        return {
          kind: "llm",
          eventSummary: `Their submission for "${event.title}" got the review verdict: ${event.verdict}${
            event.attempts > 1 ? ` (attempt ${event.attempts})` : ""
          }. React accordingly — tease or spur them on, but give zero technical advice.`,
        };
      }
      return { kind: "canned", eventKey: event.verdict, vars: { title: event.title } };
    }
  }
}

/** Fill {name}/{title}/{score}/{streak} template slots. */
export function fillTemplate(
  text: string,
  vars: Record<string, string | number>,
): string {
  return text.replace(/\{(\w+)\}/g, (m, key: string) => {
    const v = vars[key];
    if (v === undefined || v === null || v === "") {
      // {name} unknown → drop the slot and tidy stray spacing/commas around it.
      return "";
    }
    return String(v);
  })
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/,\s*([,.!?])/g, "$1");
}

/** Pick a canned line for an event key, avoiding the immediately-previous pick. */
export function pickCanned(
  pack: CharacterPack,
  eventKey: string,
  state: DirectorState,
): CannedLine | null {
  const lines = pack.eventLines[eventKey];
  if (!lines?.length) return null;
  let idx = Math.floor(Math.random() * lines.length);
  if (lines.length > 1 && idx === state.lastCannedIndex[eventKey]) {
    idx = (idx + 1) % lines.length;
  }
  state.lastCannedIndex[eventKey] = idx;
  return lines[idx];
}
