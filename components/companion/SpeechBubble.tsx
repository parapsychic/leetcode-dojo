"use client";

// The companion's chat panel: the running conversation (her lines type
// themselves out; yours appear instantly), a one-line reply input, and
// minimize/clear controls. Collapsing is the widget's job — this component
// only reports input focus so auto-collapse can hold off while you're typing.

import { AnimatePresence, motion } from "framer-motion";
import { CornerDownLeft, Eraser, Minus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { CompanionMessage } from "@/lib/companion/useCompanionBrain";

interface Props {
  visible: boolean;
  messages: CompanionMessage[];
  thinking: boolean;
  characterName: string;
  onSend: (message: string) => void;
  onMinimize: () => void;
  onClear: () => void;
  onInputFocusChange: (focused: boolean) => void;
}

export function SpeechBubble({
  visible,
  messages,
  thinking,
  characterName,
  onSend,
  onMinimize,
  onClear,
  onInputFocusChange,
}: Props) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessage = messages[messages.length - 1];

  // Follow the conversation as it grows and as her line types itself out.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, lastMessage?.text, thinking, visible]);

  const send = () => {
    if (!draft.trim()) return;
    onSend(draft);
    setDraft("");
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          className="flex w-80 max-w-[calc(100vw-2.5rem)] flex-col rounded-xl border border-accent/40 bg-card p-3 shadow-xl"
        >
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-accent">
            {characterName}
            {messages.length > 0 && (
              <button
                onClick={onClear}
                className="ml-auto text-muted hover:text-foreground"
                aria-label="Clear conversation"
                title="Clear conversation"
              >
                <Eraser size={12} />
              </button>
            )}
            <button
              onClick={onMinimize}
              className={cn("text-muted hover:text-foreground", messages.length === 0 && "ml-auto")}
              aria-label="Minimize companion"
            >
              <Minus size={13} />
            </button>
          </div>

          {messages.length === 0 && !thinking && (
            <p className="mb-2 text-xs italic text-muted">
              Nothing said yet — start the conversation.
            </p>
          )}

          {(messages.length > 0 || thinking) && (
            <div
              ref={scrollRef}
              className="mb-2 max-h-64 space-y-2 overflow-y-auto overscroll-contain pr-0.5"
            >
              {messages.map((m) =>
                m.role === "assistant" ? (
                  <p
                    key={m.id}
                    className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90"
                  >
                    {m.text}
                  </p>
                ) : (
                  <p
                    key={m.id}
                    className="ml-6 whitespace-pre-wrap rounded-lg bg-accent/10 px-2.5 py-1.5 text-right text-xs leading-relaxed text-foreground/80"
                  >
                    {m.text}
                  </p>
                ),
              )}
              {thinking && <ThinkingDots />}
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
              onFocus={() => onInputFocusChange(true)}
              onBlur={() => onInputFocusChange(false)}
              placeholder={`Reply to ${characterName.split(" ")[0]}…`}
              maxLength={280}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-accent/50"
            />
            <button
              onClick={send}
              aria-label="Send reply"
              className="rounded-lg border border-border p-1.5 text-muted hover:border-accent/40 hover:text-accent"
            >
              <CornerDownLeft size={13} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ThinkingDots() {
  return (
    <span className="inline-flex gap-0.5 align-middle">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
          className="text-muted"
        >
          •
        </motion.span>
      ))}
    </span>
  );
}
