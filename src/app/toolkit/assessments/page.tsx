import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Assessment } from "@/lib/types";
import AssessmentsList from "./assessments-list";

export default async function AssessmentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: assessments, error } = await supabase
    .from("assessments")
    .select("id, name, description, created_at")
    .order("created_at", { ascending: false });

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
              href="/toolkit/goals"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Goal bank
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
          <h1 className="text-2xl font-bold text-slate-900">Assessments</h1>
          <p className="mt-1 text-slate-600">
            Build reusable assessments here, then run them against a student
            from their page.
          </p>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-600">
            Couldn&apos;t load assessments: {error.message}
          </p>
        )}

        <div className="mt-6">
          <AssessmentsList initialAssessments={(assessments ?? []) as Assessment[]} />
        </div>
      </div>
    </main>
  );
}
