import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Assessment, AssessmentQuestion } from "@/lib/types";
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
  const { data: assessment } = await supabase
    .from("assessments")
    .select("id, name, description, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!assessment) {
    notFound();
  }

  const { data: questions, error } = await supabase
    .from("assessment_questions")
    .select(
      "id, assessment_id, order_index, prompt, response_type, expected_answer, notes, created_at"
    )
    .eq("assessment_id", id)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/toolkit/assessments"
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          &larr; Back to assessments
        </Link>

        {error && (
          <p className="mt-4 text-sm text-red-600">
            Couldn&apos;t load questions: {error.message}
          </p>
        )}

        <div className="mt-6">
          <AssessmentEditor
            assessment={assessment as Assessment}
            initialQuestions={(questions ?? []) as AssessmentQuestion[]}
          />
        </div>
      </div>
    </main>
  );
}
