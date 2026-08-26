import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarClock, PlayCircle, TrendingUp, User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/role";
import { formatDate } from "@/lib/date";
import type {
  BehaviorLogWithType,
  HomePracticeItem,
  PracticeLogWithPraise,
  TeacherGoalWithRelations,
} from "@/lib/types";
import GoalsSection from "./goals-section";
import BehaviorSection from "./behavior-section";
import HomePracticeSection from "./home-practice-section";
import PracticeLogSection from "./practice-log-section";
import ExportButtons from "./export-buttons";

export default async function TeacherStudentDetailPage({
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

  // RLS scopes this to students owned by the signed-in Teacher, so a
  // student that exists but belongs to someone else comes back as no row,
  // not an error.
  const { data: student } = await supabase
    .from("teacher_students")
    .select(
      "id, name, class, parent_access_code, share_behavior_with_parent, created_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (!student) {
    notFound();
  }

  const [
    goalsResult,
    subjectsResult,
    formatsResult,
    bankGoalsResult,
    behaviorLogsResult,
    behaviorTypesResult,
    sessionsResult,
    homePracticeResult,
    practiceLogsResult,
  ] = await Promise.all([
    supabase
      .from("teacher_goals")
      .select(
        "id, student_id, subject_id, text, response_format_id, baseline, target_percent, status, created_at, subject:teacher_subjects(id, name), response_format:teacher_response_formats(id, name)"
      )
      .eq("student_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("teacher_subjects")
      .select("id, name")
      .order("name", { ascending: true }),
    supabase
      .from("teacher_response_formats")
      .select("id, name")
      .order("created_at", { ascending: true }),
    supabase
      .from("teacher_goals")
      .select("id, subject_id, text, response_format_id, target_percent")
      .is("student_id", null)
      .order("text", { ascending: true }),
    supabase
      .from("behavior_logs")
      .select(
        "id, student_id, date, behavior_type_id, severity, note, created_at, behavior_type:teacher_behavior_types(id, name, color)"
      )
      .eq("student_id", id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("teacher_behavior_types")
      .select("id, name, color")
      .order("name", { ascending: true }),
    supabase
      .from("teacher_sessions")
      .select("id, student_id, date, note, created_at")
      .eq("student_id", id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("teacher_home_practice_items")
      .select(
        "id, what_to_practice, how_to_practice, last_worked_date, created_at"
      )
      .eq("student_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("teacher_practice_logs")
      .select(
        "id, date, activities, how_it_went, note, created_at, praise:teacher_praise(id, message, created_at)"
      )
      .eq("student_id", id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  return (
    <main className="flex-1 bg-cream-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/teacher/dashboard"
          className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-brand-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to students
        </Link>

        <div className="mt-4 flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-100">
            <User className="h-6 w-6 text-accent-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-stone-900">
              {student.name}
            </h1>
            <p className="text-stone-600">{student.class || "No class"}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href={`/teacher/students/${student.id}/progress`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-stone-50 hover:shadow-md"
          >
            <TrendingUp className="h-4 w-4" />
            View progress
          </Link>
          <ExportButtons studentId={student.id} studentName={student.name} />
        </div>

        <div className="mt-8">
          <GoalsSection
            studentId={student.id}
            initialGoals={
              (goalsResult.data ?? []) as unknown as TeacherGoalWithRelations[]
            }
            initialGoalsError={goalsResult.error?.message ?? null}
            subjects={subjectsResult.data ?? []}
            responseFormats={formatsResult.data ?? []}
            bankGoals={bankGoalsResult.data ?? []}
          />
        </div>

        <div className="mt-8">
          <HomePracticeSection
            studentId={student.id}
            parentAccessCode={student.parent_access_code}
            initialItems={
              (homePracticeResult.data ?? []) as unknown as HomePracticeItem[]
            }
            initialError={homePracticeResult.error?.message ?? null}
          />
        </div>

        <div className="mt-8">
          <PracticeLogSection
            initialLogs={
              (practiceLogsResult.data ??
                []) as unknown as PracticeLogWithPraise[]
            }
            initialError={practiceLogsResult.error?.message ?? null}
          />
        </div>

        <div className="mt-8">
          <BehaviorSection
            studentId={student.id}
            initialLogs={
              (behaviorLogsResult.data ?? []) as unknown as BehaviorLogWithType[]
            }
            initialLogsError={behaviorLogsResult.error?.message ?? null}
            behaviorTypes={behaviorTypesResult.data ?? []}
            shareBehaviorWithParent={student.share_behavior_with_parent}
          />
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
              <CalendarClock className="h-5 w-5 text-brand-500" />
              Sessions
            </h2>
            <Link
              href={`/teacher/students/${student.id}/session/new`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md"
            >
              <PlayCircle className="h-4 w-4" />
              Start session
            </Link>
          </div>

          {sessionsResult.error && (
            <p className="mt-4 text-sm text-red-600">
              Couldn&apos;t load sessions: {sessionsResult.error.message}
            </p>
          )}

          {!sessionsResult.error && (sessionsResult.data ?? []).length === 0 && (
            <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
                <CalendarClock className="h-6 w-6 text-brand-500" />
              </div>
              <p className="text-stone-500">
                No sessions yet — start one to begin tracking progress.
              </p>
            </div>
          )}

          {(sessionsResult.data ?? []).length > 0 && (
            <ul className="mt-4 divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md">
              {(sessionsResult.data ?? []).map((session) => (
                <li key={session.id} className="px-4 py-3 sm:px-5">
                  <p className="font-medium text-stone-900">
                    {formatDate(session.date)}
                  </p>
                  {session.note ? (
                    <p className="mt-1 text-sm text-stone-600">
                      {session.note}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-stone-400">No note</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
