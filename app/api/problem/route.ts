import { NextRequest } from "next/server";
import { getProblem } from "@/lib/leetcode/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return Response.json({ error: "missing_slug" }, { status: 400 });
  const problem = await getProblem(slug);
  return Response.json(problem);
}
