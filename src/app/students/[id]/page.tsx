import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  AssessmentAnswerValue,
  AssessmentQuestionResponseType,
  GoalWithRelations,
  HomePracticeItem,
  PracticeLogWithPraise,
} from "@/lib/types";
import { formatDate } from "@/lib/date";
import {
  computeAssessmentScore,
  flattenAssessmentAreas,
  type RawAssessmentWithAreasJoin,
} from "@/lib/assessment";
import GoalsSection from "./goals-section";
import ExportButtons from "./export-buttons";
import HomePracticeSection from "./home-practice-section";
import PracticeLogSection from "./practice-log-section";
import AssessmentsSection, {
  type AssessmentResultDisplay,
} from "./assessments-section";

export default async function StudentDetailPage({
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

  // RLS scopes this to students owned by the signed-in SLP, so a student
  // that exists but belongs to someone else comes back as no row, not an error.
  const { data: student } = await supabase
    .from("students")
    .select("id, name, class, parent_access_code, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!student) {
    notFound();
  }

  const [
    goalsResult,
    areasResult,
    formatsResult,
    bankGoalsResult,
    sessionsResult,
    homePracticeResult,
    practiceLogsResult,
    assessmentsResult,
    assessmentResultsResult,
  ] = await Promise.all([
    supabase
      .from("goals")
      .select(
        "id, student_id, area_id, text, response_format_id, baseline, target_percent, status, created_at, area:areas(id, name), response_format:response_formats(id, name)"
      )
      .eq("student_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("areas")
      .select("id, name")
      .order("name", { ascending: true }),
    supabase
      .from("response_formats")
      .select("id, name")
      .order("created_at", { ascending: true }),
    supabase
      .from("goals")
      .select("id, area_id, text, response_format_id, target_percent")
      .is("student_id", null)
      .order("text", { ascending: true }),
    supabase
      .from("sessions")
      .select("id, student_id, date, note, created_at")
      .eq("student_id", id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("home_practice_items")
      .select(
        "id, what_to_practice, how_to_practice, last_worked_date, created_at"
      )
      .eq("student_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("practice_logs")
      .select(
        "id, date, activities, how_it_went, note, created_at, praise(id, message, created_at)"
      )
      .eq("student_id", id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("assessments")
      .select(
        "id, name, description, kind, formality, created_at, assessment_areas(areas(id, name))"
      )
      .order("name", { ascending: true }),
    supabase
      .from("assessment_results")
      .select(
        "id, student_id, assessment_id, date, status, created_at, completed_at, assessment:assessments(id, name)"
      )
      .eq("student_id", id)
      .order("created_at", { ascending: false }),
  ]);

  // Assessment results need two more batched lookups (question counts per
  // assessment, and recorded answers per result) to show progress/score —
  // done here rather than per-row to avoid N+1 queries.
  const rawAssessmentResults = (assessmentResultsResult.data ?? []) as unknown as Array<{
    id: string;
    student_id: string;
    assessment_id: string;
    date: string;
    status: "in_progress" | "completed";
    created_at: string;
    completed_at: string | null;
    assessment: { id: string; name: string } | null;
  }>;

  const resultIds = rawAssessmentResults.map((r) => r.id);
  const assessmentIdsInUse = Array.from(
    new Set(rawAssessmentResults.map((r) => r.assessment_id))
  );

  const [questionRowsResult, answerRowsResult] =
    resultIds.length > 0
      ? await Promise.all([
          supabase
            .from("assessment_questions")
            .select("assessment_id")
            .in("assessment_id", assessmentIdsInUse),
          supabase
            .from("assessment_answers")
            .select("result_id, question_id, response_type, value")
            .in("result_id", resultIds),
        ])
      : [{ data: [] as { assessment_id: string }[] }, { data: [] as {
          result_id: string;
          question_id: string;
          response_type: AssessmentQuestionResponseType;
          value: AssessmentAnswerValue;
        }[] }];

  const totalQuestionsByAssessmentId = new Map<string, number>();
  for (const row of questionRowsResult.data ?? []) {
    totalQuestionsByAssessmentId.set(
      row.assessment_id,
      (totalQuestionsByAssessmentId.get(row.assessment_id) ?? 0) + 1
    );
  }

  const answersByResultId = new Map<
    string,
    { response_type: AssessmentQuestionResponseType; value: AssessmentAnswerValue }[]
  >();
  for (const row of answerRowsResult.data ?? []) {
    const list = answersByResultId.get(row.result_id) ?? [];
    list.push({ response_type: row.response_type, value: row.value });
    answersByResultId.set(row.result_id, list);
  }

  const assessmentResultDisplays: AssessmentResultDisplay[] = rawAssessmentResults.map(
    (r) => {
      const answers = answersByResultId.get(r.id) ?? [];
      return {
        id: r.id,
        assessmentId: r.assessment_id,
        assessmentName: r.assessment?.name ?? "Deleted assessment",
        date: r.date,
        status: r.status,
        completedAt: r.completed_at,
        totalQuestions: totalQuestionsByAssessmentId.get(r.assessment_id) ?? 0,
        answeredCount: answers.length,
        score: r.status === "completed" ? computeAssessmentScore(answers) : null,
      };
    }
  );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/dashboard"
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          &larr; Back to students
        </Link>

        <div className="mt-4">
          <h1 className="text-2xl font-bold text-slate-900">
            {student.name}
          </h1>
          <p className="mt-1 text-slate-600">{student.class || "No class"}</p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href={`/students/${student.id}/progress`}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            View progress
          </Link>
          <ExportButtons studentId={student.id} studentName={student.name} />
        </div>

        <div className="mt-8">
          <GoalsSection
            studentId={student.id}
            initialGoals={
              (goalsResult.data ?? []) as unknown as GoalWithRelations[]
            }
            initialGoalsError={goalsResult.error?.message ?? null}
            areas={areasResult.data ?? []}
            responseFormats={formatsResult.data ?? []}
            bankGoals={bankGoalsResult.data ?? []}
          />
        </div>

        <div className="mt-8">
          <AssessmentsSection
            studentId={student.id}
            assessments={flattenAssessmentAreas(
              (assessmentsResult.data ?? []) as unknown as RawAssessmentWithAreasJoin[]
            )}
            initialResults={assessmentResultDisplays}
            assessmentsError={assessmentsResult.error?.message ?? null}
            resultsError={assessmentResultsResult.error?.message ?? null}
          />
        </div>

        <div className="mt-8">
          <HomePracticeSection
            studentId={student.id}
            parentAccessCode={student.parent_access_code}
            initialItems={
              (homePracticeResult.data ?? []) as unknown as HomePracticeItem[]
            }
            initialError={homePracticeResult.error?.message ?? null}
          />
        </div>

        <div className="mt-8">
          <PracticeLogSection
            initialLogs={
              (practiceLogsResult.data ??
                []) as unknown as PracticeLogWithPraise[]
            }
            initialError={practiceLogsResult.error?.message ?? null}
          />
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-900">Sessions</h2>
            <Link
              href={`/students/${student.id}/session/new`}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
            >
              Start session
            </Link>
          </div>

          {sessionsResult.error && (
            <p className="mt-4 text-sm text-red-600">
              Couldn&apos;t load sessions: {sessionsResult.error.message}
            </p>
          )}

          {!sessionsResult.error && (sessionsResult.data ?? []).length === 0 && (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
              No sessions yet. Start a session to begin tracking progress.
            </div>
          )}

          {(sessionsResult.data ?? []).length > 0 && (
            <ul className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
              {(sessionsResult.data ?? []).map((session) => (
                <li key={session.id} className="px-4 py-3 sm:px-5">
                  <p className="font-medium text-slate-900">
                    {formatDate(session.date)}
                  </p>
                  {session.note ? (
                    <p className="mt-1 text-sm text-slate-600">
                      {session.note}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-slate-400">No note</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
