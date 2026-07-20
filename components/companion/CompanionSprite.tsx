"use client";

// VN-style sprite renderer: stacked pre-mounted expression images with a soft
// crossfade, a random blink loop (eyes-closed variant), procedural idle
// sway/breathing, and a mouth-flap overlay driven from the line playback.
// Missing art degrades gracefully: absent variants are skipped, an absent base
// falls back to the default expression, and with no sprites at all a styled
// avatar chip renders so the whole feature works before any art is dropped in.

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { SpriteVariants } from "@/lib/companion/pack";

interface Props {
  sprites: Record<string, SpriteVariants>;
  defaultExpression: string;
  characterName: string;
  expression: string;
  mouthOpen: boolean;
  onClick?: () => void;
}

const BLINK_MS = 130;
const BLINK_MIN_GAP_MS = 2500;
const BLINK_MAX_GAP_MS = 6500;

export function CompanionSprite({
  sprites,
  defaultExpression,
  characterName,
  expression,
  mouthOpen,
  onClick,
}: Props) {
  const [blinking, setBlinking] = useState(false);
  const lastExprChangeRef = useRef(0);
  useEffect(() => {
    lastExprChangeRef.current = Date.now();
  }, [expression]);

  const active = sprites[expression]?.base ? expression : defaultExpression;
  const variants = sprites[active];

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(
        () => {
          if (!alive) return;
          // Skip the blink right after an expression change (it reads as a glitch).
          if (Date.now() - lastExprChangeRef.current > 400) {
            setBlinking(true);
            setTimeout(() => alive && setBlinking(false), BLINK_MS);
          }
          schedule();
        },
        BLINK_MIN_GAP_MS + Math.random() * (BLINK_MAX_GAP_MS - BLINK_MIN_GAP_MS),
      );
    };
    schedule();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  const sway = (
    <motion.div
      animate={{ y: [0, -3, 0], rotate: [0, 0.6, 0, -0.6, 0], scaleY: [1, 1.008, 1] }}
      transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
      style={{ transformOrigin: "50% 100%" }}
      className="relative"
    >
      {variants?.base ? (
        <SpriteStack
          sprites={sprites}
          active={active}
          blinking={blinking}
          mouthOpen={mouthOpen}
        />
      ) : (
        <AvatarChip name={characterName} />
      )}
    </motion.div>
  );

  return (
    <button
      onClick={onClick}
      aria-label={`${characterName} — companion`}
      className="block cursor-pointer border-0 bg-transparent p-0"
    >
      {sway}
    </button>
  );
}

function SpriteStack({
  sprites,
  active,
  blinking,
  mouthOpen,
}: {
  sprites: Record<string, SpriteVariants>;
  active: string;
  blinking: boolean;
  mouthOpen: boolean;
}) {
  const v = sprites[active];
  // Overlay priority: blink wins over mouth (it lasts 130ms; flapping resumes after).
  const overlay =
    blinking && v.eyesClosed ? v.eyesClosed : mouthOpen && v.mouthOpen ? v.mouthOpen : null;

  return (
    <div className="relative h-44 w-40 select-none">
      {/* All expression bases stay mounted (pre-loaded) and crossfade via opacity. */}
      {Object.entries(sprites).map(([expr, sv]) =>
        sv.base ? (
          <motion.img
            key={expr}
            src={sv.base}
            alt=""
            draggable={false}
            initial={false}
            animate={{ opacity: expr === active && !overlay ? 1 : 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 h-full w-full object-contain object-bottom"
          />
        ) : null,
      )}
      {overlay && (
        // eslint-disable-next-line @next/next/no-img-element -- local pack sprite; next/image adds nothing for tiny local PNGs
        <img
          src={overlay}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-contain object-bottom"
        />
      )}
    </div>
  );
}

function AvatarChip({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      className="grid h-16 w-16 place-items-center rounded-full border border-accent/40 bg-linear-to-br from-accent/30 to-card text-xl font-semibold text-accent shadow-lg"
      title={`${name} (drop sprite PNGs into public/characters to see her)`}
    >
      {initial}
    </div>
  );
}
