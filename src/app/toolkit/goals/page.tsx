import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Area, ResponseFormatOption } from "@/lib/types";
import GoalBankSection, { type BankGoalWithRelations } from "./goal-bank-section";

export default async function GoalBankPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [bankGoalsResult, areasResult, formatsResult] = await Promise.all([
    supabase
      .from("goals")
      .select(
        "id, student_id, area_id, text, response_format_id, target_percent, created_at, area:areas(id, name), response_format:response_formats(id, name)"
      )
      .is("student_id", null)
      .order("created_at", { ascending: false }),
    supabase.from("areas").select("id, name").order("name", { ascending: true }),
    supabase
      .from("response_formats")
      .select("id, name")
      .order("created_at", { ascending: true }),
  ]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            &larr; Back to dashboard
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/toolkit/assessments"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Assessments
            </Link>
            <Link
              href="/toolkit/formats"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Response formats
            </Link>
          </div>
        </div>

        <div className="mt-4">
          <h1 className="text-2xl font-bold text-slate-900">Goal bank</h1>
          <p className="mt-1 text-slate-600">
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
              (bankGoalsResult.data ?? []) as unknown as BankGoalWithRelations[]
            }
            areas={(areasResult.data ?? []) as Area[]}
            responseFormats={(formatsResult.data ?? []) as ResponseFormatOption[]}
          />
        </div>
      </div>
    </main>
  );
}
