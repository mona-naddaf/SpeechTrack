import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Area, AssessmentQuestion } from "@/lib/types";
import { flattenAssessmentAreas, type RawAssessmentWithAreasJoin } from "@/lib/assessment";
import AssessmentEditor from "./assessment-editor";

export default async function AssessmentEditorPage({
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

  // RLS scopes this to assessments owned by the signed-in SLP, so an
  // assessment that exists but belongs to someone else comes back as no
  // row, not an error.
  const { data: rawAssessment } = await supabase
    .from("assessments")
    .select(
      "id, name, description, kind, formality, created_at, assessment_areas(areas(id, name))"
    )
    .eq("id", id)
    .maybeSingle();

  if (!rawAssessment) {
    notFound();
  }

  const assessment = flattenAssessmentAreas([
    rawAssessment as unknown as RawAssessmentWithAreasJoin,
  ])[0];

  const [questionsResult, areasResult] = await Promise.all([
    supabase
      .from("assessment_questions")
      .select(
        "id, assessment_id, order_index, prompt, response_type, expected_answer, notes, choices, created_at"
      )
      .eq("assessment_id", id)
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase.from("areas").select("id, name").order("name", { ascending: true }),
  ]);
  const { data: questions, error } = questionsResult;

  return (
    <main className="flex-1 bg-cream-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/toolkit/assessments"
          className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-brand-800"
        >
          <ArrowLeft className="h-4 w-4" />
            Back to assessments
        </Link>

        {error && (
          <p className="mt-4 text-sm text-red-600">
            Couldn&apos;t load questions: {error.message}
          </p>
        )}

        <div className="mt-6">
          <AssessmentEditor
            assessment={assessment}
            initialQuestions={(questions ?? []) as AssessmentQuestion[]}
            areas={(areasResult.data ?? []) as Area[]}
          />
        </div>
      </div>
    </main>
  );
}
