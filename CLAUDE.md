@AGENTS.md

# LeetCode Dojo (`leetcode-dojo`)

A locally-run, Socratic DSA-interview trainer. It follows Striver's SDE Sheet and,
crucially, uses **your local Claude Code session as the default LLM** (via
`@anthropic-ai/claude-agent-sdk`) — no API key, no database, no accounts. Everything
persists as local JSON. It also ships as an Electron desktop app.

The pedagogy is the point: the tutor **never gives the full answer**. That rule is
enforced twice — in the prompts and by a server-side streaming guard.

## Run it

- `npm run dev` — web dev server at http://localhost:3000 (fastest loop).
- `npm run electron:dev` — dev server + desktop window.
- `npm run build` / `npm start` — standalone production build.
- `npm run lint` — ESLint. There is no test suite; verify by driving the app.

Requirements: Node 20+, Claude Code installed and logged in, and
**`ANTHROPIC_API_KEY` must be unset** so the Agent SDK uses your subscription
(a set key would be used instead of the session).

> This is Next.js 16 (App Router, Turbopack, `output: "standalone"`). It has
> breaking changes vs. training data — see @AGENTS.md and read
> `node_modules/next/dist/docs/` before writing framework code.

## Layout

- `app/` — App Router pages + API routes. Pages: dashboard (`page.tsx`), `sheet/`,
  `problem/[id]/`, `learn/`, `interview/`, `discover/`, `settings/`.
- `components/` — UI. The core is `solve/SolveView.tsx`; shared primitives in `ui.tsx`.
- `lib/claude/` — prompt construction (`prompts.ts`), zod schemas (`schemas.ts`),
  and the no-full-answer streaming guard (`guard.ts`). This layer is **provider-agnostic**.
- `lib/ai/` — the AI provider abstraction and fallback engine (see below).
- `lib/store/` — the JSON progress store (`progress.ts`) and data-dir resolution (`paths.ts`).
- `lib/cache/diskCache.ts` — generic namespaced JSON disk cache (hashed keys).
- `lib/data/` — the curated Striver sheet + GFG problem statements.
- `lib/companion/` + `components/companion/` — the companion character (see below).
- `public/characters/<id>/` — character packs (data, not code; see below).
- `electron/` — desktop shell (`main.js` boots the standalone server; sets `EFDX_DATA_DIR`).

## The AI layer (`lib/ai/`) — read this before touching model calls

All tutoring goes through one seam. `lib/claude/prompts.ts` `buildPrompts(mode, ctx)`
returns a plain `{ system, prompt }` (+ optional `ctx.imageBase64`) with nothing
Anthropic-specific, so any provider can serve it and the guard protects all of them.

- **`types.ts`** — `AiProvider` interface, `ChatRequest`, and the shared
  `ProviderError { kind: "auth" | "rate_limit" | "unavailable" | "other" }`. `kind`
  decides whether the router retries the next provider (`isRetryableKind`).
- **`providers/claude.ts`** — wraps the Agent SDK (the local Claude Code session,
  no key). Keeps partial-message streaming and the whiteboard image path.
- **`providers/openaiCompat.ts`** — **one** generic client for every other provider,
  because Gemini, OpenRouter, Groq, Cerebras, Mistral, and any custom endpoint are
  all OpenAI-compatible. Parses SSE `data:` frames, and importantly **surfaces
  in-stream error frames** (`data: {"error":{...,"code":429}}`, which OpenRouter
  returns with HTTP 200) instead of yielding an empty stream.
- **`presets.ts`** — per-provider defaults (base URL, models, env key, `recommended[]`).
  Model slugs churn and free tiers rate-limit; everything here is user-overridable.
- **`config.ts`** — reads/writes `settings.json` in `dataDir()`. `resolveKey` lets an
  env var override a stored key. `resolveCandidateChain` produces the ordered,
  enabled, configured providers to try.
- **`models.ts`** — lists a provider's models (its `/models` endpoint) for the
  Settings picker; OpenRouter's list is public and carries pricing (→ Free/Paid) and
  `input_modalities` (→ Vision). Disk-cached 24h.
- **`router.ts`** — the fallback engine. `openStream(mode, ctx)` walks the candidate
  chain and **falls through only before the first byte**: it starts a provider's
  generator and awaits the first chunk; a retryable `ProviderError` before any output
  advances to the next provider, but once bytes flow it commits (a mid-answer failure
  surfaces, no silent switch). Also `runChat` (JSON modes), `probeChain` (banner
  health), `probeProvider` (Settings "Test"), `primaryFor` (cache key).

### Invariants to preserve
- **The guard is model-agnostic** — it wraps the output stream in
  `app/api/claude/route.ts`; keep new providers going through it.
- **Cache keys include the serving provider + model** (`llmCacheKey`), so a Gemini
  answer is never served while Claude is active. Reads key on the primary candidate;
  writes on whoever actually served.
- **Claude stays the default** (`activeProvider: "claude"`, empty chain). Other
  providers are opt-in via Settings or `*_API_KEY` env vars.
- **API keys never leave the machine**: `settings.json` lives in the local data dir;
  `GET /api/settings` redacts keys to a `hasKey` boolean. `.data/` is gitignored.
- **Images** only go to vision-capable providers; text-only providers get a note.

## The companion (`lib/companion/`) — the character at the bottom of the screen

A character (Makise Kurisu by default) is docked on every page: she greets you,
reacts to solves/verdicts/streaks, nudges when you stall, and replies when you
type back. She is **the mascot, not the tutor** — see the invariants below.

**Characters are data.** A *pack* is a folder holding `character.json` (persona,
speech style, `expressions[]`, `eventLines` — 3-5 canned templated lines per event,
`{name}`/`{title}`/`{score}`/`{streak}`/`{solved}` slots; optional
`greetingStreak`/`greetingMorning`/`greetingNight` keys), `sprites/` (expression
PNGs + optional `chibi.png` for the minimized dock), `voice/`. Packs live in **two
roots**: bundled `public/characters/<id>/` (static-served) and user-installed
`dataDir()/characters/<id>/` (served via `GET /api/companion/asset/<id>/...`;
**installed shadows bundled** on id collision). Users add packs by zip upload in
Settings (`POST /api/companion/import` — validates against the zod schema, guards
zip-slip, stages-then-renames) or by copying a folder in; the import endpoint is
the future character engine's delivery target. The app only ever *reads* packs;
nothing about Kurisu is hardcoded. Art and audio are gitignored; `character.json`
is not. All pack storage access stays behind `pack.ts` + the asset/import routes,
so a future multi-tenant backend swaps the storage driver there only.

- **`pack.ts`** — zod schema, `loadCharacterPack(id)`, `listCharacterPacks()`
  (roster for the Settings picker, invalid packs flagged not fatal). **fs-probes
  every sprite variant**, so the client never 404-spams for art that isn't there.
  Manifest served by `GET /api/companion/pack`; roster + install-dir path by
  `GET /api/companion/characters`, whose POST also handles pack CRUD
  (`validate`/`create`/`update` — writing over a bundled id is the intended
  "customize the built-in character" fork — and `delete`, resetting the active id
  if needed). `POST /api/companion/sprites` uploads PNGs into an installed pack.
- **Character wizard** (`components/settings/CharacterWizard.tsx`) — Settings →
  Companion → "Add character": import-zip (with structure guide), or AI-generate a
  pack via the `characterGen` prompt mode — famous characters (model knowledge +
  web search) or original characters (user description) — then a form/raw-JSON
  editor with a preview-line button, saved through the CRUD actions above.
  Search tiers for generation: the router prefers **claude** for `characterGen`
  (native Agent SDK WebSearch via `ChatRequest.webSearch`); openrouter grounds
  itself with a `:online` model suffix; for all other providers
  `lib/companion/sourceFetch.ts` fetches Wikipedia/Fandom extracts (MediaWiki
  APIs, no keys, disk-cached 24h, best-effort → "") into the prompt. Pasted user
  material always wins.
- **`bus.ts`** — a module-level typed pub/sub (`emitCompanionEvent`/`subscribeCompanion`)
  with a 10-event/5s replay buffer, plus `noteActivity()` for quiet-while-typing. It
  exists because the app has **no global client state** and the root layout is a server
  component: a context provider would push a client boundary through every page to serve
  one widget. Emitters (`SolveView`, `QuizRunner`) and the widget share one browser bundle,
  so a singleton is sufficient; the replay buffer also makes HMR re-instantiation benign.
- **`director.ts`** — pure policy: chattiness presets (min gap / hourly cap / routine
  probability), quiet-while-typing (defer once, then drop), one-line-at-a-time, and the
  canned-vs-LLM routing table. Also builds the `eventSummary` strings — **from event
  fields only**.
- **`useCompanionBrain.ts`** — event → `decide()` → canned line or `companion` mode call.
  Owns the message list, which is the single source of truth for what renders, what
  persists (`sessionStorage`), and what the model receives as prior turns.
- **`playLine.ts`** — the delivery seam. v1 reveals text (~32 chars/s) and flaps the mouth
  procedurally; the phase-2 voice path is a branch here (`voice/<sha256(text)[:16]>.wav`,
  mouth driven by WebAudio amplitude). The sprite and bubble never learn which driver ran.
- **`components/companion/`** — `CompanionWidget` (mounted in `app/layout.tsx` as a client
  island so it survives route changes; `z-40`, under `NameGate`'s `z-50`), `CompanionSprite`
  (expression crossfade, blink loop, idle sway, mouth flap), `SpeechBubble` (conversation +
  reply input).

### Companion invariants to preserve

- **She cannot leak solutions.** The `companion` prompt mode receives *only* persona +
  event summary + chat history — never `code`, `problemStatement`, or review text. Never
  enrich `eventSummary` with problem content. She's also in `GUARDED_MODES` as a backstop,
  and the persona instructs an in-character refusal that redirects to Hints/Coach.
- **Routine chatter costs no tokens.** Canned pack lines for greetings/problem opens/hints/
  ordinary solves; the model is for context-rich moments and user replies only. She stays
  out of `HEAVY_MODES` (light tier) and *in* `UNCACHED_MODES` (repeated banter is worse than
  none). A companion-only `provider`/`model` override in settings keeps banter off the
  tutoring budget; a rate limiter in `app/api/claude/route.ts` backstops the client director.
- **The coach is absorbed, not duplicated.** When the companion is enabled, `SolveView` passes
  `ctx.personaStyle` into its *existing* coach call and routes the result to the bus — one
  LLM call, same escalation ladder, same guard. Disabled → the old `CoachToast` returns.
- **Every failure degrades to silence, never an error.** A failed/rate-limited call falls back
  to a canned line; a missing sprite variant falls back to the base, then to an avatar chip;
  an unparseable `[expression]` tag falls back to `neutral`.

## Persistence

Everything lives under `dataDir()` (`lib/store/paths.ts`): project-local `.data/`
in dev, Electron `userData` when packaged, OS tmp otherwise.
- `progress.json` — solve status, streak, quiz results (serialized atomic writes).
- `settings.json` — AI provider config (active/chain/keys/models), plus optional
  `sync` and `companion` blocks. Both are optional for old files and normalized on read.
- `cache/<namespace>/` — disk cache for `leetcode` statements, `llm` responses, `models`.

## Gotchas

- Free-tier models rate-limit constantly; the failure arrives as an in-stream error,
  not an HTTP error — that's why `openaiCompat.ts` inspects frame bodies.
- `checkClaudeAuth`/`probeChain` make a real (tiny) model call; the banner polls it.
- The `ask` mode is used as a lightweight health probe.
- When adding a provider: add a preset, add its id to the `ProviderId` union, and it
  flows through `openaiCompat` automatically — no router changes needed.
- The companion greets **once per browser session per character**
  (`companion:greeted:<id>`), so a refresh won't re-greet — which means the
  conversation can legitimately be empty. Panel open/closed state is derived from
  "did something arrive after the last collapse" **or** an explicit open; drop the
  second half and clicking her does nothing when the history is empty.
- Companion chat history is keyed per character (`companion:history:<id>`), and
  isolation is **structural**: `CompanionWidget` keys the inner dock on the pack id,
  so switching characters remounts the brain and history hydrates synchronously.
  Don't "optimize" the key away — that's what prevents one character inheriting
  another's conversation (and feeding it to the model as her own).
- Companion message ids must resume past restored history (`lineIdRef` seeds from the
  max restored id) — reusing an id makes a new line overwrite an old one, since
  messages are patched by id.
- The app-guide digest (`lib/claude/appGuide.ts`) is appended to the companion
  prompt **only when a `userMessage` is present** — keep proactive banter off that
  token bill, and keep the guide free of problem/solution content.
- `characterGen` is heavy-tier, uncached, and claude-first regardless of the
  active provider. `sourceFetch` failures must stay silent (generation proceeds
  on model knowledge); never make the wizard depend on the fetch succeeding.
- Sprite images must never mount/unmount during animation: `CompanionSprite`
  keeps every base AND variant permanently mounted and toggles opacity (blinks
  are instant, expression changes crossfade). A freshly-mounted `<img>` paints
  blank for a frame — that was the "black flicker on every blink" bug.
- Verifying UI work: there is no test suite and no browser driver installed. Drive the
  running dev server with Chrome over the DevTools Protocol (headless Chrome +
  `--remote-debugging-port`, Node 22's native `WebSocket`) — that is how the two
  companion bugs above were caught, and neither surfaced as a console error.
