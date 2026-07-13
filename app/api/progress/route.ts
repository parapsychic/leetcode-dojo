import { NextRequest } from "next/server";
import {
  getProgress,
  recordHint,
  recordAttempt,
  recordSolved,
  recordQuiz,
  setProfileName,
} from "@/lib/store/progress";

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

  switch (body.action) {
    case "hint":
      if (!body.problemId) break;
      return Response.json(await recordHint(body.problemId));
    case "attempt":
      if (!body.problemId) break;
      return Response.json(await recordAttempt(body.problemId));
    case "solved":
      if (!body.problemId) break;
      return Response.json(
        await recordSolved(body.problemId, body.elapsedMs ?? null),
      );
    case "quiz":
      if (!body.quiz) break;
      return Response.json(await recordQuiz(body.quiz));
    case "profile":
      return Response.json(await setProfileName(body.name ?? ""));
  }
  return Response.json({ error: "bad_action" }, { status: 400 });
}
