import { TrendingUp } from "lucide-react";
import type { GoalProgressReport, TrendDirection } from "@/lib/progress";

type Props = {
  reports: GoalProgressReport[];
};

// Plain-language, parent-facing framing of the same trend direction the
// SLP/Teacher progress page shows as an "up"/"down"/"flat" label — kept
// warm and never discouraging, since "down" here usually just means a
// harder new goal, not something going wrong.
function trendPhrase(direction: TrendDirection): string {
  if (direction === "up") return "Doing great — improving!";
  if (direction === "down") return "Still building this skill";
  return "Steady progress";
}

function metricWord(report: GoalProgressReport): string {
  if (report.isRating) return "of the max rating";
  if (report.isCueing) return "independent";
  return "correct";
}

// Parent-facing progress cards — reuses the same buildGoalReport() numbers
// as the SLP/Teacher progress page, but only ever shows a plain-language
// line and a single progress bar per goal. No level breakdown, no dated
// trend chart, no clinical terminology — that detail stays on the
// SLP/Teacher side.
export default function ProgressSection({ reports }: Props) {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
        <TrendingUp className="h-5 w-5 text-brand-500" />
        Progress
      </h2>
      <p className="mt-1 text-sm text-stone-500">
        A quick look at the goals your child&apos;s been working on.
      </p>

      <div className="mt-3 space-y-3">
        {reports.map((report) => (
          <div
            key={report.goal.id}
            className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            {report.goal.area && (
              <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
                {report.goal.area.name}
              </span>
            )}
            <p className="mt-2 font-medium text-stone-900">
              {report.goal.text}
            </p>

            {report.currentPercent === null ? (
              <p className="mt-2 text-sm text-stone-500">
                Just getting started — check back soon!
              </p>
            ) : (
              <>
                <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-stone-100">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${report.currentPercent}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-stone-600">
                  {trendPhrase(report.trendDirection)} — about{" "}
                  {report.currentPercent}% {metricWord(report)} lately.
                </p>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
