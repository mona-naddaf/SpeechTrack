import Link from "next/link";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/role";
import { buildGoalReport, type ProgressGoal, type ProgressTrial } from "@/lib/progress";
// Reusing the SLP progress page's card as-is — it doesn't know about
// students/goals/areas specifically, it just renders whatever shape
// buildGoalReport hands back, which is identical either side.
import GoalProgressCard from "@/app/students/[id]/progress/goal-progress-card";

type RawTrial = {
  id: string;
  goal_id: string;
  value: Record<string, unknown>;
  created_at: string;
  session: { id: string; date: string; student_id: string } | null;
};

export default async function TeacherStudentProgressPage({
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

  if (getUserRole(user) !== "teacher") {
    redirect("/dashboard");
  }

  const { data: student } = await supabase
    .from("teacher_students")
    .select("id, name, class")
    .eq("id", id)
    .maybeSingle();

  if (!student) {
    notFound();
  }

  const [goalsResult, trialsResult] = await Promise.all([
    supabase
      .from("teacher_goals")
      .select(
        "id, text, status, subject:teacher_subjects(id, name), response_format:teacher_response_formats(id, name, type, config)"
      )
      .eq("student_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("teacher_trials")
      .select(
        "id, goal_id, value, created_at, session:teacher_sessions!inner(id, date, student_id)"
      )
      .eq("session.student_id", id)
      .order("created_at", { ascending: true }),
  ]);

  // buildGoalReport only cares about a goal's text/status/response_format —
  // "subject" fills the same slot "area" does on the SLP side.
  const goals: ProgressGoal[] = (
    (goalsResult.data ?? []) as unknown as Array<{
      id: string;
      text: string;
      status: ProgressGoal["status"];
      subject: { id: string; name: string } | null;
      response_format: ProgressGoal["response_format"];
    }>
  ).map((g) => ({
    id: g.id,
    text: g.text,
    status: g.status,
    area: g.subject,
    response_format: g.response_format,
  }));

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
    <main className="flex-1 bg-cream-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/teacher/students/${student.id}`}
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
            <GoalProgressCard key={report.goal.id} report={report} />
          ))}
        </div>
      </div>
    </main>
  );
}
