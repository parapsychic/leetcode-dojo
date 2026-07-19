import { NextRequest } from "next/server";
import {
  mergeIntoProgress,
  replaceProgress,
  type ProgressData,
} from "@/lib/store/progress";
import { normalizeProgressDoc } from "@/lib/sync/schema";
import { forcePush, scheduleSync } from "@/lib/sync/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ImportBody {
  mode: "merge" | "replace";
  data: unknown;
}

// Restore progress from an exported JSON file.
// merge: field-level merge into local (safe, recommended).
// replace: overwrite local, then force-push so a smaller doc isn't immediately
// re-inflated by the next pull-merge from the sync remote.
export async function POST(req: NextRequest) {
  let body: ImportBody;
  try {
    body = (await req.json()) as ImportBody;
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  if (body.mode !== "merge" && body.mode !== "replace") {
    return Response.json({ error: "bad_mode" }, { status: 400 });
  }

  let doc: ProgressData;
  try {
    doc = normalizeProgressDoc(body.data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      { error: "invalid_progress", message: message.slice(0, 500) },
      { status: 400 },
    );
  }

  const result =
    body.mode === "replace" ? await replaceProgress(doc) : await mergeIntoProgress(doc);

  if (body.mode === "replace") {
    await forcePush().catch(() => {}); // best-effort; sync may be disabled
  } else {
    scheduleSync();
  }

  return Response.json({
    ok: true,
    mode: body.mode,
    problems: Object.keys(result.problems).length,
    quizzes: result.quizResults.length,
  });
}
