import { NextRequest } from "next/server";
import { backendFor } from "@/lib/sync/backends";
import { firebaseAuth, firebaseSignOut } from "@/lib/sync/backends/firebase";
import { backendConfigured, getResolvedSync, isSyncBackendId } from "@/lib/sync/config";
import { autoSync, forcePush, getSyncStatus, syncNow } from "@/lib/sync/engine";
import { SyncError } from "@/lib/sync/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  return Response.json(await getSyncStatus());
}

interface PostBody {
  action: "now" | "auto" | "force-push" | "test" | "firebase-signin" | "firebase-signup" | "firebase-signout";
  /** For test: which backend to probe (defaults to the selected one). */
  backend?: string;
  email?: string;
  password?: string;
}

export async function POST(req: NextRequest) {
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  switch (body.action) {
    case "now":
      return Response.json(await syncNow());

    case "auto":
      return Response.json(await autoSync());

    case "force-push":
      return Response.json(await forcePush());

    case "test": {
      // Probe a backend's saved config even when sync isn't enabled yet —
      // the UI saves first, then tests, mirroring the provider "Save & test".
      const resolved = await getResolvedSync();
      const id = isSyncBackendId(body.backend) ? body.backend : resolved.backend;
      if (!id) return Response.json({ ok: false, error: "No sync backend selected." });
      if (!backendConfigured(resolved, id)) {
        return Response.json({ ok: false, error: "Backend isn't fully configured yet." });
      }
      const backend = backendFor(resolved, id)!;
      const health = await backend.healthCheck(req.signal);
      return Response.json(health);
    }

    case "firebase-signin":
    case "firebase-signup": {
      const email = typeof body.email === "string" ? body.email.trim() : "";
      const password = typeof body.password === "string" ? body.password : "";
      if (!email || !password) {
        return Response.json({ ok: false, error: "Email and password are required." }, { status: 400 });
      }
      try {
        const result = await firebaseAuth(
          body.action === "firebase-signup" ? "signup" : "signin",
          email,
          password,
          req.signal,
        );
        return Response.json({ ok: true, email: result.email });
      } catch (err) {
        const message = err instanceof SyncError ? err.message : "Sign-in failed.";
        return Response.json({ ok: false, error: message });
      }
    }

    case "firebase-signout":
      await firebaseSignOut();
      return Response.json({ ok: true });

    default:
      return Response.json({ error: "bad_action" }, { status: 400 });
  }
}
