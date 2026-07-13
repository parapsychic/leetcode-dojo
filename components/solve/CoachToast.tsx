"use client";

import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, X } from "lucide-react";

/**
 * A brief floating card announcing a new proactive coach check-in, without
 * stealing focus from the editor. Clicking it jumps to the Coach panel.
 */
export function CoachToast({
  show,
  preview,
  onOpen,
  onClose,
}: {
  show: boolean;
  preview: string;
  onOpen: () => void;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          className="fixed bottom-5 right-5 z-50 w-80 max-w-[calc(100vw-2.5rem)] rounded-xl border border-accent/40 bg-card p-3 shadow-xl"
        >
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-accent">
            <MessageCircle size={13} /> Coach
            <button
              onClick={onClose}
              className="ml-auto text-muted hover:text-foreground"
              aria-label="Dismiss"
            >
              <X size={13} />
            </button>
          </div>
          <button onClick={onOpen} className="block w-full text-left">
            <p className="line-clamp-3 text-sm text-foreground/90">{preview}</p>
            <span className="mt-1 inline-block text-[11px] text-accent">
              Open Coach →
            </span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
