import Link from "next/link";
import { ArrowLeft, Library, Sliders, Smile, Target, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Area } from "@/lib/types";
import { flattenAssessmentAreas, type RawAssessmentWithAreasJoin } from "@/lib/assessment";
import AssessmentsList from "./assessments-list";

export default async function AssessmentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [assessmentsResult, areasResult] = await Promise.all([
    supabase
      .from("assessments")
      .select(
        "id, name, description, kind, formality, created_at, assessment_areas(areas(id, name))"
      )
      .order("created_at", { ascending: false }),
    supabase.from("areas").select("id, name").order("name", { ascending: true }),
  ]);
  const { error } = assessmentsResult;
  const assessments = flattenAssessmentAreas(
    (assessmentsResult.data ?? []) as unknown as RawAssessmentWithAreasJoin[]
  );

  return (
    <main className="flex-1 bg-cream-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-brand-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/toolkit/goals"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Target className="h-4 w-4" />
              Goal bank
            </Link>
            <Link
              href="/toolkit/formats"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Sliders className="h-4 w-4" />
              Response formats
            </Link>
            <Link
              href="/toolkit/behavior-types"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Smile className="h-4 w-4" />
              Behavior types
            </Link>
            <Link
              href="/toolkit/materials"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Library className="h-4 w-4" />
              Materials
            </Link>
            <Link
              href="/toolkit/community"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Users className="h-4 w-4" />
              Community
            </Link>
          </div>
        </div>

        <div className="mt-4">
          <h1 className="text-2xl font-bold text-stone-900">Assessments</h1>
          <p className="mt-1 text-stone-600">
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
          <AssessmentsList
            initialAssessments={assessments}
            areas={(areasResult.data ?? []) as Area[]}
          />
        </div>
      </div>
    </main>
  );
}
