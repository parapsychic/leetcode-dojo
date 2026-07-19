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

## Persistence

Everything lives under `dataDir()` (`lib/store/paths.ts`): project-local `.data/`
in dev, Electron `userData` when packaged, OS tmp otherwise.
- `progress.json` — solve status, streak, quiz results (serialized atomic writes).
- `settings.json` — AI provider config (active/chain/keys/models).
- `cache/<namespace>/` — disk cache for `leetcode` statements, `llm` responses, `models`.

## Gotchas

- Free-tier models rate-limit constantly; the failure arrives as an in-stream error,
  not an HTTP error — that's why `openaiCompat.ts` inspects frame bodies.
- `checkClaudeAuth`/`probeChain` make a real (tiny) model call; the banner polls it.
- The `ask` mode is used as a lightweight health probe.
- When adding a provider: add a preset, add its id to the `ProviderId` union, and it
  flows through `openaiCompat` automatically — no router changes needed.
