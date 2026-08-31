import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/role";
import { verifySupervisorLink } from "@/lib/supervisor";
import type {
  AssessmentAnswerValue,
  AssessmentQuestion,
  AssessmentQuestionResponseType,
} from "@/lib/types";
import SupervisorViewingBanner from "@/components/supervisor-viewing-banner";
// Pure display — safe to reuse unchanged. AssessmentAdminister (the
// mutation-heavy counterpart for in-progress results) is deliberately
// never imported here.
import AssessmentReport from "@/app/students/[id]/assessment/[resultId]/assessment-report";

export default async function SupervisorAssessmentResultPage({
  params,
}: {
  params: Promise<{ id: string; studentId: string; resultId: string }>;
}) {
  const { id, studentId, resultId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const role = getUserRole(user);
  if (role !== "supervisor") {
    redirect(role === "teacher" ? "/teacher/dashboard" : "/dashboard");
  }

  const link = await verifySupervisorLink(supabase, id);
  if (!link) {
    notFound();
  }

  // Assessments are an SLP-only feature — there's no teacher_assessments
  // table or route anywhere in this app.
  if (link.member_role === "teacher") {
    notFound();
  }

  const backHref = `/supervisor/members/${id}/students/${studentId}`;

  const { data: student } = await supabase
    .from("students")
    .select("id, slp_id, name")
    .eq("id", studentId)
    .maybeSingle();

  if (!student || student.slp_id !== id) {
    notFound();
  }

  const { data: result } = await supabase
    .from("assessment_results")
    .select("id, student_id, assessment_id, date, status")
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

  return (
    <main className="flex-1 bg-cream-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <SupervisorViewingBanner memberName={link.member_name} />

        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-brand-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {student.name}
        </Link>

        <div className="mt-6">
          {result.status === "completed" ? (
            <CompletedAssessmentReport
              studentName={student.name}
              assessmentId={result.assessment_id}
              resultId={result.id}
              assessmentName={assessment?.name ?? "Deleted assessment"}
              assessmentDescription={assessment?.description ?? null}
              date={result.date}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center">
              <p className="font-semibold text-stone-900">
                {assessment?.name ?? "Deleted assessment"} is still in progress
              </p>
              <p className="mt-1 text-sm text-stone-500">
                A read-only view for in-progress assessments isn&apos;t
                available yet — check back once it&apos;s marked complete.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

/** Small server component just to keep the two follow-up queries
 *  (questions + answers) out of the main render path above until we
 *  know the result is actually completed. */
async function CompletedAssessmentReport({
  studentName,
  assessmentId,
  resultId,
  assessmentName,
  assessmentDescription,
  date,
}: {
  studentName: string;
  assessmentId: string;
  resultId: string;
  assessmentName: string;
  assessmentDescription: string | null;
  date: string;
}) {
  const supabase = await createClient();

  const [questionsResult, answersResult] = await Promise.all([
    supabase
      .from("assessment_questions")
      .select(
        "id, assessment_id, order_index, prompt, response_type, expected_answer, notes, choices, created_at"
      )
      .eq("assessment_id", assessmentId)
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("assessment_answers")
      .select("id, result_id, question_id, response_type, value, created_at")
      .eq("result_id", resultId),
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
    <>
      {questionsResult.error && (
        <p className="mb-4 text-sm text-red-600">
          Couldn&apos;t load questions: {questionsResult.error.message}
        </p>
      )}
      {answersResult.error && (
        <p className="mb-4 text-sm text-red-600">
          Couldn&apos;t load answers: {answersResult.error.message}
        </p>
      )}
      <AssessmentReport
        studentName={studentName}
        assessmentName={assessmentName}
        assessmentDescription={assessmentDescription}
        date={date}
        questions={questions}
        answersByQuestionId={answersByQuestionId}
      />
    </>
  );
}
