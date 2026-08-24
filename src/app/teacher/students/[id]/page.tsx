import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/role";
import type { TeacherGoalWithRelations } from "@/lib/types";
import GoalsSection from "./goals-section";

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
    .select("id, name, class, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!student) {
    notFound();
  }

  const [goalsResult, subjectsResult, formatsResult, bankGoalsResult] =
    await Promise.all([
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
    ]);

  return (
    <main className="min-h-screen bg-cream-50 px-4 py-8 sm:px-6 sm:py-10">
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
      </div>
    </main>
  );
}
