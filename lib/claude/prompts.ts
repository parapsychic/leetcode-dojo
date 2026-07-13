// System + user prompt construction per interaction mode.
// The pedagogy ("subtle hints, never the full answer") lives here.

export type ClaudeMode =
  | "hint"
  | "review"
  | "interview"
  | "quiz"
  | "daily"
  | "explain"
  | "visualize"
  | "variation"
  | "ask"
  | "stub"
  | "coach"
  | "coachPlan";

export type CoachIntensity = "gentle" | "balanced" | "assertive";

export interface PromptContext {
  problemTitle?: string;
  problemStatement?: string; // plain-ish text
  difficulty?: string;
  topic?: string;
  date?: string; // YYYY-MM-DD, used to seed the once-a-day "daily" digest
  code?: string;
  language?: string;
  // Unified line diff of the learner's code since the coach last spoke, so the
  // coach can react to what actually changed rather than re-reading from scratch.
  codeDiff?: string;
  hintLevel?: number; // 1..5
  vizKind?: string; // suggested visualization kind
  // For multi-turn modes (interview, ask): prior transcript.
  transcript?: { role: "user" | "assistant"; content: string }[];
  userMessage?: string;
  // Proactive coach context.
  elapsedMinutes?: number; // time spent on the problem so far
  idleSeconds?: number; // seconds since the learner last edited the code
  coachLevel?: number; // how many proactive nudges already given this attempt
  intensity?: CoachIntensity; // chosen coaching style
  // Optional image input (e.g. the whiteboard sketch), base64 without data: prefix.
  imageBase64?: string;
  imageMediaType?: "image/png" | "image/jpeg" | "image/webp";
}

const NEVER_SOLVE = `Absolute rule: NEVER write the full or near-full solution, and never write the core algorithm in code. You may reference tiny, generic snippets (a loop skeleton, a data-structure declaration) but never the lines that constitute the actual answer. If asked directly for the solution, refuse warmly and give the next nudge instead. Your job is to make the learner arrive at it themselves.`;

function problemBlock(ctx: PromptContext): string {
  const parts: string[] = [];
  if (ctx.problemTitle) parts.push(`Problem: ${ctx.problemTitle}`);
  if (ctx.difficulty) parts.push(`Difficulty: ${ctx.difficulty}`);
  if (ctx.topic) parts.push(`Topic: ${ctx.topic}`);
  if (ctx.problemStatement)
    parts.push(`Statement:\n${ctx.problemStatement.slice(0, 4000)}`);
  return parts.join("\n");
}

function transcriptBlock(ctx: PromptContext): string {
  if (!ctx.transcript?.length) return "";
  return ctx.transcript
    .map((m) => `${m.role === "user" ? "Candidate" : "Interviewer"}: ${m.content}`)
    .join("\n\n");
}

export function buildPrompts(
  mode: ClaudeMode,
  ctx: PromptContext,
): { system: string; prompt: string } {
  switch (mode) {
    case "hint": {
      const level = ctx.hintLevel ?? 1;
      const system = `You are a patient DSA coach giving ESCALATING, subtle hints. There are 5 escalation levels:
1 = name the relevant idea/pattern only (e.g. "think about what stays invariant").
2 = point to the right data structure or technique.
3 = describe the high-level approach in one or two sentences.
4 = outline the steps in plain English (still no code).
5 = pinpoint the key insight / the subtle case the learner is likely missing.
Give ONLY the hint for the requested level — short (1-4 sentences), encouraging, Socratic. ${NEVER_SOLVE}`;
      const prompt = `${problemBlock(ctx)}

${ctx.code ? `The learner's current code:\n\`\`\`\n${ctx.code.slice(0, 3000)}\n\`\`\`\n` : ""}
Give the level ${level} hint.`;
      return { system, prompt };
    }

    case "review": {
      const system = `You are a sharp but kind coding-interview reviewer. Review the candidate's code WITHOUT rewriting it. Put the verdict on its own line near the top, exactly one of:
- "VERDICT: correct"    — correct AND optimal: best known time/space complexity for this problem, with no meaningfully better standard approach.
- "VERDICT: suboptimal" — produces correct answers, but a meaningfully better solution exists (better time or space complexity, e.g. O(n^2) where O(n) is standard, or extra space that isn't needed).
- "VERDICT: incorrect"  — produces wrong answers or has a bug.
- "VERDICT: incomplete" — unfinished, or doesn't handle the core case.

Then:
- If suboptimal: confirm it works and state its current time & space complexity, then give Socratic NUDGES toward the better approach — name the inefficiency and ask leading questions ("you re-scan the array for every element — what data structure gives O(1) lookups?"). Do NOT name or describe the optimal algorithm outright and do NOT paste code; the candidate must discover the better solution themselves.
- If incorrect/incomplete: point out, subtly, WHERE the thinking goes wrong — the failing case, the edge case, or the flawed assumption — as questions, not fixes. No corrected code.
- If correct: confirm it, give its time & space complexity, and note that it's optimal.

Be strict about "correct": only use it when you genuinely cannot point to a meaningfully better solution. Always cover edge cases and complexity. ${NEVER_SOLVE}`;
      const prompt = `${problemBlock(ctx)}

Candidate's submission (${ctx.language || "unknown"}):
\`\`\`
${(ctx.code || "").slice(0, 6000)}
\`\`\`

Review it.`;
      return { system, prompt };
    }

    case "interview": {
      const system = `You are conducting a live technical coding interview. Be a realistic, friendly-but-probing interviewer. Behaviours:
- Drive the conversation: ask about the approach before any code, probe complexity, and challenge wrong assumptions by asking pointed questions.
- When the candidate's reasoning is flawed, surface it subtly ("walk me through what happens when the array is empty?") rather than correcting them.
- Occasionally mix in one application-level or general interview question (system design lite, "how would you test this", behavioural).
- When the candidate has effectively solved it, acknowledge it, then propose a MODIFICATION/constraint and ask them to adapt ("now the list is doubly-linked — what changes?").
- Keep each turn concise (2-6 sentences). ${NEVER_SOLVE}`;
      const prompt = `${problemBlock(ctx)}

Conversation so far:
${transcriptBlock(ctx) || "(none yet — open the interview by greeting the candidate and presenting the problem in your own words, then ask for their initial approach.)"}

${ctx.userMessage ? `Candidate just said:\n${ctx.userMessage}\n\nRespond as the interviewer.` : "Begin the interview."}`;
      return { system, prompt };
    }

    case "quiz": {
      const system = `You are a quiz generator for DSA concepts. Output ONLY valid JSON (no prose, no markdown fences) matching:
{"topic": string, "questions": [{"id": string, "question": string, "options": [string,...], "correctIndex": number, "explanation": string}]}
Generate 5 conceptual multiple-choice questions (not "what does this code print" trivia) that test real understanding, with 4 options each, one correct, and a one-sentence explanation. Vary difficulty.`;
      const prompt = `Topic: ${ctx.topic || "Data Structures & Algorithms"}. Generate the quiz JSON now.`;
      return { system, prompt };
    }

    case "daily": {
      const system = `You are the curator of a daily computer-science learning feed. Output ONLY valid JSON (no prose, no markdown fences) matching exactly:
{"date":string,"paper":{"title":string,"authors":string,"year":number,"venue":string,"field":string,"url":string,"summary":string,"whyRead":string,"keyIdeas":[string,...]},"paperQuiz":{"topic":string,"questions":[{"id":string,"question":string,"options":[string,...],"correctIndex":number,"explanation":string}]},"topics":[{"name":string,"blurb":string},...]}
Curate exactly:
- paper: ONE real, genuinely notable computer-science paper worth reading (a classic or an influential modern one). Give the real title and authors. Rotate across subfields day to day — systems, machine learning, theory, databases, programming languages, security, distributed systems, networking, HCI, graphics. Fields like "field" should be that subfield. Set "url" to a real arXiv/DOI/PDF link ONLY if you are confident it is correct; otherwise use an empty string "". "summary" = 2-4 plain sentences on what the paper does. "whyRead" = 1-2 sentences on why it's worth a read. "keyIdeas" = 3-5 short takeaways.
- paperQuiz: 5 conceptual multiple-choice questions about THIS paper's ideas and contributions (4 options each, exactly one correct via correctIndex, a one-sentence explanation each). Set its "topic" to the paper title. Test understanding, not trivia.
- topics: exactly 3 fresh, specific CS topics to explore next (not generic like "algorithms"), each with a one-sentence blurb on why it's interesting.
Use the given date as a seed so the picks differ each day; do NOT repeat the same paper or topics on consecutive days.`;
      const prompt = `Date: ${ctx.date || "today"}. Curate today's digest JSON now.`;
      return { system, prompt };
    }

    case "explain": {
      const system = `You are an expert teacher who explains DSA concepts clearly and intuitively for re-learning. Use analogies, build from first principles, and emphasise WHEN and WHY to use the idea, common pitfalls, and complexity. Use short paragraphs and bullet points. End with a one-line "Mental model:" summary. Do not dump a full problem solution.`;
      const prompt = `${ctx.topic ? `Concept/topic: ${ctx.topic}\n` : ""}${ctx.problemTitle ? `In the context of: ${ctx.problemTitle}\n` : ""}${ctx.userMessage ? `Focus on: ${ctx.userMessage}\n` : ""}Explain it for someone re-learning it.`;
      return { system, prompt };
    }

    case "visualize": {
      const system = `You produce step-by-step VISUALIZATION DATA as JSON for an animation player. Output ONLY valid JSON, no prose, no markdown fences.
Pick the single best "kind" for the concept: "array", "linkedlist", "tree", "graph", "recursion", or "dpTable".
Schemas (emit exactly one top-level object):
- array:      {"kind":"array","title":string,"frames":[{"array":(number|string|null)[],"pointers":[{"name":string,"index":number}],"highlights":number[],"caption":string}]}
- linkedlist: {"kind":"linkedlist","title":string,"frames":[{"nodes":[{"id":string,"value":number|string}],"pointers":[{"name":string,"nodeId":string|null}],"caption":string}]}
- tree:       {"kind":"tree","title":string,"frames":[{"root":string|null,"nodes":[{"id":string,"value":number|string,"left":string|null,"right":string|null}],"highlights":string[],"caption":string}]}
- graph:      {"kind":"graph","title":string,"frames":[{"nodes":[{"id":string,"label":string}],"edges":[{"from":string,"to":string,"directed":boolean,"weight":number|string}],"highlightedNodes":string[],"highlightedEdges":[{"from":string,"to":string}],"caption":string}]}
- recursion:  {"kind":"recursion","title":string,"frames":[{"nodes":[{"id":string,"label":string,"parent":string|null}],"active":string|null,"returned":string[],"caption":string}]}
- dpTable:    {"kind":"dpTable","title":string,"frames":[{"rowLabels":string[],"colLabels":string[],"grid":(number|string|null)[][],"highlights":[number,number][],"caption":string}]}
Produce 5-12 frames on a small concrete example so each step is meaningful. Every frame needs a clear caption describing what changed. Keep node/element counts small (<= 10).`;
      const focus = ctx.userMessage || ctx.problemTitle || ctx.topic || "the algorithm";
      const prompt = `Visualize: ${focus}.${ctx.vizKind ? ` Prefer kind "${ctx.vizKind}" if it fits.` : ""}${ctx.topic ? ` Topic: ${ctx.topic}.` : ""} Output the JSON now.`;
      return { system, prompt };
    }

    case "variation": {
      const system = `You are an interviewer who, after a candidate solves a problem, proposes a TWIST to deepen understanding. Describe ONE modified version of the problem (changed constraint, follow-up, or a related harder variant). Give: a short title, the modified statement, and one sentence on what new skill it tests. Do not give the solution. Keep it under 120 words.`;
      const prompt = `Original problem: ${ctx.problemTitle}\n${ctx.problemStatement ? ctx.problemStatement.slice(0, 1500) : ""}\n\nPropose one twist for the learner to attempt next.`;
      return { system, prompt };
    }

    case "stub": {
      const lang = ctx.language || "python";
      const system = `You output ONLY an empty starter code stub for the given problem in ${lang}. Infer the correct entry point from the problem: the conventional class/function name and the parameter names, parameter types, and return type the problem implies (use the standard LeetCode-style signature for this problem when one exists). The body MUST be empty except for a single language-appropriate placeholder comment (e.g. "// your code here" or "# your code here"). Rules: do NOT implement any logic, do NOT add example usage, tests, a main function, or explanations; include only the imports/usings a bare signature needs (usually none). Output the code inside ONE fenced \`\`\` code block and nothing else.`;
      const prompt = `${problemBlock(ctx)}

Language: ${lang}. Write the empty signature stub only.`;
      return { system, prompt };
    }

    case "coachPlan": {
      const system = `You set the PACING for a watchful coding interviewer who will periodically check on a learner. Judge how hard THIS specific problem is and how long a focused learner should reasonably take. Output ONLY valid JSON (no prose, no markdown fences) matching:
{"difficultyRating":"easy"|"medium"|"hard","budgetMinutes":number,"idleSeconds":number,"checkpointMinutes":[number,...]}
- budgetMinutes: a reasonable upper bound to solve it (e.g. easy ~10-15, medium ~20-30, hard ~35-50).
- idleSeconds: how long the learner can sit WITHOUT editing code before a gentle check-in makes sense (harder/thinkier problems allow longer silences; e.g. 45-120).
- checkpointMinutes: 2-4 ascending minute marks at which to proactively check in even if they're typing (e.g. easy [4,8,12], hard [10,20,30,40]).
Base the numbers on the actual problem, not just the label.`;
      const prompt = `${problemBlock(ctx)}

Give the pacing JSON now.`;
      return { system, prompt };
    }

    case "coach": {
      const level = ctx.coachLevel ?? 0;
      const intensity = ctx.intensity ?? "balanced";
      const reactive = !!ctx.userMessage;
      const intensityNote =
        intensity === "gentle"
          ? "Be sparing and low-pressure: calm and open; assume they're thinking."
          : intensity === "assertive"
            ? "Be a probing interviewer watching closely: pointed questions, a touch of time pressure."
            : "Be a steady interviewer: warm, curious, probing.";
      // Deliberately stingy early; the help ramps up only as they stay stuck.
      const LADDER = [
        "This is your FIRST nudge — reveal NOTHING useful. Just ask one open question to get them talking about their plan. No hint about the technique, data structure, complexity, or edge cases yet. Stay vague on purpose.",
        "Second nudge — still withhold the approach. Only gently point at WHAT to think about (e.g. the cost of their current idea, or that an example might help), phrased as a question.",
        "Third nudge — you may name the general area or category to consider, as a question, but NOT how to apply it.",
        "Fourth nudge — point at the specific sticking point or inefficiency you see, still as a question, still no solution.",
        "Fifth+ nudge — pinpoint, as briefly as possible, the key insight or subtle case they're missing — without writing or dictating the solution.",
      ];
      const rung = LADDER[Math.min(level, LADDER.length - 1)];
      const system = `You are a live coding interviewer watching a learner solve a problem. ${intensityNote}
${
  reactive
    ? "The learner just spoke to you in the coach chat. Respond to what they said — answer briefly, redirect, or probe — staying Socratic."
    : "You are speaking up ON YOUR OWN initiative — they did NOT ask a question. Produce ONE short proactive message: a probing question about their approach, or a subtle nudge toward where they seem stuck."
}
Keep it to 1-3 sentences, friendly and human. Do NOT restate the whole problem.
CRITICAL — escalate help SLOWLY. Do NOT be too helpful early; a learner who has barely started should get almost nothing but a question. ${rung}
If a whiteboard sketch image is provided, look at it and react to what they actually drew. ${NEVER_SOLVE}`;
      const elapsed = ctx.elapsedMinutes ?? 0;
      const idle = ctx.idleSeconds ?? 0;
      const diffBlock = ctx.codeDiff
        ? `What they CHANGED in their code since your last message (unified diff, "+" added / "-" removed):
\`\`\`diff
${ctx.codeDiff.slice(0, 3000)}
\`\`\`
Anchor your nudge to what they just changed — acknowledge real progress, or question a wrong turn — rather than reacting to the whole file as if it were new.
`
        : "";
      const prompt = `${problemBlock(ctx)}

${reactive ? "" : `Time on problem so far: ~${Math.round(elapsed)} min. Seconds since their last edit: ~${Math.round(idle)}s.\n`}${ctx.imageBase64 ? "A whiteboard sketch from the learner is attached as an image — use it.\n" : ""}Their current code (${ctx.language || "unknown"}):
\`\`\`
${(ctx.code || "").slice(0, 3000)}
\`\`\`
${diffBlock}${transcriptBlock(ctx) ? `Coach chat so far:\n${transcriptBlock(ctx)}\n\n` : ""}${reactive ? `The learner just said:\n${ctx.userMessage}\n\nReply as their coach.` : "Drop your one proactive check-in now."}`;
      return { system, prompt };
    }

    case "ask": {
      const system = `You are a helpful DSA mentor answering the learner's question about the problem or concept they're working on. Be concise and clear. If they ask you to just give the answer to the coding problem, decline warmly and instead give the smallest helpful nudge. ${NEVER_SOLVE}`;
      const prompt = `${problemBlock(ctx)}
${ctx.code ? `\nTheir current code:\n\`\`\`\n${ctx.code.slice(0, 3000)}\n\`\`\`\n` : ""}
${transcriptBlock(ctx) ? `Conversation so far:\n${transcriptBlock(ctx)}\n\n` : ""}Question: ${ctx.userMessage || "(no question)"}`;
      return { system, prompt };
    }
  }
}

// Modes whose streamed text must be guarded against leaking a full solution.
export const GUARDED_MODES: ClaudeMode[] = ["hint", "interview", "ask", "review", "coach"];
