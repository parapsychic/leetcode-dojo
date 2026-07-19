// Firebase backend — syncs to the maintainer's shared Firebase project so
// cloners get a zero-setup option. Uses Firebase's public REST APIs directly
// (no SDK): Identity Toolkit for email/password auth, Secure Token for
// refresh, Firestore REST for the single per-user doc.
//
// Security model: the web apiKey here is public by design; access control is
// Firebase Auth + the Firestore rules in firebase/firestore.rules (each uid
// can only touch users/{uid}/data/main). The stored secret on this machine is
// the refresh token (settings.json, redacted by the settings API). Passwords
// are never persisted.

import { updateSettings } from "@/lib/ai/config";
import type { ProgressData } from "@/lib/store/progress";
import { FIREBASE_PROJECT } from "../firebaseProject";
import { parseProgressDoc } from "../schema";
import { syncFetch } from "../http";
import { SyncError, type SyncBackend } from "../types";

const AUTH_BASE = "https://identitytoolkit.googleapis.com/v1";
const TOKEN_URL = `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_PROJECT.apiKey}`;

function docUrl(uid: string): string {
  return (
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT.projectId}` +
    `/databases/(default)/documents/users/${uid}/data/main`
  );
}

// Identity Toolkit error codes → messages a human can act on.
const AUTH_ERRORS: Record<string, string> = {
  EMAIL_EXISTS: "An account with this email already exists — try signing in instead.",
  EMAIL_NOT_FOUND: "No account with this email — try creating one.",
  INVALID_LOGIN_CREDENTIALS: "Wrong email or password.",
  INVALID_PASSWORD: "Wrong email or password.",
  INVALID_EMAIL: "That doesn't look like a valid email address.",
  USER_DISABLED: "This account has been disabled.",
  TOO_MANY_ATTEMPTS_TRY_LATER: "Too many attempts — wait a bit and try again.",
  OPERATION_NOT_ALLOWED:
    "Email/password sign-in isn't enabled on the Firebase project (maintainer setup step).",
};

function friendlyAuthError(code: string): string {
  if (AUTH_ERRORS[code]) return AUTH_ERRORS[code];
  if (code.startsWith("WEAK_PASSWORD")) {
    return "Password is too weak — use at least 6 characters.";
  }
  return `Sign-in failed (${code}).`;
}

interface AuthResult {
  email: string;
}

/** Sign in or create an account; persists { email, refreshToken } in settings. */
export async function firebaseAuth(
  kind: "signin" | "signup",
  email: string,
  password: string,
  signal?: AbortSignal,
): Promise<AuthResult> {
  const endpoint = kind === "signup" ? "accounts:signUp" : "accounts:signInWithPassword";
  const res = await syncFetch(
    "firebase",
    `${AUTH_BASE}/${endpoint}?key=${FIREBASE_PROJECT.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
    signal,
  );
  const data = (await res.json().catch(() => null)) as {
    email?: string;
    refreshToken?: string;
    error?: { message?: string };
  } | null;
  if (!res.ok || !data?.refreshToken) {
    throw new SyncError(
      friendlyAuthError(data?.error?.message ?? `HTTP ${res.status}`),
      "auth",
      "firebase",
    );
  }
  const storedEmail = data.email ?? email;
  await updateSettings((s) => {
    const sync = (s.sync ??= {});
    sync.firebase = { email: storedEmail, refreshToken: data.refreshToken };
  });
  return { email: storedEmail };
}

export async function firebaseSignOut(): Promise<void> {
  await updateSettings((s) => {
    if (s.sync) s.sync.firebase = {};
  });
}

interface Session {
  idToken: string;
  uid: string;
}

/** Exchange the refresh token for a fresh ID token (1h expiry). */
async function refreshSession(refreshToken: string, signal?: AbortSignal): Promise<Session> {
  const res = await syncFetch(
    "firebase",
    TOKEN_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }).toString(),
    },
    signal,
  );
  const data = (await res.json().catch(() => null)) as {
    id_token?: string;
    refresh_token?: string;
    user_id?: string;
    error?: { message?: string };
  } | null;
  if (!res.ok || !data?.id_token || !data.user_id) {
    throw new SyncError(
      "Your session has expired — sign in to Firebase sync again.",
      "auth",
      "firebase",
    );
  }
  // Firebase may rotate the refresh token; keep the stored one current.
  if (data.refresh_token && data.refresh_token !== refreshToken) {
    const rotated = data.refresh_token;
    await updateSettings((s) => {
      const sync = (s.sync ??= {});
      sync.firebase = { ...sync.firebase, refreshToken: rotated };
    });
  }
  return { idToken: data.id_token, uid: data.user_id };
}

interface FirestoreDoc {
  fields?: {
    blob?: { stringValue?: string };
    updatedAt?: { stringValue?: string };
  };
}

export function firebaseBackend(refreshToken: string): SyncBackend {
  // One token refresh per backend instance (= per sync cycle / health check).
  let session: Promise<Session> | null = null;
  const getSession = (signal?: AbortSignal) =>
    (session ??= refreshSession(refreshToken, signal));

  return {
    id: "firebase",
    label: "LeetCode Dojo cloud (Firebase)",

    async pull(signal): Promise<ProgressData | null> {
      const { idToken, uid } = await getSession(signal);
      const res = await syncFetch(
        "firebase",
        docUrl(uid),
        { headers: { Authorization: `Bearer ${idToken}` } },
        signal,
      );
      if (res.status === 404) return null;
      if (res.status === 401 || res.status === 403) {
        throw new SyncError(
          "Firebase denied access — sign in again (or the security rules changed).",
          "auth",
          "firebase",
        );
      }
      if (!res.ok) {
        throw new SyncError(`Firestore returned HTTP ${res.status}`, "other", "firebase");
      }
      const doc = (await res.json().catch(() => null)) as FirestoreDoc | null;
      const blob = doc?.fields?.blob?.stringValue;
      if (typeof blob !== "string") {
        throw new SyncError("Remote Firebase doc has an unexpected shape.", "other", "firebase");
      }
      return parseProgressDoc(blob);
    },

    async push(data, signal): Promise<void> {
      const { idToken, uid } = await getSession(signal);
      const res = await syncFetch(
        "firebase",
        docUrl(uid),
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fields: {
              blob: { stringValue: JSON.stringify(data) },
              updatedAt: { stringValue: data.updatedAt ?? new Date().toISOString() },
            },
          }),
        },
        signal,
      );
      if (res.status === 401 || res.status === 403) {
        throw new SyncError(
          "Firebase denied the write — sign in again (or the doc exceeds the size cap).",
          "auth",
          "firebase",
        );
      }
      if (!res.ok) {
        throw new SyncError(`Firestore returned HTTP ${res.status}`, "other", "firebase");
      }
    },

    async healthCheck(signal) {
      try {
        const { idToken, uid } = await getSession(signal);
        const res = await syncFetch(
          "firebase",
          docUrl(uid),
          { headers: { Authorization: `Bearer ${idToken}` } },
          signal,
        );
        // 404 = authed and reachable, nothing stored yet.
        if (res.ok || res.status === 404) return { ok: true };
        return { ok: false, error: `Firestore returned HTTP ${res.status}` };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
