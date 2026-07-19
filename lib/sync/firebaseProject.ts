// The maintainer's Firebase *web* config, injected at build time from
// NEXT_PUBLIC_FIREBASE_* env vars (locally via .env.local, in CI from GitHub
// secrets — see .github/workflows/release.yml). The web apiKey only
// identifies the project; all access control lives in Firebase Auth + the
// Firestore security rules in firebase/firestore.rules. Never put a
// service-account key or any server secret here.
//
// NEXT_PUBLIC_ vars are statically inlined by `next build` into both the
// server and client bundles, so this works in the browser too. Builds
// without the vars simply hide the Firebase backend card in Settings
// (FIREBASE_CONFIGURED is false).

export const FIREBASE_PROJECT = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
} as const;

export const FIREBASE_CONFIGURED = Boolean(
  FIREBASE_PROJECT.apiKey && FIREBASE_PROJECT.projectId,
);
