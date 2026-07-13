import Link from "next/link";
import { STRIVER_SHEET } from "@/lib/data/striverSheet";
import { getProgress } from "@/lib/store/progress";
import { Card, DifficultyBadge } from "@/components/ui";
import { CheckCircle2, Circle, CircleDot, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SheetPage() {
  const progress = await getProgress();
  const statusOf = (id: string) => progress.problems[id]?.status ?? "unsolved";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Striver&apos;s SDE Sheet</h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        {STRIVER_SHEET.length} sections. Click a problem to solve it with hints,
        review, and visualizations.
      </p>

      <div className="space-y-5">
        {STRIVER_SHEET.map((section) => {
          const solved = section.problems.filter(
            (p) => statusOf(p.id) === "solved",
          ).length;
          return (
            <Card key={section.id} className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div>
                  <h2 className="font-medium">{section.title}</h2>
                  <span className="text-xs text-muted">{section.topic}</span>
                </div>
                <span className="text-xs text-muted">
                  {solved}/{section.problems.length}
                </span>
              </div>
              <ul className="divide-y divide-border">
                {section.problems.map((p) => {
                  const status = statusOf(p.id);
                  return (
                    <li key={p.id}>
                      <Link
                        href={`/problem/${p.id}`}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-background/60"
                      >
                        {status === "solved" ? (
                          <CheckCircle2 size={16} className="text-emerald-400" />
                        ) : status === "attempted" ? (
                          <CircleDot size={16} className="text-amber-400" />
                        ) : (
                          <Circle size={16} className="text-muted" />
                        )}
                        <span className="flex-1">{p.title}</span>
                        {p.source === "gfg" && (
                          <span className="flex items-center gap-1 text-[11px] text-muted">
                            GFG <ExternalLink size={11} />
                          </span>
                        )}
                        <DifficultyBadge difficulty={p.difficulty} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
