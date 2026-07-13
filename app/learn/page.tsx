import Link from "next/link";
import { STRIVER_SHEET, TOPICS } from "@/lib/data/striverSheet";
import { Card } from "@/components/ui";
import { GraduationCap, ArrowRight } from "lucide-react";

export default function LearnIndex() {
  const countByTopic = STRIVER_SHEET.reduce<Record<string, number>>((acc, s) => {
    acc[s.topic] = (acc[s.topic] ?? 0) + s.problems.length;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center gap-2">
        <GraduationCap className="text-accent" />
        <h1 className="text-2xl font-semibold">Learn &amp; Visualize</h1>
      </div>
      <p className="mb-6 text-sm text-muted">
        Pick a topic to re-learn it from first principles, watch an animated
        visualization, and quiz yourself.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {TOPICS.map((topic) => (
          <Link key={topic} href={`/learn/${encodeURIComponent(topic)}`}>
            <Card className="flex items-center justify-between p-4 transition-colors hover:border-accent/40">
              <div>
                <div className="font-medium">{topic}</div>
                <div className="text-xs text-muted">
                  {countByTopic[topic]} problems in the sheet
                </div>
              </div>
              <ArrowRight size={16} className="text-muted" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
