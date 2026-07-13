# LeetCode Trainer

A Socratic DSA-interview trainer that runs **locally** and uses **your Claude Code
subscription** (no API key) as the tutor/interviewer. It follows Striver's SDE
Sheet, pulls problem data from the alfa-leetcode-api, and helps you _understand_
problems instead of memorizing them.

## What it does

- **Solve view** — Striver SDE Sheet browser, Monaco editor, a timer, **escalating
  Socratic hints** (5 levels, never the full answer), and a **code review** that
  points out where your thinking is wrong without rewriting your solution.
- **Visual learning** — re-learn any topic with explanations and **animated
  visualizations** (arrays, linked lists, trees, graphs, recursion, DP tables)
  generated on demand, plus concept quizzes.
- **Mock interview** — a live AI interviewer that presents a problem, probes your
  approach, challenges wrong assumptions, and proposes a twist when you solve it.
- **Rewards** — confetti + congratulations on a solve, best-time tracking, day
  streaks, and a "solve it again with a twist" loop.

The "never give the full answer" rule is enforced both in the prompts and by a
server-side streaming guard that caps code in guarded responses.

## Requirements

- **Node 20+** and **Claude Code installed and logged in** (`claude` works in your
  terminal — run `/login` inside Claude Code if needed).
- **No `ANTHROPIC_API_KEY`** set — the app authenticates through your local Claude
  Code session via `@anthropic-ai/claude-agent-sdk`. If a key is set it would be
  used instead; unset it to use your subscription.

## Run it

### Web (fastest iteration)

```bash
npm install
npm run dev
# open http://localhost:3000
```

### Desktop (Electron)

```bash
npm run electron:dev      # runs next dev + opens the desktop window
```

## Build the desktop app

```bash
npm run build             # produces the standalone Next server (.next/standalone)
npm run electron:build    # builds the Windows installer into dist-electron/
```

The bundled desktop app starts the production Next server (which runs all API
routes — Claude, the LeetCode proxy, and the JSON progress store) and loads it in
a window. Progress is stored per-user in Electron's `userData` directory.

### Windows packaging notes

- electron-builder downloads a code-signing toolchain whose archive contains
  macOS symlinks; creating symlinks on Windows needs **Developer Mode** or an
  **Administrator** terminal. If `electron:build` fails on
  `Cannot create symbolic link`, enable Developer Mode (Settings → For developers)
  or run the build from an elevated terminal once.
- To build just the runnable app folder without an installer (no signing toolchain):
  `npx electron-builder --win --dir` → `dist-electron/win-unpacked/dx dbye.exe`.
- The installer doesn't bundle Claude Code — it's a separate dependency that
  provides the auth and model. The in-app banner tells you if your session is
  unavailable.

## Architecture

- `lib/claude/` — Agent SDK wrapper (`client.ts`), per-mode system prompts
  (`prompts.ts`), zod schemas for visualizations/quizzes (`schemas.ts`), and the
  no-full-answer streaming guard (`guard.ts`).
- `app/api/claude/route.ts` — streams text for conversational modes; validates and
  returns JSON for structured modes (`quiz`, `visualize`). Identical requests are
  served from an on-disk cache (`lib/cache/`) so repeated learning/stub/review/hint
  calls don't re-hit the model — except the live `interview` and `coach` modes,
  which are always fresh.
- `app/api/problem/route.ts` — cached proxy over the alfa-leetcode-api with a
  graceful offline fallback. Responses are persisted to disk (`lib/cache/`) and
  served stale on a fetch failure, so rate limits/outages don't break the view.
- `lib/data/striverSheet.ts` — the curated Striver SDE Sheet (problems → topics,
  difficulty, LeetCode slugs).
- `lib/store/progress.ts` — JSON file progress store (no native deps).
- `components/viz/` — the visualization renderers + `VizPlayer`.
- `electron/` — the desktop shell (`main.js` boots the standalone server;
  `preload.js` is a minimal contextIsolated bridge).
