# Firebase sync — maintainer setup

The "LeetCode Dojo cloud" sync backend lets anyone who clones the app sync
progress with just an email + password, using **this repo maintainer's**
Firebase project. This doc is the one-time setup for whoever owns that project
(and for forks that want their own).

## Security model (read this first)

- The web config in `lib/sync/firebaseProject.ts` (apiKey / authDomain /
  projectId) is **public by design**. A Firebase web apiKey identifies the
  project; it grants nothing. All access control is Firebase Auth + the
  Firestore rules in this folder.
- The rules guarantee each account can only read/write its own single doc at
  `users/{uid}/data/main`, with a shape check and a ~900KB size cap.
- **Never** add a service-account key, admin credential, or any secret to the
  repo. The only server secret the app stores locally is each user's own
  refresh token (in their local `settings.json`, redacted by the settings API).
- **Stay on the Spark (free) plan and do not attach a billing account.** That
  is the abuse ceiling: the worst a bad actor can do with the public config is
  exhaust free daily quota, which temporarily pauses this sync backend. It can
  never cost you money. The app is local-first and offers three self-hosted
  sync options, so nothing else degrades.

## One-time console setup

1. Create the Firebase project (already done: `leetcode-dojo`).
2. **Enable Email/Password auth**: Console → Build → Authentication →
   Sign-in method → Email/Password → Enable. (Do not enable anonymous auth —
   it's useless for cross-device sync and just invites junk accounts.)
3. **Create a Firestore database**: Console → Build → Firestore Database →
   Create (production mode, any region).
4. **Deploy the rules** in this folder:

   ```bash
   npm install -g firebase-tools
   firebase login
   firebase deploy --only firestore:rules --project leetcode-dojo
   ```

   (Run from the repo root with a `firebase.json` containing
   `{ "firestore": { "rules": "firebase/firestore.rules" } }`, or paste the
   rules into Console → Firestore → Rules → Publish.)
5. Recommended hardening, in Authentication → Settings:
   - Enable **email enumeration protection**.
   - Under Authorized domains, the defaults are fine — the app talks to the
     REST API directly and doesn't need extra domains.

## Future hardening (not yet implemented)

- A rules-level write rate limit (requires a `serverTimestamp` field transform
  on every write plus a `request.time` comparison in rules). Firebase's
  built-in per-IP throttling on auth endpoints covers the worst of it for now.
- Firebase App Check — of limited value for an open-source local app, since
  the debug-token flow is public anyway.

## For forks

Either blank the values in `lib/sync/firebaseProject.ts` (the backend card
disappears from Settings), or create your own free Firebase project and repeat
the steps above with your own web config.
