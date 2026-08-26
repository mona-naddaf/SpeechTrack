import { formatDateRange } from "@/lib/date";
import { GOAL_STATUS_CLASSES, GOAL_STATUS_LABELS } from "@/lib/goal-status";
import type { GoalProgressReport } from "@/lib/progress";
import LevelBreakdownBars from "./level-breakdown-bars";
import TrendChart from "./trend-chart";
import CopySummaryButton from "./copy-summary-button";

type Props = {
  report: GoalProgressReport;
};

/** One goal's full progress report — status pill, trial count/date range,
 *  level breakdown (cueing goals only), trend chart, and the
 *  auto-generated written summary with its "Copy summary" button.
 *
 *  The single source of truth for this card: the SLP progress page, the
 *  Teacher progress page (cross-imports this file, same as it does with
 *  LevelBreakdownBars/TrendChart/CopySummaryButton — none of these know
 *  about students/goals/areas specifically), and the parent-facing
 *  Progress section (filtered to visible_to_parent goals only) all
 *  render the exact same card — no separate simplified version. */
export default function GoalProgressCard({ report }: Props) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {report.goal.area && (
            <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
              {report.goal.area.name}
            </span>
          )}
          <p className="mt-2 font-medium text-stone-900">{report.goal.text}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${GOAL_STATUS_CLASSES[report.goal.status]}`}
        >
          {GOAL_STATUS_LABELS[report.goal.status]}
        </span>
      </div>

      <p className="mt-2 text-xs text-stone-500">
        {report.totalTrials} trial{report.totalTrials === 1 ? "" : "s"}
        {report.firstSessionDate && report.lastSessionDate && (
          <>
            {" "}
            ·{" "}
            {formatDateRange(report.firstSessionDate, report.lastSessionDate)}
          </>
        )}
      </p>

      {report.totalTrials === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-stone-200 bg-cream-50 p-4 text-center text-sm text-stone-500">
          No sessions logged yet for this goal.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {report.isCueing && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
                Level breakdown
              </p>
              <LevelBreakdownBars entries={report.levelBreakdown} />
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
              {report.metricLabel} over time
            </p>
            <TrendChart points={report.trend} label={report.metricLabel} />
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-start justify-between gap-2 rounded-lg bg-cream-50 p-3">
        <p className="flex-1 text-sm text-stone-700">{report.summary}</p>
        <CopySummaryButton text={report.summary} />
      </div>
    </div>
  );
}
