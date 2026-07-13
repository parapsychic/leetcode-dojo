import { z } from "zod";

// ---- Visualization protocol ----
// Claude emits a VizSpec: a sequence of frames the frontend renderers animate.
// One discriminated union keyed by `kind` so each renderer knows the shape.

const cell = z.union([z.number(), z.string(), z.null()]);

const arrayFrame = z.object({
  array: z.array(cell),
  pointers: z
    .array(z.object({ name: z.string(), index: z.number() }))
    .optional()
    .default([]),
  highlights: z.array(z.number()).optional().default([]),
  caption: z.string(),
});

const listNode = z.object({ id: z.string(), value: z.union([z.number(), z.string()]) });
const linkedListFrame = z.object({
  nodes: z.array(listNode), // order defines next pointers
  pointers: z
    .array(z.object({ name: z.string(), nodeId: z.string().nullable() }))
    .optional()
    .default([]),
  caption: z.string(),
});

const treeNode = z.object({
  id: z.string(),
  value: z.union([z.number(), z.string()]),
  left: z.string().nullable().optional(),
  right: z.string().nullable().optional(),
});
const treeFrame = z.object({
  root: z.string().nullable(),
  nodes: z.array(treeNode),
  highlights: z.array(z.string()).optional().default([]),
  caption: z.string(),
});

const graphFrame = z.object({
  nodes: z.array(z.object({ id: z.string(), label: z.string() })),
  edges: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      directed: z.boolean().optional().default(false),
      weight: z.union([z.number(), z.string()]).optional(),
    }),
  ),
  highlightedNodes: z.array(z.string()).optional().default([]),
  highlightedEdges: z
    .array(z.object({ from: z.string(), to: z.string() }))
    .optional()
    .default([]),
  caption: z.string(),
});

const recursionFrame = z.object({
  // Each call is a node with an optional parent id; `active` is the current call.
  nodes: z.array(
    z.object({ id: z.string(), label: z.string(), parent: z.string().nullable() }),
  ),
  active: z.string().nullable().optional(),
  returned: z.array(z.string()).optional().default([]),
  caption: z.string(),
});

const dpTableFrame = z.object({
  rowLabels: z.array(z.string()).optional().default([]),
  colLabels: z.array(z.string()).optional().default([]),
  grid: z.array(z.array(cell)),
  highlights: z.array(z.tuple([z.number(), z.number()])).optional().default([]),
  caption: z.string(),
});

export const VizSpecSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("array"), title: z.string(), frames: z.array(arrayFrame).min(1) }),
  z.object({ kind: z.literal("linkedlist"), title: z.string(), frames: z.array(linkedListFrame).min(1) }),
  z.object({ kind: z.literal("tree"), title: z.string(), frames: z.array(treeFrame).min(1) }),
  z.object({ kind: z.literal("graph"), title: z.string(), frames: z.array(graphFrame).min(1) }),
  z.object({ kind: z.literal("recursion"), title: z.string(), frames: z.array(recursionFrame).min(1) }),
  z.object({ kind: z.literal("dpTable"), title: z.string(), frames: z.array(dpTableFrame).min(1) }),
]);

export type VizSpec = z.infer<typeof VizSpecSchema>;
export type VizKind = VizSpec["kind"];

// ---- Quiz schema ----

export const QuizSchema = z.object({
  topic: z.string(),
  questions: z
    .array(
      z.object({
        id: z.string(),
        question: z.string(),
        options: z.array(z.string()).min(2).max(6),
        correctIndex: z.number(),
        explanation: z.string(),
      }),
    )
    .min(1),
});
export type Quiz = z.infer<typeof QuizSchema>;

// ---- Daily digest ----
// A once-a-day curated feed: one CS paper worth reading (with a quiz baked in so
// it always matches the suggested paper) plus a few fresh topics to explore.

export const DailyDigestSchema = z.object({
  date: z.string(),
  paper: z.object({
    title: z.string(),
    authors: z.string(),
    year: z.union([z.number(), z.string()]).optional(),
    venue: z.string().optional().default(""),
    field: z.string().optional().default(""),
    url: z.string().optional().default(""),
    summary: z.string(),
    whyRead: z.string(),
    keyIdeas: z.array(z.string()).min(1),
  }),
  paperQuiz: QuizSchema,
  topics: z
    .array(z.object({ name: z.string(), blurb: z.string() }))
    .min(1),
});
export type DailyDigest = z.infer<typeof DailyDigestSchema>;

// ---- Coach pacing plan ----
// Claude rates the problem and sets when the proactive coach should check in.

export const CoachPlanSchema = z.object({
  difficultyRating: z.enum(["easy", "medium", "hard"]),
  budgetMinutes: z.number().positive().max(180),
  idleSeconds: z.number().positive().max(1200),
  checkpointMinutes: z.array(z.number().nonnegative()).min(1).max(8),
});
export type CoachPlan = z.infer<typeof CoachPlanSchema>;

// Pull the first balanced JSON object/array out of a model response that may be
// wrapped in prose or ```json fences.
export function extractJson(text: string): string | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1] : text;
  const start = candidate.search(/[[{]/);
  if (start === -1) return null;
  const open = candidate[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return candidate.slice(start, i + 1);
    }
  }
  return null;
}
