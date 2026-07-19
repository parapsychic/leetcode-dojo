import { getProgress } from "@/lib/store/progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Download the full progress document as a JSON file.
export async function GET() {
  const data = await getProgress();
  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="leetcode-dojo-progress-${date}.json"`,
    },
  });
}
