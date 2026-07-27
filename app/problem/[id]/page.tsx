import { notFound } from "next/navigation";
import { getProblemById, ALL_PROBLEMS } from "@/lib/data/striverSheet";
import { getGfgStatement } from "@/lib/data/gfgStatements";
import { getGfgUrl } from "@/lib/data/gfgLinks";
import { getProgress } from "@/lib/store/progress";
import { SolveView } from "@/components/solve/SolveView";

export const dynamic = "force-dynamic";

export default async function ProblemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const problem = getProblemById(id);
  if (!problem) notFound();

  const idx = ALL_PROBLEMS.findIndex((p) => p.id === id);
  const next = ALL_PROBLEMS[idx + 1];
  const progress = await getProgress();
  const status = progress.problems[id]?.status ?? "unsolved";

  return (
    <SolveView
      problem={{
        id: problem.id,
        title: problem.title,
        difficulty: problem.difficulty,
        topic: problem.topic,
        leetcodeSlug: problem.leetcodeSlug,
        source: problem.source,
        statement: problem.leetcodeSlug ? null : getGfgStatement(problem.id),
        gfgUrl: problem.leetcodeSlug ? null : getGfgUrl(problem.id, problem.title),
      }}
      nextId={next?.id ?? null}
      initialStatus={status}
    />
  );
}
