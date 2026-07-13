"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send, RefreshCw, MessageSquareCode } from "lucide-react";
import { Button, DifficultyBadge } from "@/components/ui";
import { Markdown } from "@/components/Markdown";
import { useClaudeStream } from "@/lib/useClaudeStream";
import { ALL_PROBLEMS } from "@/lib/data/striverSheet";
import { cn } from "@/lib/utils";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

function stripHtml(html: string | null): string {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
}

export default function InterviewPage() {
  const [problem, setProblem] = useState<(typeof ALL_PROBLEMS)[number] | null>(null);
  const [statement, setStatement] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const stream = useClaudeStream();
  const bottomRef = useRef<HTMLDivElement>(null);

  function pickProblem() {
    const lcProblems = ALL_PROBLEMS.filter((p) => p.leetcodeSlug);
    return lcProblems[Math.floor(Math.random() * lcProblems.length)];
  }

  async function startInterview(p: (typeof ALL_PROBLEMS)[number]) {
    setProblem(p);
    setMessages([]);
    setStatement("");
    let stmt = "";
    if (p.leetcodeSlug) {
      try {
        const res = await fetch(`/api/problem?slug=${p.leetcodeSlug}`);
        const data = await res.json();
        stmt = stripHtml(data.content).slice(0, 3000);
        setStatement(stmt);
      } catch {
        /* ignore */
      }
    }
    setMessages([{ role: "assistant", content: "" }]);
    const text = await stream.run(
      "interview",
      { problemTitle: p.title, problemStatement: stmt || p.title, difficulty: p.difficulty, topic: p.topic, transcript: [] },
      (full) => setMessages([{ role: "assistant", content: full }]),
    );
    setMessages([{ role: "assistant", content: text }]);
  }

  useEffect(() => {
    startInterview(pickProblem());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const q = input.trim();
    if (!q || !problem || stream.loading) return;
    setInput("");
    const newMsgs = [...messages, { role: "user" as const, content: q }];
    setMessages(newMsgs);
    const idx = newMsgs.length;
    setMessages((m) => [...m, { role: "assistant", content: "" }]);
    const text = await stream.run(
      "interview",
      {
        problemTitle: problem.title,
        problemStatement: statement || problem.title,
        difficulty: problem.difficulty,
        topic: problem.topic,
        transcript: newMsgs,
        userMessage: q,
      },
      (full) =>
        setMessages((m) => {
          const copy = [...m];
          copy[idx] = { role: "assistant", content: full };
          return copy;
        }),
    );
    setMessages((m) => {
      const copy = [...m];
      copy[idx] = { role: "assistant", content: text };
      return copy;
    });
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-3xl flex-col px-4 py-4">
      <div className="mb-3 flex items-center gap-2">
        <MessageSquareCode className="text-accent" size={20} />
        <h1 className="text-lg font-semibold">Mock Interview</h1>
        {problem && (
          <>
            <span className="text-sm text-muted">· {problem.title}</span>
            <DifficultyBadge difficulty={problem.difficulty} />
          </>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => startInterview(pickProblem())}
          disabled={stream.loading}
        >
          <RefreshCw size={13} /> New problem
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl border border-border bg-card p-4">
        {messages.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader2 size={14} className="animate-spin" /> Setting up your interview…
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[85%] rounded-2xl px-4 py-2.5",
              m.role === "user"
                ? "ml-auto bg-accent/15 text-foreground"
                : "bg-background/60",
            )}
          >
            <div className="mb-1 text-[11px] uppercase tracking-wide text-muted">
              {m.role === "user" ? "You" : "Interviewer"}
            </div>
            {m.content ? (
              <Markdown>{m.content}</Markdown>
            ) : (
              <Loader2 size={14} className="animate-spin text-muted" />
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="mt-3 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          placeholder="Explain your approach, ask a clarifying question, or paste pseudocode…"
          className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent/50"
        />
        <Button onClick={send} disabled={stream.loading}>
          {stream.loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        </Button>
      </div>
    </div>
  );
}
