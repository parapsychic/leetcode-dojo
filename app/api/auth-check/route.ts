import { checkClaudeAuth } from "@/lib/claude/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  return Response.json(await checkClaudeAuth());
}
