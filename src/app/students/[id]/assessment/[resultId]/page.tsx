import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AssessmentAnswerValue, AssessmentQuestion, AssessmentQuestionResponseType } from "@/lib/types";
import AssessmentAdminister from "./assessment-administer";
import AssessmentReport from "./assessment-report";

export default async function AssessmentResultPage({
  params,
}: {
  params: Promise<{ id: string; resultId: string }>;
}) {
  const { id, resultId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: student } = await supabase
    .from("students")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  if (!student) {
    notFound();
  }

  // RLS scopes this to results owned by the signed-in SLP, so a result that
  // exists but belongs to someone else (or a mismatched student id in the
  // URL) comes back as no row / a guard below, not an error.
  const { data: result } = await supabase
    .from("assessment_results")
    .select("id, student_id, assessment_id, date, status, created_at, completed_at")
    .eq("id", resultId)
    .maybeSingle();

  if (!result || result.student_id !== student.id) {
    notFound();
  }

  const { data: assessment } = await supabase
    .from("assessments")
    .select("id, name, description")
    .eq("id", result.assessment_id)
    .maybeSingle();

  const [questionsResult, answersResult] = await Promise.all([
    supabase
      .from("assessment_questions")
      .select(
        "id, assessment_id, order_index, prompt, response_type, expected_answer, notes, choices, created_at"
      )
      .eq("assessment_id", result.assessment_id)
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("assessment_answers")
      .select("id, result_id, question_id, response_type, value, created_at")
      .eq("result_id", result.id),
  ]);

  const questions = (questionsResult.data ?? []) as AssessmentQuestion[];
  const answersByQuestionId = new Map<
    string,
    { response_type: AssessmentQuestionResponseType; value: AssessmentAnswerValue }
  >();
  for (const a of answersResult.data ?? []) {
    answersByQuestionId.set(a.question_id, {
      response_type: a.response_type,
      value: a.value as AssessmentAnswerValue,
    });
  }

  return (
    <main className="flex-1 bg-cream-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/students/${student.id}`}
          className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-brand-800"
        >
          <ArrowLeft className="h-4 w-4" />
            Back to {student.name}
        </Link>

        {questionsResult.error && (
          <p className="mt-4 text-sm text-red-600">
            Couldn&apos;t load questions: {questionsResult.error.message}
          </p>
        )}
        {answersResult.error && (
          <p className="mt-4 text-sm text-red-600">
            Couldn&apos;t load answers: {answersResult.error.message}
          </p>
        )}

        <div className="mt-6">
          {result.status === "completed" ? (
            <AssessmentReport
              studentName={student.name}
              assessmentName={assessment?.name ?? "Deleted assessment"}
              assessmentDescription={assessment?.description ?? null}
              date={result.date}
              questions={questions}
              answersByQuestionId={answersByQuestionId}
            />
          ) : (
            <AssessmentAdminister
              resultId={result.id}
              assessmentName={assessment?.name ?? "Deleted assessment"}
              assessmentDescription={assessment?.description ?? null}
              questions={questions}
              initialAnswersByQuestionId={answersByQuestionId}
            />
          )}
        </div>
      </div>
    </main>
  );
}
