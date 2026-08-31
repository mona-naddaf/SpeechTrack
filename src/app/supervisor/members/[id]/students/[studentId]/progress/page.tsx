import Link from "next/link";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/role";
import { verifySupervisorLink } from "@/lib/supervisor";
import { buildGoalReport, type ProgressGoal, type ProgressTrial } from "@/lib/progress";
import SupervisorViewingBanner from "@/components/supervisor-viewing-banner";
// Reusing the SLP progress page's card as-is — it doesn't know about
// students/goals/areas specifically, it just renders whatever shape
// buildGoalReport hands back, which is identical for SLP and Teacher
// (the Teacher's own progress page cross-imports this same file).
import GoalProgressCard from "@/app/students/[id]/progress/goal-progress-card";

type RawTrial = {
  id: string;
  goal_id: string;
  value: Record<string, unknown>;
  created_at: string;
  session: { id: string; date: string; student_id: string } | null;
};

export default async function SupervisorStudentProgressPage({
  params,
}: {
  params: Promise<{ id: string; studentId: string }>;
}) {
  const { id, studentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const role = getUserRole(user);
  if (role !== "supervisor") {
    redirect(role === "teacher" ? "/teacher/dashboard" : "/dashboard");
  }

  const link = await verifySupervisorLink(supabase, id);
  if (!link) {
    notFound();
  }

  const isTeacher = link.member_role === "teacher";
  const backHref = `/supervisor/members/${id}/students/${studentId}`;

  const { data: student } = await supabase
    .from(isTeacher ? "teacher_students" : "students")
    .select(isTeacher ? "id, teacher_id, name" : "id, slp_id, name")
    .eq("id", studentId)
    .maybeSingle();

  const ownerId = isTeacher
    ? (student as { teacher_id?: string } | null)?.teacher_id
    : (student as { slp_id?: string } | null)?.slp_id;

  if (!student || ownerId !== id) {
    notFound();
  }

  const [goalsResult, trialsResult] = await Promise.all([
    isTeacher
      ? supabase
          .from("teacher_goals")
          .select(
            "id, text, status, subject:teacher_subjects(id, name), response_format:teacher_response_formats(id, name, type, config)"
          )
          .eq("student_id", studentId)
          .order("created_at", { ascending: false })
      : supabase
          .from("goals")
          .select(
            "id, text, status, area:areas(id, name), response_format:response_formats(id, name, type, config)"
          )
          .eq("student_id", studentId)
          .order("created_at", { ascending: false }),
    isTeacher
      ? supabase
          .from("teacher_trials")
          .select(
            "id, goal_id, value, created_at, session:teacher_sessions!inner(id, date, student_id)"
          )
          .eq("session.student_id", studentId)
          .order("created_at", { ascending: true })
      : supabase
          .from("trials")
          .select(
            "id, goal_id, value, created_at, session:sessions!inner(id, date, student_id)"
          )
          .eq("session.student_id", studentId)
          .order("created_at", { ascending: true }),
  ]);

  // buildGoalReport only cares about a goal's text/status/response_format —
  // "subject" fills the same slot "area" does on the SLP side.
  const goals: ProgressGoal[] = isTeacher
    ? (
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
      }))
    : ((goalsResult.data ?? []) as unknown as ProgressGoal[]);

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
        <SupervisorViewingBanner memberName={link.member_name} />

        <Link
          href={backHref}
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
