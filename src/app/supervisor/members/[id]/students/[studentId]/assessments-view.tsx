"use client";

import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { formatDate } from "@/lib/date";
import type { AssessmentResultDisplay } from "@/app/students/[id]/assessments-section";
import SectionHeader from "@/components/section-header";
import { useSectionPreferences } from "@/components/section-preferences";

type Props = {
  /** Base path to link completed results into, e.g.
   *  `/supervisor/members/{memberId}/students/{studentId}/assessment`. */
  basePath: string;
  results: AssessmentResultDisplay[];
  error: string | null;
};

/** Read-only mirror of AssessmentsSection — no "Run assessment" button.
 *  In-progress results aren't links: the only page that shows one is
 *  AssessmentAdminister, which is pure mutation (answers upsert on
 *  every keystroke) with no read-only equivalent, so they're shown as
 *  an inert status row instead. Completed results link to
 *  AssessmentReport, which is pure display. SLP-only — there's no
 *  Teacher-side assessments feature in this app. */
export default function AssessmentsView({ basePath, results, error }: Props) {
  const {
    collapsed,
    onToggleCollapse,
    onMoveUp,
    onMoveDown,
    canMoveUp,
    canMoveDown,
  } = useSectionPreferences("assessments");

  const inProgress = results.filter((r) => r.status === "in_progress");
  const completed = results
    .filter((r) => r.status === "completed")
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));

  return (
    <div>
      <SectionHeader
        icon={ClipboardList}
        title="Assessments"
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
      />

      {!collapsed && (
        <>
          {error && (
            <p className="mt-4 text-sm text-red-600">
              Couldn&apos;t load assessments: {error}
            </p>
          )}

          {inProgress.length === 0 && completed.length === 0 && !error && (
            <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
                <ClipboardList className="h-6 w-6 text-brand-500" />
              </div>
              <p className="text-stone-500">
                No assessments run yet for this student.
              </p>
            </div>
          )}

          {inProgress.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                In progress
              </h3>
              <ul className="mt-2 divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                {inProgress.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-stone-900">
                        {r.assessmentName}
                      </p>
                      <p className="truncate text-sm text-stone-500">
                        Started {formatDate(r.date)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                      {r.answeredCount}/{r.totalQuestions} answered
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {completed.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                Past assessments
              </h3>
              <ul className="mt-2 divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                {completed.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`${basePath}/${r.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-cream-50 sm:px-5"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-stone-900">
                          {r.assessmentName}
                        </p>
                        <p className="truncate text-sm text-stone-500">
                          {formatDate(r.date)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
                        {r.score && r.score.total > 0
                          ? `${r.score.correct}/${r.score.total} correct`
                          : "No scored questions"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
