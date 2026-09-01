import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type {
  AssessmentAnswerValue,
  AssessmentQuestionResponseType,
  AttendanceRecord,
  GoalWithRelations,
  HomePracticeItem,
  PracticeLogWithPraise,
  SlpBehaviorLogWithType,
  StudentCustomField,
} from "@/lib/types";
import {
  resolveMaterialChipsByGoal,
  type RawGoalMaterialLink,
} from "@/lib/materials";
import { getTodayLocalDateString } from "@/lib/date";
import {
  computeAssessmentScore,
  flattenAssessmentAreas,
  type RawAssessmentWithAreasJoin,
} from "@/lib/assessment";
import { computeCadenceStreak, formatCadenceStreakLabel } from "@/lib/streaks";
import { formatScheduledDays } from "@/lib/schedule";
import { SLP_STUDENT_TOUR_STEPS } from "@/lib/onboarding-tour";
import StreakBadge from "@/components/streak-badge";
import AvatarBadge from "@/components/avatar-badge";
import AttendanceSection from "@/components/attendance-section";
import GenerateReportButton from "@/components/generate-report-button";
import SessionsSection from "@/components/sessions-section";
import SectionPreferencesProvider from "@/components/section-preferences";
import StudentTour from "@/components/student-tour";
import StudentInfoSection from "./student-info-section";
import GoalsSection from "./goals-section";
import ExportButtons from "./export-buttons";
import HomePracticeSection from "./home-practice-section";
import PracticeLogSection from "./practice-log-section";
import BehaviorSection from "./behavior-section";
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
    .select(
      "id, name, class, parent_access_code, share_behavior_with_parent, expected_frequency, avatar, scheduled_days, created_at, date_of_birth, mother_email, father_email, homeroom_teacher, custom_fields:student_custom_fields(id, student_id, label, value, created_at)"
    )
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
    behaviorLogsResult,
    behaviorTypesResult,
    attendanceResult,
  ] = await Promise.all([
    supabase
      .from("goals")
      .select(
        "id, student_id, area_id, text, response_format_id, baseline, target_percent, status, source_bank_goal_id, created_at, area:areas(id, name), response_format:response_formats(id, name)"
      )
      .eq("student_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("areas")
      .select("id, name")
      .order("name", { ascending: true }),
    // Both queries below add an explicit slp_id filter, not just RLS:
    // since 0025_community_sharing_browse.sql added a second permissive
    // SELECT policy allowing *any* account's visibility='shared' rows,
    // RLS alone would also let another SLP's shared formats/bank goals
    // leak into these two pickers.
    supabase
      .from("response_formats")
      .select("id, name")
      .eq("slp_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("goals")
      .select("id, area_id, text, response_format_id, target_percent")
      .eq("slp_id", user.id)
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
    supabase
      .from("slp_behavior_logs")
      .select(
        "id, student_id, date, behavior_type_id, severity, note, created_at, behavior_type:behavior_types(id, name, color)"
      )
      .eq("student_id", id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("behavior_types")
      .select("id, name, color")
      .order("name", { ascending: true }),
    supabase
      .from("attendance_records")
      .select("id, student_id, date, reason, reason_note, created_at")
      .eq("student_id", id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  // Materials linked to any of this student's goals, for the chips shown
  // on each goal card — a follow-up query since it depends on the goal
  // ids just fetched above. Also checks each goal's bank template
  // (source_bank_goal_id), since a material can be linked at that level
  // instead of to one specific student's goal row.
  const studentGoals = (goalsResult.data ?? []) as unknown as {
    id: string;
    source_bank_goal_id: string | null;
  }[];
  const studentGoalIds = studentGoals.map((g) => g.id);
  const studentBankGoalIds = Array.from(
    new Set(
      studentGoals
        .map((g) => g.source_bank_goal_id)
        .filter((bankId): bankId is string => Boolean(bankId))
    )
  );
  const materialLookupGoalIds = Array.from(
    new Set([...studentGoalIds, ...studentBankGoalIds])
  );
  const materialLinksResult =
    materialLookupGoalIds.length > 0
      ? await supabase
          .from("material_goals")
          .select("goal_id, material:materials(id, title, url)")
          .in("goal_id", materialLookupGoalIds)
      : { data: [] as RawGoalMaterialLink[] };
  const materialsByGoalId = resolveMaterialChipsByGoal(
    studentGoals,
    (materialLinksResult.data ?? []) as unknown as RawGoalMaterialLink[]
  );

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

  const sessionStreak = computeCadenceStreak(
    (sessionsResult.data ?? []).map((s) => s.date),
    student.expected_frequency,
    getTodayLocalDateString(),
    (attendanceResult.data ?? []).map((a) => a.date)
  );

  return (
    <main className="flex-1 bg-cream-50 px-4 py-8 sm:px-6 sm:py-10">
      <StudentTour role="slp" steps={SLP_STUDENT_TOUR_STEPS} />
      <div className="mx-auto max-w-3xl">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-brand-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to students
        </Link>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AvatarBadge avatar={student.avatar} size="lg" />
            <div>
              <h1 className="text-2xl font-bold text-stone-900">
                {student.name}
              </h1>
              <p className="text-stone-600">{student.class || "No class"}</p>
              {student.scheduled_days.length > 0 && (
                <p className="mt-0.5 text-xs text-stone-400">
                  Scheduled: {formatScheduledDays(student.scheduled_days)}
                </p>
              )}
            </div>
          </div>
          <StreakBadge
            streak={sessionStreak}
            storageKey={`slp-session-streak:${student.id}`}
            label={formatCadenceStreakLabel(
              sessionStreak,
              student.expected_frequency
            )}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href={`/students/${student.id}/progress`}
            data-tour="student-view-progress"
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-stone-50 hover:shadow-md"
          >
            <TrendingUp className="h-4 w-4" />
            View progress
          </Link>
          <ExportButtons studentId={student.id} studentName={student.name} />
          <GenerateReportButton studentId={student.id} studentName={student.name} />
        </div>

        <SectionPreferencesProvider
          storageKey="bloomtrack:student-page-sections:slp"
          sections={[
            {
              key: "student_info",
              defaultCollapsed: false,
              node: (
                <StudentInfoSection
                  studentId={student.id}
                  studentClass={student.class}
                  initialValues={{
                    dateOfBirth: student.date_of_birth,
                    motherEmail: student.mother_email,
                    fatherEmail: student.father_email,
                    homeroomTeacher: student.homeroom_teacher,
                  }}
                  initialCustomFields={
                    (student.custom_fields ??
                      []) as unknown as StudentCustomField[]
                  }
                />
              ),
            },
            {
              key: "goals",
              defaultCollapsed: false,
              node: (
                <GoalsSection
                  studentId={student.id}
                  initialGoals={
                    (goalsResult.data ?? []) as unknown as GoalWithRelations[]
                  }
                  initialGoalsError={goalsResult.error?.message ?? null}
                  areas={areasResult.data ?? []}
                  responseFormats={formatsResult.data ?? []}
                  bankGoals={bankGoalsResult.data ?? []}
                  materialsByGoalId={materialsByGoalId}
                />
              ),
            },
            {
              key: "assessments",
              defaultCollapsed: true,
              node: (
                <AssessmentsSection
                  studentId={student.id}
                  assessments={flattenAssessmentAreas(
                    (assessmentsResult.data ??
                      []) as unknown as RawAssessmentWithAreasJoin[]
                  )}
                  initialResults={assessmentResultDisplays}
                  assessmentsError={assessmentsResult.error?.message ?? null}
                  resultsError={assessmentResultsResult.error?.message ?? null}
                />
              ),
            },
            {
              key: "home_practice",
              defaultCollapsed: true,
              node: (
                <HomePracticeSection
                  studentId={student.id}
                  parentAccessCode={student.parent_access_code}
                  initialItems={
                    (homePracticeResult.data ??
                      []) as unknown as HomePracticeItem[]
                  }
                  initialError={homePracticeResult.error?.message ?? null}
                />
              ),
            },
            {
              key: "practice_log",
              defaultCollapsed: true,
              node: (
                <PracticeLogSection
                  initialLogs={
                    (practiceLogsResult.data ??
                      []) as unknown as PracticeLogWithPraise[]
                  }
                  initialError={practiceLogsResult.error?.message ?? null}
                />
              ),
            },
            {
              key: "behavior",
              defaultCollapsed: true,
              node: (
                <BehaviorSection
                  studentId={student.id}
                  initialLogs={
                    (behaviorLogsResult.data ??
                      []) as unknown as SlpBehaviorLogWithType[]
                  }
                  initialLogsError={behaviorLogsResult.error?.message ?? null}
                  behaviorTypes={behaviorTypesResult.data ?? []}
                  shareBehaviorWithParent={student.share_behavior_with_parent}
                />
              ),
            },
            {
              key: "attendance",
              defaultCollapsed: true,
              node: (
                <AttendanceSection
                  studentId={student.id}
                  ownerId={user.id}
                  ownerField="slp_id"
                  initialRecords={
                    (attendanceResult.data ??
                      []) as unknown as AttendanceRecord[]
                  }
                  initialError={attendanceResult.error?.message ?? null}
                />
              ),
            },
            {
              key: "sessions",
              defaultCollapsed: true,
              node: (
                <SessionsSection
                  sessions={sessionsResult.data ?? []}
                  error={sessionsResult.error?.message ?? null}
                  newSessionHref={`/students/${student.id}/session/new`}
                />
              ),
            },
          ]}
        />
      </div>
    </main>
  );
}
