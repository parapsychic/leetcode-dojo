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
  // Every image — bases AND variants — stays permanently mounted, so nothing
  // ever needs a decode pass mid-animation (a freshly-mounted <img> paints
  // blank for a frame or two, which read as a black flicker on each blink).
  // Bases crossfade (180ms) between expressions; variant overlays swap with
  // NO transition — a blink is an instant swap, not a fade — and simply draw
  // on top of the base (same canvas, so they cover the eyes/mouth region).
  // Priority: blink wins over mouth (it lasts 130ms; flapping resumes after).
  const img = "absolute inset-0 h-full w-full object-contain object-bottom";
  return (
    <div className="relative h-44 w-40 select-none">
      {Object.entries(sprites).map(([expr, sv]) => {
        const isActive = expr === active;
        const showEyes = isActive && blinking && Boolean(sv.eyesClosed);
        const showMouth = isActive && !showEyes && mouthOpen && Boolean(sv.mouthOpen);
        return (
          <div key={expr}>
            {sv.base && (
              <motion.img
                src={sv.base}
                alt=""
                draggable={false}
                initial={false}
                animate={{ opacity: isActive ? 1 : 0 }}
                transition={{ duration: 0.18 }}
                className={img}
              />
            )}
            {sv.eyesClosed && (
              // eslint-disable-next-line @next/next/no-img-element -- local pack sprite
              <img
                src={sv.eyesClosed}
                alt=""
                draggable={false}
                className={img}
                style={{ opacity: showEyes ? 1 : 0 }}
              />
            )}
            {sv.mouthOpen && (
              // eslint-disable-next-line @next/next/no-img-element -- local pack sprite
              <img
                src={sv.mouthOpen}
                alt=""
                draggable={false}
                className={img}
                style={{ opacity: showMouth ? 1 : 0 }}
              />
            )}
          </div>
        );
      })}
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
