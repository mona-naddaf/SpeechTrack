import Link from "next/link";
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
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/students/${student.id}`}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          &larr; Back to {student.name}
        </Link>

        <h1 className="mt-4 text-2xl font-bold text-slate-900">Progress</h1>
        <p className="mt-1 text-slate-600">{student.name}</p>

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
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
            No goals yet for this student.
          </div>
        )}

        <div className="mt-6 space-y-4">
          {reports.map((report) => (
            <div
              key={report.goal.id}
              className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  {report.goal.area && (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                      {report.goal.area.name}
                    </span>
                  )}
                  <p className="mt-2 font-medium text-slate-900">
                    {report.goal.text}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${GOAL_STATUS_CLASSES[report.goal.status]}`}
                >
                  {GOAL_STATUS_LABELS[report.goal.status]}
                </span>
              </div>

              <p className="mt-2 text-xs text-slate-500">
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
                <p className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
                  No sessions logged yet for this goal.
                </p>
              ) : (
                <div className="mt-4 space-y-4">
                  {report.isCueing && (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Level breakdown
                      </p>
                      <LevelBreakdownBars entries={report.levelBreakdown} />
                    </div>
                  )}

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {report.isCueing
                        ? "% independent over time"
                        : "% correct over time"}
                    </p>
                    <TrendChart
                      points={report.trend}
                      label={report.isCueing ? "% independent" : "% correct"}
                    />
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-start justify-between gap-2 rounded-lg bg-slate-50 p-3">
                <p className="flex-1 text-sm text-slate-700">
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
