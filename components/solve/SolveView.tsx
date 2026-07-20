"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowLeft, ExternalLink, Lightbulb, Loader2, Sparkles, Send, ClipboardCheck, CheckCircle2, FileCode2, MessageCircle } from "lucide-react";
import { Button, DifficultyBadge } from "@/components/ui";
import { Markdown } from "@/components/Markdown";
import { RewardBurst } from "@/components/RewardBurst";
import { CoachToast } from "@/components/solve/CoachToast";
import { Whiteboard, type WhiteboardHandle } from "@/components/solve/Whiteboard";
import { TimerDisplay, useTimer } from "@/components/solve/Timer";
import { useClaudeStream, fetchClaudeJson } from "@/lib/useClaudeStream";
import type { CoachIntensity } from "@/lib/claude/prompts";
import type { CoachPlan } from "@/lib/claude/schemas";
import { LANGUAGES, LANG_LABELS, type Language } from "@/components/CodeEditor";
import { lineDiff } from "@/lib/diff";
import { cn } from "@/lib/utils";
import { emitCompanionEvent, noteActivity } from "@/lib/companion/bus";
import type { PackManifest } from "@/lib/companion/pack";
import type { CompanionSettings } from "@/lib/companion/config";

const leetcodeUrl = (slug: string) => `https://leetcode.com/problems/${slug}/`;
import type { ProblemStatus } from "@/lib/store/progress";

const CodeEditor = dynamic(
  () => import("@/components/CodeEditor").then((m) => m.CodeEditor),
  { ssr: false, loading: () => <div className="p-4 text-sm text-muted">Loading editor…</div> },
);

interface ProblemMeta {
  id: string;
  title: string;
  difficulty: string;
  topic: string;
  leetcodeSlug: string | null;
  source: "leetcode" | "gfg";
  /** Curated Markdown statement for GFG-only problems; null for LeetCode ones. */
  statement: string | null;
}

const STARTER: Record<Language, string> = {
  python: "class Solution:\n    def solve(self):\n        # your code here\n        pass\n",
  java: "class Solution {\n    public void solve() {\n        // your code here\n    }\n}\n",
  cpp: "class Solution {\npublic:\n    void solve() {\n        // your code here\n    }\n};\n",
  csharp: "public class Solution {\n    public void Solve() {\n        // your code here\n    }\n}\n",
  javascript: "function solve() {\n  // your code here\n}\n",
  typescript: "function solve(): void {\n  // your code here\n}\n",
  go: "func solve() {\n    // your code here\n}\n",
};

function stripHtml(html: string | null): string {
  if (!html) return "";
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

const HINT_LABELS = ["", "Nudge", "Technique", "Approach", "Steps", "Key insight"];

// Coach pacing: how the chosen intensity scales Claude's pacing plan, and the
// minimum seconds between proactive nudges so the coach never spams.
const INTENSITY: Record<
  CoachIntensity,
  { label: string; mult: number; minGapSec: number }
> = {
  gentle: { label: "Gentle", mult: 1.6, minGapSec: 180 },
  balanced: { label: "Balanced", mult: 1.0, minGapSec: 90 },
  assertive: { label: "Assertive", mult: 0.6, minGapSec: 45 },
};

// Fallback pacing if Claude's coachPlan call fails, keyed by sheet difficulty.
const DEFAULT_PLAN: Record<string, CoachPlan> = {
  Easy: { difficultyRating: "easy", budgetMinutes: 12, idleSeconds: 60, checkpointMinutes: [4, 8, 12] },
  Medium: { difficultyRating: "medium", budgetMinutes: 25, idleSeconds: 90, checkpointMinutes: [8, 16, 24] },
  Hard: { difficultyRating: "hard", budgetMinutes: 40, idleSeconds: 120, checkpointMinutes: [12, 24, 36] },
};

// Strip the companion's leading "[expression]" tag for in-tab display (the tag
// only matters to the widget's sprite).
function stripExprTag(text: string): string {
  return text.replace(/^\s*\[[^\]\n]{1,30}\]\s*/, "");
}

// Pull the code out of a stub response (first fenced block, else the whole text).
function extractCode(text: string): string {
  const fence = text.match(/```[a-zA-Z#+]*\s*\n?([\s\S]*?)```/);
  return (fence ? fence[1] : text).trim();
}

async function postProgress(body: Record<string, unknown>) {
  try {
    await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    /* non-fatal */
  }
}

export function SolveView({
  problem,
  nextId,
  initialStatus,
}: {
  problem: ProblemMeta;
  nextId: string | null;
  initialStatus: ProblemStatus;
}) {
  const router = useRouter();
  const timer = useTimer();

  const [statementHtml, setStatementHtml] = useState<string | null>(null);
  const [statementText, setStatementText] = useState("");
  const [live, setLive] = useState<boolean | null>(null);

  const [tab, setTab] = useState<"statement" | "hints" | "coach" | "board" | "ask">("statement");
  const [language, setLanguage] = useState<Language>("python");
  const [code, setCode] = useState(STARTER.python);

  // Claude writes the empty signature stub (matching the actual problem) for the
  // learner to complete. lastStubRef lets us avoid overwriting the user's edits.
  const stubStream = useClaudeStream();
  const lastStubRef = useRef<string>(STARTER.python);
  const stubRequestedRef = useRef(false);

  // Hints
  const [hints, setHints] = useState<{ level: number; text: string }[]>([]);
  const hintStream = useClaudeStream();

  // Review
  const reviewStream = useClaudeStream();
  const [verdict, setVerdict] = useState<
    "correct" | "suboptimal" | "incorrect" | "incomplete" | null
  >(null);

  // Ask chat
  const [chat, setChat] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [askInput, setAskInput] = useState("");
  const askStream = useClaudeStream();

  // Proactive coach (also a two-way chat)
  const [intensity, setIntensity] = useState<CoachIntensity | null>(null);
  const [coachMessages, setCoachMessages] = useState<
    { role: "coach" | "user"; text: string; at: number }[]
  >([]);
  const [coachInput, setCoachInput] = useState("");
  const [coachUnread, setCoachUnread] = useState(0);
  const [toast, setToast] = useState<{ show: boolean; preview: string }>({ show: false, preview: "" });
  const coachStream = useClaudeStream();
  const whiteboardRef = useRef<WhiteboardHandle>(null);
  const coachPlanRef = useRef<CoachPlan>(DEFAULT_PLAN[problem.difficulty] ?? DEFAULT_PLAN.Medium);
  const lastEditAtRef = useRef<number>(Date.now());
  const lastCoachAtRef = useRef<number>(0);
  // The code as it stood when the coach last spoke, so each new coach turn can be
  // handed a diff of what changed since — null until the coach's first message.
  const codeAtLastCoachRef = useRef<string | null>(null);
  const coachLevelRef = useRef<number>(0);
  const firedCheckpointsRef = useRef<Set<number>>(new Set());
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Companion absorption: when the companion is enabled, coach nudges are
  // delivered through her bubble in her voice (no extra LLM call — the one
  // coach call carries a personaStyle instruction). Null = companion off.
  const [companionVoice, setCompanionVoice] = useState<string | null>(null);
  const attemptsRef = useRef(0);

  useEffect(() => {
    let alive = true;
    fetch("/api/companion/pack")
      .then((r) => r.json())
      .then((d: { manifest?: PackManifest; settings?: CompanionSettings }) => {
        if (!alive || !d?.settings?.enabled || !d.manifest) return;
        const p = d.manifest.pack;
        setCompanionVoice(
          `${p.persona}\nSpeech style: ${p.speechStyle}\nStart your message with exactly one expression tag from [${p.expressions.join("|")}], e.g. "[thinking] ...".`,
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    emitCompanionEvent({
      type: "problemOpen",
      title: problem.title,
      difficulty: problem.difficulty,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reward + variation
  const [reward, setReward] = useState(false);
  const [solvedMs, setSolvedMs] = useState<number | null>(null);
  const [variation, setVariation] = useState<string | null>(null);
  const variationStream = useClaudeStream();
  const [status, setStatus] = useState<ProblemStatus>(initialStatus);

  // Load statement
  useEffect(() => {
    if (!problem.leetcodeSlug) {
      // GFG-only: no API to hit — seed the AI context (stub/hints/coach/review)
      // with the curated statement so it reasons about the real problem.
      if (problem.statement) setStatementText(problem.statement);
      setLive(false);
      return;
    }
    let alive = true;
    fetch(`/api/problem?slug=${problem.leetcodeSlug}`)
      .then((r) => r.json())
      .then((p: { content: string | null; live: boolean }) => {
        if (!alive) return;
        setStatementHtml(p.content);
        setStatementText(stripHtml(p.content));
        setLive(p.live);
      })
      .catch(() => alive && setLive(false));
    return () => {
      alive = false;
    };
  }, [problem.leetcodeSlug, problem.statement]);

  const baseCtx = {
    problemTitle: problem.title,
    problemStatement: statementText || problem.title,
    difficulty: problem.difficulty,
    topic: problem.topic,
  };

  // Ask Claude for an empty, problem-specific signature stub and load it into the
  // editor (unless the learner already has work there).
  async function loadStub(lang: Language) {
    const text = await stubStream.run("stub", {
      problemTitle: problem.title,
      problemStatement: statementText || problem.title,
      difficulty: problem.difficulty,
      topic: problem.topic,
      language: lang,
    });
    const stub = extractCode(text);
    if (stub) {
      setCode(stub);
      lastStubRef.current = stub;
    } else {
      setCode(STARTER[lang]);
      lastStubRef.current = STARTER[lang];
    }
  }

  // Generate the stub once the statement has resolved (so it's accurate).
  useEffect(() => {
    if (live === null || stubRequestedRef.current) return;
    stubRequestedRef.current = true;
    loadStub(language);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  function changeLanguage(l: Language) {
    setLanguage(l);
    // Regenerate the stub for the new language only if the editor is untouched.
    const untouched =
      code.trim() === "" || code.trim() === lastStubRef.current.trim();
    if (untouched) loadStub(l);
  }

  // Track edits so the coach knows how long the learner has been idle (and the
  // companion stays quiet while the learner is actively typing).
  function handleCodeChange(v: string) {
    setCode(v);
    lastEditAtRef.current = Date.now();
    noteActivity();
  }

  // Ask Claude to rate this problem and set the coach's pacing (difficulty-aware).
  useEffect(() => {
    if (live === null) return;
    let alive = true;
    fetchClaudeJson<CoachPlan>("coachPlan", {
      problemTitle: problem.title,
      problemStatement: statementText || problem.title,
      difficulty: problem.difficulty,
      topic: problem.topic,
    }).then(({ data }) => {
      if (alive && data) coachPlanRef.current = data;
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  function showToast(preview: string) {
    setToast({ show: true, preview });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(
      () => setToast((t) => ({ ...t, show: false })),
      9000,
    );
  }

  function coachTranscript(msgs: typeof coachMessages) {
    return msgs.slice(-6).map((m) => ({
      role: m.role === "user" ? ("user" as const) : ("assistant" as const),
      content: m.text,
    }));
  }

  // Diff of the editor since the coach last spoke (empty on the first message).
  // Also advances the snapshot so the next coach turn diffs from here.
  function coachCodeDiff(): string {
    const prev = codeAtLastCoachRef.current;
    codeAtLastCoachRef.current = code;
    return prev === null ? "" : lineDiff(prev, code);
  }

  // A proactive, coach-initiated check-in.
  async function runCoach() {
    lastCoachAtRef.current = Date.now();
    const level = coachLevelRef.current;
    const img = whiteboardRef.current?.getImage();
    const recent = coachTranscript(coachMessages);
    const codeDiff = coachCodeDiff();
    const idx = coachMessages.length;
    setCoachMessages((m) => [...m, { role: "coach", text: "", at: Date.now() }]);
    const text = await coachStream.run(
      "coach",
      {
        ...baseCtx,
        code,
        language,
        ...(codeDiff ? { codeDiff } : {}),
        elapsedMinutes: timer.elapsed / 60000,
        idleSeconds: (Date.now() - lastEditAtRef.current) / 1000,
        coachLevel: level,
        intensity: intensity ?? "balanced",
        transcript: recent,
        ...(companionVoice ? { personaStyle: companionVoice } : {}),
        ...(img?.hasContent
          ? { imageBase64: img.base64, imageMediaType: "image/png" as const }
          : {}),
      },
      (full) =>
        setCoachMessages((m) => {
          const c = [...m];
          if (c[idx]) c[idx] = { ...c[idx], text: stripExprTag(full) };
          return c;
        }),
    );
    setCoachMessages((m) => {
      const c = [...m];
      if (c[idx]) c[idx] = { ...c[idx], text: stripExprTag(text) };
      return c;
    });
    coachLevelRef.current = level + 1;
    if (text) {
      setCoachUnread((u) => u + 1);
      // Companion enabled: the nudge speaks through her bubble (tag intact so
      // the widget can pick the matching expression). Otherwise: legacy toast.
      if (companionVoice) emitCompanionEvent({ type: "coachLine", text });
      else showToast(text);
    }
  }

  // The learner talking back to the coach.
  async function sendCoach() {
    const q = coachInput.trim();
    if (!q || coachStream.loading) return;
    setCoachInput("");
    setTab("coach");
    const img = whiteboardRef.current?.getImage();
    const withUser: typeof coachMessages = [
      ...coachMessages,
      { role: "user", text: q, at: Date.now() },
    ];
    setCoachMessages(withUser);
    const codeDiff = coachCodeDiff();
    const idx = withUser.length;
    setCoachMessages((m) => [...m, { role: "coach", text: "", at: Date.now() }]);
    const text = await coachStream.run(
      "coach",
      {
        ...baseCtx,
        code,
        language,
        ...(codeDiff ? { codeDiff } : {}),
        coachLevel: coachLevelRef.current,
        intensity: intensity ?? "balanced",
        transcript: coachTranscript(withUser),
        userMessage: q,
        ...(companionVoice ? { personaStyle: companionVoice } : {}),
        ...(img?.hasContent
          ? { imageBase64: img.base64, imageMediaType: "image/png" as const }
          : {}),
      },
      (full) =>
        setCoachMessages((m) => {
          const c = [...m];
          if (c[idx]) c[idx] = { ...c[idx], text: stripExprTag(full) };
          return c;
        }),
    );
    setCoachMessages((m) => {
      const c = [...m];
      if (c[idx]) c[idx] = { ...c[idx], text: stripExprTag(text) };
      return c;
    });
  }

  // The periodic watcher: decides when to drop a proactive nudge.
  function coachTick() {
    if (intensity === null || status === "solved" || !timer.running) return;
    if (
      coachStream.loading ||
      hintStream.loading ||
      reviewStream.loading ||
      askStream.loading ||
      stubStream.loading ||
      variationStream.loading
    )
      return;
    const { mult, minGapSec } = INTENSITY[intensity];
    const plan = coachPlanRef.current;
    const now = Date.now();
    const elapsedMin = timer.elapsed / 60000;
    const idleSec = (now - lastEditAtRef.current) / 1000;
    const sinceCoachSec = (now - lastCoachAtRef.current) / 1000;
    if (sinceCoachSec < minGapSec) return;

    const dueCheckpoint = plan.checkpointMinutes.find(
      (m) => elapsedMin >= m * mult && !firedCheckpointsRef.current.has(m),
    );
    const idleHit = idleSec >= plan.idleSeconds * mult;
    if (dueCheckpoint === undefined && !idleHit) return;
    if (dueCheckpoint !== undefined) firedCheckpointsRef.current.add(dueCheckpoint);
    runCoach();
  }

  // Always invoke the latest tick closure so it sees current state.
  const tickRef = useRef<() => void>(() => {});
  tickRef.current = coachTick;
  useEffect(() => {
    const id = setInterval(() => tickRef.current(), 10000);
    return () => clearInterval(id);
  }, []);

  function openCoach() {
    setTab("coach");
    setCoachUnread(0);
    setToast((t) => ({ ...t, show: false }));
  }

  async function getNextHint() {
    const level = Math.min(hints.length + 1, 5);
    setTab("hints");
    const placeholderIndex = hints.length;
    setHints((h) => [...h, { level, text: "" }]);
    const text = await hintStream.run("hint", { ...baseCtx, code, hintLevel: level }, (full) => {
      setHints((h) => {
        const copy = [...h];
        if (copy[placeholderIndex]) copy[placeholderIndex] = { level, text: full };
        return copy;
      });
    });
    setHints((h) => {
      const copy = [...h];
      copy[placeholderIndex] = { level, text };
      return copy;
    });
    postProgress({ action: "hint", problemId: problem.id });
    emitCompanionEvent({ type: "hint", title: problem.title, level });
  }

  async function getReview() {
    setVerdict(null);
    attemptsRef.current += 1;
    postProgress({ action: "attempt", problemId: problem.id });
    if (status === "unsolved") setStatus("attempted");
    const text = await reviewStream.run("review", { ...baseCtx, code, language });
    const m = text.match(/VERDICT:\s*(correct|suboptimal|incorrect|incomplete)/i);
    const v = (m?.[1]?.toLowerCase() as typeof verdict) ?? null;
    setVerdict(v);
    // Only an optimal, correct solution counts as solved. A working-but-suboptimal
    // one stays "attempted" and the review nudges toward the better approach.
    if (v === "correct") markSolved();
    else if (v) {
      emitCompanionEvent({
        type: "verdict",
        verdict: v,
        title: problem.title,
        attempts: attemptsRef.current,
      });
    }
  }

  function markSolved() {
    const ms = timer.elapsed;
    setSolvedMs(ms);
    setStatus("solved");
    timer.pause();
    postProgress({ action: "solved", problemId: problem.id, elapsedMs: ms });
    setReward(true);
    emitCompanionEvent({
      type: "solved",
      problemId: problem.id,
      title: problem.title,
      elapsedMs: ms,
      attempts: Math.max(attemptsRef.current, 1),
    });
  }

  async function getVariation() {
    setReward(false);
    setVariation("");
    timer.reset();
    timer.resume();
    // Fresh attempt → reset the coach's pacing so it watches the twist anew.
    lastEditAtRef.current = Date.now();
    lastCoachAtRef.current = 0;
    codeAtLastCoachRef.current = null;
    coachLevelRef.current = 0;
    firedCheckpointsRef.current = new Set();
    const text = await variationStream.run("variation", baseCtx);
    setVariation(text);
  }

  async function sendAsk() {
    const q = askInput.trim();
    if (!q) return;
    setAskInput("");
    setTab("ask");
    const newChat = [...chat, { role: "user" as const, content: q }];
    setChat(newChat);
    const idx = newChat.length;
    setChat((c) => [...c, { role: "assistant", content: "" }]);
    const text = await askStream.run(
      "ask",
      { ...baseCtx, code, transcript: newChat, userMessage: q },
      (full) =>
        setChat((c) => {
          const copy = [...c];
          copy[idx] = { role: "assistant", content: full };
          return copy;
        }),
    );
    setChat((c) => {
      const copy = [...c];
      copy[idx] = { role: "assistant", content: text };
      return copy;
    });
  }

  const chatBottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const coachBottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (tab === "coach") coachBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [coachMessages, tab]);

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-[1500px] flex-col px-4 py-3">
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Link href="/sheet" className="text-muted hover:text-foreground">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-semibold">{problem.title}</h1>
        <DifficultyBadge difficulty={problem.difficulty} />
        {status === "solved" && (
          <span className="flex items-center gap-1 text-xs text-emerald-400">
            <CheckCircle2 size={14} /> solved
          </span>
        )}
        <span className="text-xs text-muted">{problem.topic}</span>
        <div className="ml-auto flex items-center gap-3">
          <CoachControl
            intensity={intensity}
            onChange={(i) => {
              setIntensity(i);
              lastCoachAtRef.current = 0;
              lastEditAtRef.current = Date.now();
            }}
          />
          <TimerDisplay
            elapsed={timer.elapsed}
            running={timer.running}
            onToggle={timer.toggle}
            onReset={timer.reset}
          />
          {problem.leetcodeSlug && (
            <a
              href={leetcodeUrl(problem.leetcodeSlug)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs text-muted hover:text-foreground"
            >
              LeetCode <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* Left: info panel */}
        <div className="flex min-h-0 flex-col rounded-xl border border-border bg-card">
          <div className="flex border-b border-border text-sm">
            {(["statement", "hints", "coach", "board", "ask"] as const).map((t) => (
              <button
                key={t}
                onClick={() => (t === "coach" ? openCoach() : setTab(t))}
                className={cn(
                  "relative px-3.5 py-2.5 capitalize",
                  tab === t ? "border-b-2 border-accent text-accent" : "text-muted hover:text-foreground",
                )}
              >
                {t === "ask" ? "Ask Claude" : t === "board" ? "Whiteboard" : t}
                {t === "hints" && hints.length > 0 && (
                  <span className="ml-1 text-xs">({hints.length})</span>
                )}
                {t === "coach" && coachUnread > 0 && (
                  <span className="absolute right-1 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-black">
                    {coachUnread}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {tab === "statement" && (
              <StatementPanel
                html={statementHtml}
                text={statementText}
                live={live}
                isGfg={problem.source === "gfg"}
                curated={problem.statement}
                slug={problem.leetcodeSlug}
              />
            )}

            {tab === "hints" && (
              <div className="space-y-3">
                <p className="text-xs text-muted">
                  Hints escalate gently. They&apos;ll never hand you the answer.
                </p>
                {hints.map((h, i) => (
                  <div key={i} className="rounded-lg border border-border bg-background/40 p-3">
                    <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-amber-400">
                      <Lightbulb size={13} /> Level {h.level} · {HINT_LABELS[h.level]}
                    </div>
                    {h.text ? (
                      <Markdown>{h.text}</Markdown>
                    ) : (
                      <Loader2 size={14} className="animate-spin text-muted" />
                    )}
                  </div>
                ))}
                {hints.length < 5 ? (
                  <Button variant="outline" onClick={getNextHint} disabled={hintStream.loading}>
                    {hintStream.loading ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Lightbulb size={14} />
                    )}
                    {hints.length === 0 ? "Get a hint" : "Get a bigger hint"}
                  </Button>
                ) : (
                  <p className="text-xs text-muted">
                    That&apos;s the last hint — you&apos;ve got this. Try the editor.
                  </p>
                )}
              </div>
            )}

            {tab === "coach" && (
              <div className="flex h-full flex-col">
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
                  {intensity === null ? (
                    <p className="text-xs text-muted">
                      Pick a coach intensity (top-right) and the interviewer will
                      start watching — checking in with questions and subtle
                      nudges if you stall. You can also message it any time below.
                    </p>
                  ) : (
                    <p className="text-xs text-muted">
                      Your live coach is watching ({INTENSITY[intensity].label}).
                      It speaks up on its own — and you can talk back below.
                    </p>
                  )}
                  {coachMessages.length === 0 && (
                    <p className="text-xs text-muted">
                      No messages yet. Keep working, or ask the coach something.
                    </p>
                  )}
                  {coachMessages.map((m, i) => (
                    <div
                      key={i}
                      className={cn(
                        "rounded-lg border p-3",
                        m.role === "user"
                          ? "border-border bg-background/40"
                          : "border-accent/20 bg-accent/5",
                      )}
                    >
                      <div
                        className={cn(
                          "mb-1 flex items-center gap-1.5 text-xs font-medium",
                          m.role === "user" ? "text-muted" : "text-accent",
                        )}
                      >
                        {m.role === "user" ? "You" : (<><MessageCircle size={13} /> Coach</>)}
                      </div>
                      {m.text ? (
                        <Markdown>{m.text}</Markdown>
                      ) : (
                        <Loader2 size={14} className="animate-spin text-muted" />
                      )}
                    </div>
                  ))}
                  <div ref={coachBottomRef} />
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    value={coachInput}
                    onChange={(e) => setCoachInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendCoach()}
                    placeholder="Message your coach…"
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent/50"
                  />
                  <Button onClick={sendCoach} disabled={coachStream.loading}>
                    <Send size={14} />
                  </Button>
                </div>
              </div>
            )}

            {/* Whiteboard stays mounted so the sketch persists and the coach can
                read it even while another tab is open. */}
            <div className={cn("h-full", tab === "board" ? "block" : "hidden")}>
              <Whiteboard ref={whiteboardRef} />
            </div>

            {tab === "ask" && (
              <div className="flex h-full flex-col">
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
                  {chat.length === 0 && (
                    <p className="text-xs text-muted">
                      Ask anything about this problem — approach, edge cases, a
                      concept. Claude won&apos;t just give you the answer.
                    </p>
                  )}
                  {chat.map((m, i) => (
                    <div
                      key={i}
                      className={cn(
                        "rounded-lg border p-3",
                        m.role === "user"
                          ? "border-accent/30 bg-accent/5"
                          : "border-border bg-background/40",
                      )}
                    >
                      <div className="mb-1 text-[11px] uppercase tracking-wide text-muted">
                        {m.role === "user" ? "You" : "Claude"}
                      </div>
                      {m.content ? (
                        <Markdown>{m.content}</Markdown>
                      ) : (
                        <Loader2 size={14} className="animate-spin text-muted" />
                      )}
                    </div>
                  ))}
                  <div ref={chatBottomRef} />
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    value={askInput}
                    onChange={(e) => setAskInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendAsk()}
                    placeholder="Ask about this problem…"
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent/50"
                  />
                  <Button onClick={sendAsk} disabled={askStream.loading}>
                    <Send size={14} />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: editor + review */}
        <div className="flex min-h-0 flex-col gap-3">
          <div className="flex items-center gap-2">
            <select
              value={language}
              onChange={(e) => changeLanguage(e.target.value as Language)}
              className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm outline-none"
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {LANG_LABELS[l]}
                </option>
              ))}
            </select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadStub(language)}
              disabled={stubStream.loading}
              title="Regenerate the empty starter stub for this problem"
            >
              {stubStream.loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <FileCode2 size={14} />
              )}
              {stubStream.loading ? "Writing stub…" : "Reset stub"}
            </Button>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={getReview} disabled={reviewStream.loading}>
                {reviewStream.loading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <ClipboardCheck size={14} />
                )}
                Get review
              </Button>
              <Button variant="success" onClick={markSolved}>
                <CheckCircle2 size={14} /> I solved it
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border">
            <CodeEditor value={code} onChange={handleCodeChange} language={language} />
          </div>

          {(reviewStream.text || reviewStream.loading || variation) && (
            <div className="max-h-[40%] shrink-0 overflow-y-auto rounded-xl border border-border bg-card p-4">
              {variation ? (
                <>
                  <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-accent">
                    <Sparkles size={15} /> Your twist
                  </div>
                  {variation ? (
                    <Markdown>{variation}</Markdown>
                  ) : (
                    <Loader2 size={14} className="animate-spin text-muted" />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => setVariation(null)}
                  >
                    Dismiss
                  </Button>
                </>
              ) : (
                <>
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <ClipboardCheck size={15} /> Review
                    {verdict && (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px]",
                          verdict === "correct"
                            ? "bg-emerald-400/15 text-emerald-400"
                            : verdict === "suboptimal"
                              ? "bg-sky-400/15 text-sky-400"
                              : "bg-amber-400/15 text-amber-400",
                        )}
                      >
                        {verdict}
                      </span>
                    )}
                  </div>
                  {verdict === "suboptimal" && (
                    <p className="mb-2 rounded-md border border-sky-400/30 bg-sky-400/5 px-2 py-1 text-xs text-sky-300">
                      It works — but there&apos;s a more optimal solution, so it&apos;s
                      not marked solved yet. Use the nudges below to improve it, then
                      re-run the review.
                    </p>
                  )}
                  <Markdown>{reviewStream.text}</Markdown>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <RewardBurst
        show={reward}
        elapsedMs={solvedMs}
        onTwist={getVariation}
        onNext={nextId ? () => router.push(`/problem/${nextId}`) : undefined}
        onClose={() => setReward(false)}
      />

      <CoachToast
        show={toast.show && tab !== "coach"}
        preview={toast.preview}
        onOpen={openCoach}
        onClose={() => setToast((t) => ({ ...t, show: false }))}
      />
    </div>
  );
}

function CoachControl({
  intensity,
  onChange,
}: {
  intensity: CoachIntensity | null;
  onChange: (i: CoachIntensity) => void;
}) {
  const options: CoachIntensity[] = ["gentle", "balanced", "assertive"];
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-lg border bg-card p-0.5",
        intensity === null ? "border-accent/60 ring-1 ring-accent/40" : "border-border",
      )}
      title="How closely should the live coach watch you?"
    >
      <MessageCircle size={13} className="ml-1 text-muted" />
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={cn(
            "rounded-md px-2 py-1 text-[11px] capitalize transition-colors",
            intensity === o
              ? "bg-accent text-black"
              : "text-muted hover:text-foreground",
          )}
        >
          {INTENSITY[o].label}
        </button>
      ))}
    </div>
  );
}

function StatementPanel({
  html,
  text,
  live,
  isGfg,
  curated,
  slug,
}: {
  html: string | null;
  text: string;
  live: boolean | null;
  isGfg: boolean;
  curated: string | null;
  slug: string | null;
}) {
  if (isGfg) {
    if (curated) {
      return (
        <div className="lc-statement">
          <Markdown>{curated}</Markdown>
        </div>
      );
    }
    return (
      <div className="text-sm text-muted">
        <p>
          This is a GeeksforGeeks-style problem from the sheet. Read the full
          statement on GfG, then solve it here with hints, review, and the
          interviewer.
        </p>
      </div>
    );
  }
  if (live === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted">
        <Loader2 size={14} className="animate-spin" /> Loading statement…
      </div>
    );
  }
  if (html) {
    return (
      <>
        {live === false && (
          <p className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-300">
            Showing a cached/offline view — the LeetCode API was unreachable.
          </p>
        )}
        <div className="lc-statement" dangerouslySetInnerHTML={{ __html: html }} />
      </>
    );
  }
  return (
    <div className="text-sm text-muted">
      <p className="mb-2">
        Couldn&apos;t load the statement from the API right now.
      </p>
      {slug && (
        <a
          className="text-accent underline"
          href={`https://leetcode.com/problems/${slug}/`}
          target="_blank"
          rel="noreferrer"
        >
          Open it on LeetCode
        </a>
      )}
      {text && <div className="mt-3 whitespace-pre-wrap">{text}</div>}
    </div>
  );
}
