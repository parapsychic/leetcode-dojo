import { NextRequest } from "next/server";
import {
  getProgress,
  recordHint,
  recordAttempt,
  recordSolved,
  recordQuiz,
  setProfileName,
} from "@/lib/store/progress";
import { scheduleSync } from "@/lib/sync/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getProgress());
}

interface PostBody {
  action: "hint" | "attempt" | "solved" | "quiz" | "profile";
  problemId?: string;
  elapsedMs?: number | null;
  quiz?: { topic: string; scorePct: number; total: number; correct: number };
  name?: string;
}

export async function POST(req: NextRequest) {
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const done = (data: unknown) => {
    // Debounced push to the sync backend; adds nothing to the response time.
    scheduleSync();
    return Response.json(data);
  };

  switch (body.action) {
    case "hint":
      if (!body.problemId) break;
      return done(await recordHint(body.problemId));
    case "attempt":
      if (!body.problemId) break;
      return done(await recordAttempt(body.problemId));
    case "solved":
      if (!body.problemId) break;
      return done(await recordSolved(body.problemId, body.elapsedMs ?? null));
    case "quiz":
      if (!body.quiz) break;
      return done(await recordQuiz(body.quiz));
    case "profile":
      return done(await setProfileName(body.name ?? ""));
  }
  return Response.json({ error: "bad_action" }, { status: 400 });
}
