// Line playback: the single seam between "the character says something" and
// how it is delivered. v1 always uses the text-reveal driver (timed reveal +
// procedural mouth-flap). The phase-2 voice path plugs in HERE and nowhere
// else: when the pack's voice cache has audio for a line (voice/<hash>.wav,
// hash = first 16 hex of sha256(text)), playback switches to the audio driver
// and the mouth follows real amplitude — the sprite and bubble never know
// which driver ran.

export interface PlaybackHandlers {
  /** Full revealed-so-far text (monotonically growing). */
  onText: (revealed: string) => void;
  onMouth: (open: boolean) => void;
  onDone: () => void;
}

export interface LinePlayback {
  /** Feed the accumulated line text (call repeatedly while an LLM streams). */
  push(fullText: string): void;
  /** Signal that no more text is coming. */
  finish(): void;
  cancel(): void;
}

const REVEAL_CHARS_PER_SEC = 32;
const TICK_MS = 60;

/** Deterministic per-line audio-cache name (phase 2). */
export async function lineAudioName(text: string, format: string): Promise<string> {
  const data = new TextEncoder().encode(text.trim());
  const digest = await crypto.subtle.digest("SHA-256", data);
  const hex = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 16)}.${format}`;
}

/**
 * Text-reveal driver: reveals ~32 chars/s in word chunks, toggling the mouth
 * open/closed on a randomized 80–140ms cadence while text remains, closing at
 * sentence punctuation for a beat.
 */
export function createTextReveal(handlers: PlaybackHandlers): LinePlayback {
  let target = "";
  let revealed = 0;
  let finished = false;
  let cancelled = false;
  let mouthOpen = false;
  let mouthTimer: ReturnType<typeof setTimeout> | null = null;
  let tickTimer: ReturnType<typeof setInterval> | null = null;

  const setMouth = (open: boolean) => {
    if (cancelled || open === mouthOpen) return;
    mouthOpen = open;
    handlers.onMouth(open);
  };

  const scheduleMouth = () => {
    if (cancelled) return;
    mouthTimer = setTimeout(() => {
      const speaking = revealed < target.length || !finished;
      if (speaking) {
        setMouth(!mouthOpen);
        scheduleMouth();
      } else {
        setMouth(false);
      }
    }, 80 + Math.random() * 60);
  };

  const stopAll = () => {
    if (mouthTimer) clearTimeout(mouthTimer);
    if (tickTimer) clearInterval(tickTimer);
    mouthTimer = null;
    tickTimer = null;
  };

  const tick = () => {
    if (cancelled) return;
    if (revealed >= target.length) {
      if (finished) {
        stopAll();
        setMouth(false);
        handlers.onDone();
      }
      return;
    }
    // Advance by the per-tick budget, extended to the end of the current word.
    let next = Math.min(
      target.length,
      revealed + Math.max(1, Math.round((REVEAL_CHARS_PER_SEC * TICK_MS) / 1000)),
    );
    while (next < target.length && !/\s/.test(target[next])) next++;
    revealed = next;
    handlers.onText(target.slice(0, revealed));
    // Close the mouth for a beat at sentence punctuation.
    const last = target[revealed - 1];
    if (last && /[.!?…]/.test(last)) setMouth(false);
  };

  tickTimer = setInterval(tick, TICK_MS);
  scheduleMouth();

  return {
    push(fullText: string) {
      if (cancelled) return;
      if (fullText.length > target.length) target = fullText;
    },
    finish() {
      finished = true;
    },
    cancel() {
      cancelled = true;
      stopAll();
      setMouth(false);
    },
  };
}

/**
 * Phase-2 audio driver: plays a cached WAV and drives the mouth from live
 * amplitude. Falls back to the caller's text-reveal if the clip can't play.
 * (Unused in v1 — packs ship with voice.enabled = false.)
 */
export function createAudioPlayback(
  url: string,
  fullText: string,
  handlers: PlaybackHandlers,
): LinePlayback {
  let cancelled = false;
  const audio = new Audio(url);
  let raf = 0;
  let ctx: AudioContext | null = null;

  handlers.onText(fullText); // audio path shows the whole line immediately

  const start = async () => {
    try {
      ctx = new AudioContext();
      const src = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        if (cancelled) return;
        analyser.getByteTimeDomainData(buf);
        let peak = 0;
        for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
        handlers.onMouth(peak > 12);
        raf = requestAnimationFrame(loop);
      };
      audio.onended = () => {
        cancelAnimationFrame(raf);
        handlers.onMouth(false);
        handlers.onDone();
      };
      await audio.play();
      loop();
    } catch {
      handlers.onMouth(false);
      handlers.onDone();
    }
  };
  void start();

  return {
    push() {}, // audio lines are always complete text
    finish() {},
    cancel() {
      cancelled = true;
      cancelAnimationFrame(raf);
      audio.pause();
      void ctx?.close().catch(() => {});
      handlers.onMouth(false);
    },
  };
}

/**
 * Resolve the right driver for a complete line: cached audio when the pack has
 * voice enabled and the clip exists, text-reveal otherwise. Streaming LLM lines
 * always use text-reveal directly (audio can't exist for novel text yet).
 */
export async function playCompleteLine(
  text: string,
  pack: { voiceEnabled: boolean; voiceBase: string; voiceFormat: string },
  handlers: PlaybackHandlers,
): Promise<LinePlayback> {
  if (pack.voiceEnabled) {
    try {
      const name = await lineAudioName(text, pack.voiceFormat);
      const url = `${pack.voiceBase}/${name}`;
      const head = await fetch(url, { method: "HEAD" });
      if (head.ok) return createAudioPlayback(url, text, handlers);
    } catch {
      // fall through to text reveal
    }
  }
  const playback = createTextReveal(handlers);
  playback.push(text);
  playback.finish();
  return playback;
}
