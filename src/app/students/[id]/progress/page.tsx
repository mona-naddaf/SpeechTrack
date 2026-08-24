import Link from "next/link";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDateRange } from "@/lib/date";
import { GOAL_STATUS_CLASSES, GOAL_STATUS_LABELS } from "@/lib/goal-status";
import { buildGoalReport, type ProgressGoal, type ProgressTrial } from "@/lib/progress";
import LevelBreakdownBars from "./level-breakdown-bars";
import TrendChart from "./trend-chart";
import CopySummaryButton from "./copy-summary-button";

type RawTrial = {
  id: string;
  goal_id: string;
  value: Record<string, unknown>;
  created_at: string;
  session: { id: string; date: string; student_id: string } | null;
};

export default async function StudentProgressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: student } = await supabase
    .from("students")
    .select("id, name, class")
    .eq("id", id)
    .maybeSingle();

  if (!student) {
    notFound();
  }

  const [goalsResult, trialsResult] = await Promise.all([
    supabase
      .from("goals")
      .select(
        "id, text, status, area:areas(id, name), response_format:response_formats(id, name, type, config)"
      )
      .eq("student_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("trials")
      .select(
        "id, goal_id, value, created_at, session:sessions!inner(id, date, student_id)"
      )
      .eq("session.student_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const goals = (goalsResult.data ?? []) as unknown as ProgressGoal[];
  const rawTrials = (trialsResult.data ?? []) as unknown as RawTrial[];
  const trials: ProgressTrial[] = rawTrials
    .filter((t) => t.session !== null)
    .map((t) => ({
      id: t.id,
      goal_id: t.goal_id,
      value: t.value,
      session_date: t.session!.date,
    }));

  const reports = goals.map((goal) => buildGoalReport(goal, trials));

  return (
    <main className="min-h-screen bg-cream-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/students/${student.id}`}
          className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-brand-800"
        >
          <ArrowLeft className="h-4 w-4" />
            Back to {student.name}
        </Link>

        <h1 className="mt-4 flex items-center gap-2 text-2xl font-bold text-stone-900">
          <TrendingUp className="h-6 w-6 text-brand-500" />
          Progress
        </h1>
        <p className="mt-1 text-stone-600">{student.name}</p>

        {goalsResult.error && (
          <p className="mt-4 text-sm text-red-600">
            Couldn&apos;t load goals: {goalsResult.error.message}
          </p>
        )}
        {trialsResult.error && (
          <p className="mt-4 text-sm text-red-600">
            Couldn&apos;t load session data: {trialsResult.error.message}
          </p>
        )}

        {reports.length === 0 && !goalsResult.error && (
          <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
              <TrendingUp className="h-6 w-6 text-brand-500" />
            </div>
            <p className="text-stone-500">No goals yet for this student.</p>
          </div>
        )}

        <div className="mt-6 space-y-4">
          {reports.map((report) => (
            <div
              key={report.goal.id}
              className="rounded-2xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  {report.goal.area && (
                    <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
                      {report.goal.area.name}
                    </span>
                  )}
                  <p className="mt-2 font-medium text-stone-900">
                    {report.goal.text}
                  </p>
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
                    {formatDateRange(
                      report.firstSessionDate,
                      report.lastSessionDate
                    )}
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
                    <TrendChart
                      points={report.trend}
                      label={report.metricLabel}
                    />
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-start justify-between gap-2 rounded-lg bg-cream-50 p-3">
                <p className="flex-1 text-sm text-stone-700">
                  {report.summary}
                </p>
                <CopySummaryButton text={report.summary} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
