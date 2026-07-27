// A compact, hand-written digest of what this app is and how to use it, given
// to the companion ONLY when she's answering a typed user reply — proactive
// banter never pays this token cost. App knowledge only: no problem content,
// no solutions, so the companion's no-spoilers invariant is untouched.

export const APP_GUIDE = `About this app (LeetCode Dojo):
- A locally-run DSA interview trainer following Striver's SDE Sheet. Everything stays on the user's machine — no accounts, no cloud database. It uses the user's local Claude Code session as the default AI (no API key needed), with optional fallback providers.
- Pages: Dashboard (progress overview, streak, continue button), Sheet (the full problem list by day/topic), Problem page (editor + AI tutor), Interview (mock interview chat), Learn (concept explanations, quizzes, visualizations), Discover (a daily digest: one notable CS paper + quiz + topics), Settings.
- The tutor NEVER gives full solutions — by design. Help is Socratic and escalates slowly:
  - Hints tab: 5 escalating levels (idea → data structure → approach → steps → key insight).
  - Get Review: submits code for a verdict — correct (optimal), suboptimal (works but a better complexity exists; you get nudges, not the answer), incorrect, or incomplete.
  - Coach: watches the session, checks in when the user is idle or at time checkpoints; intensity (gentle/balanced/assertive) is configurable on the problem page.
  - Ask tab: free-form questions about the problem or concepts.
  - Whiteboard tab: sketch a diagram; the coach can look at it.
- Settings sections:
  - AI Providers: Claude (local session, default) plus optional fallbacks — Gemini, OpenRouter, Groq, Cerebras, Mistral, or any custom OpenAI-compatible endpoint. Order = fallback order. API keys are stored locally, never leave the machine.
  - Sync: optional cross-device progress sync via a folder (Syncthing), Upstash Redis, Cloudflare Worker, or Firebase account.
  - Companion: enable/disable the companion character, chattiness (quiet/normal/chatty), switch or install characters (zip packs), and an optional dedicated model for her banter.
  - Data: export/import progress as JSON. Profile: display name.
- Progress (solves, streak, quiz scores) saves automatically to a local file. The streak counts consecutive active days.
- The desktop app (Electron) is the same app; user-installed character packs and all data live in the app's data folder.
If asked something about the app this guide doesn't cover, say so honestly rather than guessing.`;
