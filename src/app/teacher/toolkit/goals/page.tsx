import Link from "next/link";
import { ArrowLeft, Library, Sliders, Smile, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/role";
import type { ResponseFormatOption, TeacherSubject } from "@/lib/types";
import GoalBankSection, {
  type TeacherBankGoalWithRelations,
} from "./goal-bank-section";

export default async function TeacherGoalBankPage() {
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

  const [bankGoalsResult, subjectsResult, formatsResult] = await Promise.all([
    supabase
      .from("teacher_goals")
      .select(
        "id, student_id, subject_id, text, response_format_id, target_percent, visibility, created_at, subject:teacher_subjects(id, name), response_format:teacher_response_formats(id, name)"
      )
      .is("student_id", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("teacher_subjects")
      .select("id, name")
      .order("name", { ascending: true }),
    supabase
      .from("teacher_response_formats")
      .select("id, name")
      .order("created_at", { ascending: true }),
  ]);

  return (
    <main className="flex-1 bg-cream-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/teacher/dashboard"
            className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-brand-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/teacher/toolkit/subjects"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Sliders className="h-4 w-4" />
              Subjects &amp; formats
            </Link>
            <Link
              href="/teacher/toolkit/behavior-types"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Smile className="h-4 w-4" />
              Behavior types
            </Link>
            <Link
              href="/teacher/toolkit/materials"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Library className="h-4 w-4" />
              Materials
            </Link>
            <Link
              href="/teacher/toolkit/community"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Users className="h-4 w-4" />
              Community
            </Link>
          </div>
        </div>

        <div className="mt-4">
          <h1 className="text-2xl font-bold text-stone-900">Goal bank</h1>
          <p className="mt-1 text-stone-600">
            Goals here aren&apos;t tied to a student yet. Add them here once,
            then pick from the bank whenever you set a goal on a student.
          </p>
        </div>

        {bankGoalsResult.error && (
          <p className="mt-4 text-sm text-red-600">
            Couldn&apos;t load the goal bank: {bankGoalsResult.error.message}
          </p>
        )}

        <div className="mt-6">
          <GoalBankSection
            initialGoals={
              (bankGoalsResult.data ??
                []) as unknown as TeacherBankGoalWithRelations[]
            }
            subjects={(subjectsResult.data ?? []) as TeacherSubject[]}
            responseFormats={
              (formatsResult.data ?? []) as ResponseFormatOption[]
            }
          />
        </div>
      </div>
    </main>
  );
}
