import Link from "next/link";
import { STRIVER_SHEET, ALL_PROBLEMS, TOTAL_PROBLEMS } from "@/lib/data/striverSheet";
import { getProgress } from "@/lib/store/progress";
import { Card, DifficultyBadge } from "@/components/ui";
import { Flame, Trophy, ArrowRight, MessageSquareCode, GraduationCap } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const progress = await getProgress();
  const solvedIds = new Set(
    Object.entries(progress.problems)
      .filter(([, v]) => v.status === "solved")
      .map(([k]) => k),
  );
  const attemptedIds = new Set(
    Object.entries(progress.problems)
      .filter(([, v]) => v.status === "attempted")
      .map(([k]) => k),
  );
  const solvedCount = solvedIds.size;
  const pct = Math.round((solvedCount / TOTAL_PROBLEMS) * 100);

  const nextProblem = ALL_PROBLEMS.find((p) => !solvedIds.has(p.id));

  const topicStats = STRIVER_SHEET.reduce<
    Record<string, { total: number; solved: number }>
  >((acc, sec) => {
    const t = (acc[sec.topic] ||= { total: 0, solved: 0 });
    for (const p of sec.problems) {
      t.total += 1;
      if (solvedIds.has(p.id)) t.solved += 1;
    }
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {progress.profile.name
              ? `Welcome back, ${progress.profile.name}.`
              : "Welcome."}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Striver&apos;s SDE Sheet · understand, don&apos;t memorize.
          </p>
        </div>
        <div className="flex gap-3">
          <Card className="flex items-center gap-2 px-4 py-2">
            <Flame size={18} className="text-amber-400" />
            <div>
              <div className="text-lg font-semibold leading-none">
                {progress.streak.current}
              </div>
              <div className="text-[11px] text-muted">day streak</div>
            </div>
          </Card>
          <Card className="flex items-center gap-2 px-4 py-2">
            <Trophy size={18} className="text-emerald-400" />
            <div>
              <div className="text-lg font-semibold leading-none">
                {solvedCount}/{TOTAL_PROBLEMS}
              </div>
              <div className="text-[11px] text-muted">solved</div>
            </div>
          </Card>
        </div>
      </div>

      <Card className="mb-6 p-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">Overall progress</span>
          <span className="text-muted">{pct}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-background">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent to-emerald-400 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-3 flex gap-4 text-xs text-muted">
          <span>{solvedCount} solved</span>
          <span>{attemptedIds.size} in progress</span>
          <span>{TOTAL_PROBLEMS - solvedCount} remaining</span>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          {nextProblem && (
            <Card className="p-5">
              <div className="mb-1 text-xs uppercase tracking-wide text-muted">
                Continue
              </div>
              <div className="mb-2 flex items-center gap-2">
                <span className="font-medium">{nextProblem.title}</span>
                <DifficultyBadge difficulty={nextProblem.difficulty} />
              </div>
              <p className="mb-4 text-xs text-muted">{nextProblem.topic}</p>
              <Link
                href={`/problem/${nextProblem.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-black hover:bg-accent/90"
              >
                Solve it <ArrowRight size={15} />
              </Link>
            </Card>
          )}

          <Link href="/interview" className="block">
            <Card className="p-5 transition-colors hover:border-accent/40">
              <MessageSquareCode size={20} className="mb-2 text-accent" />
              <div className="font-medium">Mock interview</div>
              <p className="text-xs text-muted">
                Get grilled by an AI interviewer who probes your thinking.
              </p>
            </Card>
          </Link>

          <Link href="/learn" className="block">
            <Card className="p-5 transition-colors hover:border-accent/40">
              <GraduationCap size={20} className="mb-2 text-accent" />
              <div className="font-medium">Learn &amp; visualize</div>
              <p className="text-xs text-muted">
                Re-learn a topic with animated visualizations and a quiz.
              </p>
            </Card>
          </Link>
        </div>

        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 text-sm font-medium">Progress by topic</div>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(topicStats).map(([topic, s]) => {
              const tp = Math.round((s.solved / s.total) * 100);
              return (
                <Link
                  key={topic}
                  href={`/learn/${encodeURIComponent(topic)}`}
                  className="group rounded-lg border border-border p-3 transition-colors hover:border-accent/40"
                >
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="group-hover:text-accent">{topic}</span>
                    <span className="text-xs text-muted">
                      {s.solved}/{s.total}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-background">
                    <div
                      className="h-full rounded-full bg-accent/70"
                      style={{ width: `${tp}%` }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
