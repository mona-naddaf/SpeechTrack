import { TrendingUp } from "lucide-react";
import type { GoalProgressReport } from "@/lib/progress";
// Same card the SLP/Teacher progress page renders — same level-breakdown
// bars, trend chart, and auto-generated written summary with its "Copy
// summary" button. No separate simplified version: this section is just
// that card, filtered upstream (see src/app/parent/page.tsx) to only the
// goals marked visible_to_parent.
import GoalProgressCard from "@/app/students/[id]/progress/goal-progress-card";

type Props = {
  reports: GoalProgressReport[];
  /** When set, the subtitle names the student directly ("A quick look at
   *  the goals Alex's been working on") instead of saying "your child" —
   *  used by the Teacher view (src/app/classroom/classroom-dashboard.tsx),
   *  where "your child" doesn't make sense. Left unset on the Parent view
   *  so it keeps its original phrasing. */
  studentName?: string;
};

export default function ProgressSection({ reports, studentName }: Props) {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
        <TrendingUp className="h-5 w-5 text-brand-500" />
        Progress
      </h2>
      <p className="mt-1 text-sm text-stone-500">
        A quick look at the goals{" "}
        {studentName ? `${studentName}'s` : "your child's"} been working on.
      </p>

      <div className="mt-3 space-y-3">
        {reports.map((report) => (
          <GoalProgressCard key={report.goal.id} report={report} />
        ))}
      </div>
    </div>
  );
}
