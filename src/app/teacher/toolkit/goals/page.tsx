import Link from "next/link";
import { ArrowLeft, Gamepad2, Library, ListTree, Sliders, Smile, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/role";
import type { ResponseFormatOption } from "@/lib/types";
import { resolveDefaultFormatId } from "@/lib/default-format";
import { TEACHER_GOAL_BANK } from "@/lib/goal-bank-config";
import GoalBankSection, { type BankGoalRow } from "@/components/goal-bank-section";

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

  // Explicit teacher_id filter, not just RLS: since
  // 0025_community_sharing_browse.sql added a second permissive SELECT
  // policy allowing *any* account's visibility='shared' rows, RLS alone
  // would also let another Teacher's shared bank goals/formats leak in.
  const [bankGoalsResult, subjectsResult, formatsResult] = await Promise.all([
    supabase
      .from("teacher_goals")
      .select(
        "id, category_id:subject_id, text, response_format_id, target_percent, visibility, created_at, category:teacher_subjects(id, name), response_format:teacher_response_formats(id, name)"
      )
      .eq("teacher_id", user.id)
      .is("student_id", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("teacher_subjects")
      .select("id, name")
      .order("name", { ascending: true }),
    supabase
      .from("teacher_response_formats")
      .select("id, name")
      .eq("teacher_id", user.id)
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
              href="/teacher/toolkit/track-templates"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <ListTree className="h-4 w-4" />
              Track templates
            </Link>
            <Link
              href="/teacher/toolkit/community"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Users className="h-4 w-4" />
              Community
            </Link>
            <Link
              href="/teacher/toolkit/reinforcement-boards"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Gamepad2 className="h-4 w-4" />
              Reinforcement bank
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
            config={TEACHER_GOAL_BANK}
            ownerId={user.id}
            initialGoals={(bankGoalsResult.data ?? []) as unknown as BankGoalRow[]}
            categories={subjectsResult.data ?? []}
            responseFormats={(formatsResult.data ?? []) as ResponseFormatOption[]}
            defaultFormatId={resolveDefaultFormatId(user, formatsResult.data ?? [])}
          />
        </div>
      </div>
    </main>
  );
}
