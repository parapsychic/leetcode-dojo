"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui";
import { formatMs } from "@/lib/utils";
import { PartyPopper, Wand2, ArrowRight } from "lucide-react";

function fire() {
  const end = Date.now() + 900;
  const colors = ["#7c93ff", "#34d399", "#fbbf24"];
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 70, origin: { x: 0 }, colors });
    confetti({ particleCount: 4, angle: 120, spread: 70, origin: { x: 1 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
  confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 }, colors });
}

export function RewardBurst({
  show,
  elapsedMs,
  onTwist,
  onNext,
  onClose,
}: {
  show: boolean;
  elapsedMs: number | null;
  onTwist: () => void;
  onNext?: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (show) fire();
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-sm rounded-2xl border border-emerald-400/30 bg-card p-6 text-center"
            initial={{ scale: 0.8, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-emerald-400/15 text-emerald-400"
              animate={{ rotate: [0, -12, 12, 0] }}
              transition={{ duration: 0.6 }}
            >
              <PartyPopper size={28} />
            </motion.div>
            <h2 className="text-xl font-semibold">Solved! 🎉</h2>
            <p className="mt-1 text-sm text-muted">
              Nice work. {elapsedMs != null && <>You took {formatMs(elapsedMs)}.</>}{" "}
              The real win is that you understand it.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <Button variant="primary" onClick={onTwist}>
                <Wand2 size={15} /> Now solve it again with a twist
              </Button>
              {onNext && (
                <Button variant="outline" onClick={onNext}>
                  Next problem <ArrowRight size={15} />
                </Button>
              )}
              <Button variant="ghost" onClick={onClose}>
                Keep refining
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
