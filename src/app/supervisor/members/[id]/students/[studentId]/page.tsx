import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/role";
import { verifySupervisorLink } from "@/lib/supervisor";
import type {
  AssessmentAnswerValue,
  AssessmentQuestionResponseType,
  AttendanceRecord,
  GoalWithRelations,
  HomePracticeItem,
  PackageManualEntry,
  PracticeLogWithPraise,
  SessionRecord,
  StudentCustomField,
  StudentPackage,
  StudentTag,
  TeacherGoalWithRelations,
  TeacherStudentCustomField,
} from "@/lib/types";
import type { AssessmentResultDisplay } from "@/app/students/[id]/assessments-section";
import {
  resolveMaterialChipsByGoal,
  type RawGoalMaterialLink,
} from "@/lib/materials";
import { eachDateInRange, getTodayLocalDateString } from "@/lib/date";
import { computeAssessmentScore } from "@/lib/assessment";
import { computeCadenceStreak, formatCadenceStreakLabel } from "@/lib/streaks";
import { formatSchedule } from "@/lib/schedule";
import { buildPackageItems } from "@/lib/packages";
import StreakBadge from "@/components/streak-badge";
import AvatarBadge from "@/components/avatar-badge";
import SectionPreferencesProvider from "@/components/section-preferences";
import PackageSection from "@/components/package-section";
import StudentStatusHeader from "@/components/student-status-header";
import SupervisorViewingBanner from "@/components/supervisor-viewing-banner";
import StudentInfoView from "./student-info-view";
import GoalsView, { type SupervisorGoalDisplay } from "./goals-view";
import AssessmentsView from "./assessments-view";
import HomePracticeView from "./home-practice-view";
import PracticeLogView from "./practice-log-view";
import BehaviorView, { type SupervisorBehaviorLogDisplay } from "./behavior-view";
import AttendanceView from "./attendance-view";
import SessionsView from "./sessions-view";

export default async function SupervisorStudentDetailPage({
  params,
}: {
  params: Promise<{ id: string; studentId: string }>;
}) {
  const { id, studentId } = await params;
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

  // Never trust the `id`/`studentId` route params on their own — this
  // only returns a row when the signed-in supervisor is actually linked
  // to this member, and every query below is additionally scoped by the
  // "Supervisors can view linked members' ..." RLS policies.
  const link = await verifySupervisorLink(supabase, id);
  if (!link) {
    notFound();
  }

  const isTeacher = link.member_role === "teacher";
  const basePath = `/supervisor/members/${id}/students/${studentId}`;

  if (isTeacher) {
    const { data: student } = await supabase
      .from("teacher_students")
      .select(
        "id, teacher_id, name, class, expected_frequency, avatar, scheduled_days, schedule_end_date, date_of_birth, mother_email, father_email, homeroom_teacher, status, archived_at, custom_fields:teacher_student_custom_fields(id, student_id, label, value, created_at)"
      )
      .eq("id", studentId)
      .maybeSingle();

    // A student that exists but doesn't belong to *this* linked member
    // (e.g. the URL was hand-edited to point at a different member's
    // student) — RLS would still allow reading it if the supervisor is
    // linked to whoever actually owns it, so this equality check catches
    // a mismatched URL rather than a real access-control gap.
    if (!student || student.teacher_id !== id) {
      notFound();
    }

    const [
      goalsResult,
      behaviorLogsResult,
      behaviorTypesResult,
      sessionsResult,
      homePracticeResult,
      practiceLogsResult,
      attendanceResult,
      holidaysResult,
      packagesResult,
      manualEntriesResult,
      tagLinksResult,
    ] = await Promise.all([
      supabase
        .from("teacher_goals")
        .select(
          "id, student_id, subject_id, text, response_format_id, target_percent, status, visible_to_parent, source_bank_goal_id, created_at, subject:teacher_subjects(id, name)"
        )
        .eq("student_id", studentId)
        .order("created_at", { ascending: false }),
      supabase
        .from("behavior_logs")
        .select(
          "id, date, severity, note, created_at, behavior_type:teacher_behavior_types(id, name, color)"
        )
        .eq("student_id", studentId)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false }),
      // Explicit teacher_id filter, not just RLS: 0023's
      // is_supervisor_of() policy makes every one of a supervisor's
      // *linked members'* teacher_behavior_types visible, not just this
      // one -- the same "a permissive multi-row-visible SELECT policy
      // needs every existing unfiltered query on that table to add an
      // explicit owner filter" issue 0025_community_sharing_browse.sql's
      // fix pattern addresses elsewhere, just from a different policy.
      // Without this, a supervisor linked to more than one Teacher would
      // see every linked member's color palette combined here, not just
      // this student's own teacher's.
      supabase
        .from("teacher_behavior_types")
        .select("id, name, color")
        .eq("teacher_id", id)
        .order("name", { ascending: true }),
      supabase
        .from("teacher_sessions")
        .select("id, student_id, date, note, created_at")
        .eq("student_id", studentId)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("teacher_home_practice_items")
        .select("id, what_to_practice, how_to_practice, last_worked_date, created_at")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false }),
      supabase
        .from("teacher_practice_logs")
        .select(
          "id, date, activities, how_it_went, note, created_at, praise:teacher_praise(id, message, created_at)"
        )
        .eq("student_id", studentId)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("attendance_records")
        .select("id, student_id, date, reason, reason_note, counts_toward_package, created_at")
        .eq("student_id", studentId)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false }),
      // Not student-specific, and unlike attendance_records above there's
      // no student_id to scope by -- an explicit teacher_id filter (not
      // just RLS's is_supervisor_of() check) keeps this to *this* linked
      // member's holidays specifically, in case the supervisor is linked
      // to more than one member.
      supabase.from("holidays").select("start_date, end_date").eq("teacher_id", id),
      supabase
        .from("student_packages")
        .select("id, student_id, total_sessions, start_date, ended_at, created_at")
        .eq("teacher_id", id)
        .eq("student_id", studentId),
      supabase
        .from("package_manual_entries")
        .select("id, student_id, date, note, created_at")
        .eq("teacher_id", id)
        .eq("student_id", studentId),
      supabase
        .from("teacher_student_tag_links")
        .select("tag:teacher_student_tags(id, name, color)")
        .eq("student_id", studentId),
    ]);
    const studentTags = (
      (tagLinksResult.data ?? []) as unknown as { tag: StudentTag | null }[]
    )
      .map((l) => l.tag)
      .filter((t): t is StudentTag => Boolean(t))
      .sort((a, b) => a.name.localeCompare(b.name));

    const rawGoals = (goalsResult.data ?? []) as unknown as TeacherGoalWithRelations[];
    const goalsForMaterials = (goalsResult.data ?? []) as unknown as {
      id: string;
      source_bank_goal_id: string | null;
    }[];
    const goalIds = goalsForMaterials.map((g) => g.id);
    const bankGoalIds = Array.from(
      new Set(
        goalsForMaterials
          .map((g) => g.source_bank_goal_id)
          .filter((bankId): bankId is string => Boolean(bankId))
      )
    );
    const materialLookupGoalIds = Array.from(new Set([...goalIds, ...bankGoalIds]));
    const materialLinksResult =
      materialLookupGoalIds.length > 0
        ? await supabase
            .from("teacher_material_goals")
            .select("goal_id, material:teacher_materials(id, title, url)")
            .in("goal_id", materialLookupGoalIds)
        : { data: [] as RawGoalMaterialLink[] };
    const materialsByGoalId = resolveMaterialChipsByGoal(
      goalsForMaterials,
      (materialLinksResult.data ?? []) as unknown as RawGoalMaterialLink[]
    );

    const goals: SupervisorGoalDisplay[] = rawGoals.map((g) => ({
      id: g.id,
      category: g.subject,
      text: g.text,
      target_percent: g.target_percent,
      status: g.status,
      visible_to_parent: g.visible_to_parent,
    }));

    const sessions = (sessionsResult.data ?? []) as SessionRecord[];
    const attendance = (attendanceResult.data ?? []) as AttendanceRecord[];
    const sessionStreak = computeCadenceStreak(
      sessions.map((s) => s.date),
      student.expected_frequency,
      getTodayLocalDateString(),
      [
        ...attendance.map((a) => a.date),
        ...(holidaysResult.data ?? []).flatMap((h) =>
          eachDateInRange(h.start_date, h.end_date)
        ),
      ]
    );

    return (
      <main className="flex-1 bg-cream-50 px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-3xl">
          <SupervisorViewingBanner memberName={link.member_name} />

          <Link
            href={`/supervisor/members/${id}`}
            className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-brand-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to students
          </Link>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AvatarBadge avatar={student.avatar} size="lg" />
              <div>
                <h1 className="text-2xl font-bold text-stone-900">{student.name}</h1>
                <p className="text-stone-600">{student.class || "No class"}</p>
                {student.scheduled_days.length > 0 && (
                  <p className="mt-0.5 text-xs text-stone-400">
                    Scheduled:{" "}
                    {formatSchedule(
                      student.scheduled_days,
                      student.schedule_end_date
                    )}
                  </p>
                )}
                <StudentStatusHeader
                  studentId={student.id}
                  status={student.status}
                  archivedAt={student.archived_at}
                  tags={studentTags}
                />
              </div>
            </div>
            <StreakBadge
              streak={sessionStreak}
              storageKey={`supervisor-session-streak:${student.id}`}
              label={formatCadenceStreakLabel(sessionStreak, student.expected_frequency)}
            />
          </div>

          <div className="mt-4">
            <Link
              href={`${basePath}/progress`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-stone-50 hover:shadow-md"
            >
              <TrendingUp className="h-4 w-4" />
              View progress
            </Link>
          </div>

          <SectionPreferencesProvider
            storageKey="bloomtrack:student-page-sections:supervisor"
            sections={[
              {
                key: "student_info",
                defaultCollapsed: false,
                node: (
                  <StudentInfoView
                    studentClass={student.class}
                    dateOfBirth={student.date_of_birth}
                    motherEmail={student.mother_email}
                    fatherEmail={student.father_email}
                    homeroomTeacher={student.homeroom_teacher}
                    customFields={
                      (student.custom_fields ?? []) as unknown as TeacherStudentCustomField[]
                    }
                  />
                ),
              },
              {
                key: "goals",
                defaultCollapsed: false,
                node: (
                  <GoalsView
                    goals={goals}
                    error={goalsResult.error?.message ?? null}
                    materialsByGoalId={materialsByGoalId}
                  />
                ),
              },
              {
                key: "home_practice",
                defaultCollapsed: true,
                node: (
                  <HomePracticeView
                    items={(homePracticeResult.data ?? []) as unknown as HomePracticeItem[]}
                    error={homePracticeResult.error?.message ?? null}
                  />
                ),
              },
              {
                key: "practice_log",
                defaultCollapsed: true,
                node: (
                  <PracticeLogView
                    logs={(practiceLogsResult.data ?? []) as unknown as PracticeLogWithPraise[]}
                    error={practiceLogsResult.error?.message ?? null}
                  />
                ),
              },
              {
                key: "behavior",
                defaultCollapsed: true,
                node: (
                  <BehaviorView
                    logs={(behaviorLogsResult.data ?? []) as unknown as SupervisorBehaviorLogDisplay[]}
                    error={behaviorLogsResult.error?.message ?? null}
                    behaviorTypes={behaviorTypesResult.data ?? []}
                  />
                ),
              },
              {
                key: "package",
                defaultCollapsed: false,
                node: (
                  <PackageSection
                    readOnly
                    studentId={student.id}
                    packages={(packagesResult.data ?? []) as unknown as StudentPackage[]}
                    items={buildPackageItems(
                      sessions,
                      attendance,
                      (manualEntriesResult.data ?? []) as unknown as PackageManualEntry[]
                    )}
                  />
                ),
              },
              {
                key: "attendance",
                defaultCollapsed: true,
                node: <AttendanceView records={attendance} error={attendanceResult.error?.message ?? null} />,
              },
              {
                key: "sessions",
                defaultCollapsed: true,
                node: <SessionsView sessions={sessions} error={sessionsResult.error?.message ?? null} />,
              },
            ]}
          />
        </div>
      </main>
    );
  }

  // SLP branch
  const { data: student } = await supabase
    .from("students")
    .select(
      "id, slp_id, name, class, expected_frequency, avatar, scheduled_days, schedule_end_date, date_of_birth, mother_email, father_email, homeroom_teacher, status, archived_at, custom_fields:student_custom_fields(id, student_id, label, value, created_at)"
    )
    .eq("id", studentId)
    .maybeSingle();

  if (!student || student.slp_id !== id) {
    notFound();
  }

  const [
    goalsResult,
    sessionsResult,
    homePracticeResult,
    practiceLogsResult,
    assessmentResultsResult,
    behaviorLogsResult,
    behaviorTypesResult,
    attendanceResult,
    holidaysResult,
    packagesResult,
    manualEntriesResult,
    tagLinksResult,
  ] = await Promise.all([
    supabase
      .from("goals")
      .select(
        "id, student_id, area_id, text, response_format_id, target_percent, status, visible_to_parent, source_bank_goal_id, created_at, area:areas(id, name)"
      )
      .eq("student_id", studentId)
      .order("created_at", { ascending: false }),
    supabase
      .from("sessions")
      .select("id, student_id, date, note, created_at")
      .eq("student_id", studentId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("home_practice_items")
      .select("id, what_to_practice, how_to_practice, last_worked_date, created_at")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false }),
    supabase
      .from("practice_logs")
      .select(
        "id, date, activities, how_it_went, note, created_at, praise(id, message, created_at)"
      )
      .eq("student_id", studentId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("assessment_results")
      .select(
        "id, student_id, assessment_id, date, status, created_at, completed_at, assessment:assessments(id, name)"
      )
      .eq("student_id", studentId)
      .order("created_at", { ascending: false }),
    supabase
      .from("slp_behavior_logs")
      .select(
        "id, date, severity, note, created_at, behavior_type:behavior_types(id, name, color)"
      )
      .eq("student_id", studentId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    // Explicit slp_id filter, not just RLS: 0023's is_supervisor_of()
    // policy makes every one of a supervisor's *linked members'*
    // behavior_types visible, not just this one -- the same "a
    // permissive multi-row-visible SELECT policy needs every existing
    // unfiltered query on that table to add an explicit owner filter"
    // issue 0025_community_sharing_browse.sql's fix pattern addresses
    // elsewhere, just from a different policy. Without this, a
    // supervisor linked to more than one SLP would see every linked
    // member's color palette combined here, not just this student's own
    // SLP's.
    supabase
      .from("behavior_types")
      .select("id, name, color")
      .eq("slp_id", id)
      .order("name", { ascending: true }),
    supabase
      .from("attendance_records")
      .select("id, student_id, date, reason, reason_note, counts_toward_package, created_at")
      .eq("student_id", studentId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    // Not student-specific, and unlike attendance_records above there's
    // no student_id to scope by -- an explicit slp_id filter (not just
    // RLS's is_supervisor_of() check) keeps this to *this* linked
    // member's holidays specifically, in case the supervisor is linked
    // to more than one member.
    supabase.from("holidays").select("start_date, end_date").eq("slp_id", id),
    supabase
      .from("student_packages")
      .select("id, student_id, total_sessions, start_date, ended_at, created_at")
      .eq("slp_id", id)
      .eq("student_id", studentId),
    supabase
      .from("package_manual_entries")
      .select("id, student_id, date, note, created_at")
      .eq("slp_id", id)
      .eq("student_id", studentId),
    supabase
      .from("student_tag_links")
      .select("tag:student_tags(id, name, color)")
      .eq("student_id", studentId),
  ]);
  const studentTags = (
    (tagLinksResult.data ?? []) as unknown as { tag: StudentTag | null }[]
  )
    .map((l) => l.tag)
    .filter((t): t is StudentTag => Boolean(t))
    .sort((a, b) => a.name.localeCompare(b.name));

  const rawGoals = (goalsResult.data ?? []) as unknown as GoalWithRelations[];
  const goalsForMaterials = (goalsResult.data ?? []) as unknown as {
    id: string;
    source_bank_goal_id: string | null;
  }[];
  const goalIds = goalsForMaterials.map((g) => g.id);
  const bankGoalIds = Array.from(
    new Set(
      goalsForMaterials
        .map((g) => g.source_bank_goal_id)
        .filter((bankId): bankId is string => Boolean(bankId))
    )
  );
  const materialLookupGoalIds = Array.from(new Set([...goalIds, ...bankGoalIds]));
  const materialLinksResult =
    materialLookupGoalIds.length > 0
      ? await supabase
          .from("material_goals")
          .select("goal_id, material:materials(id, title, url)")
          .in("goal_id", materialLookupGoalIds)
      : { data: [] as RawGoalMaterialLink[] };
  const materialsByGoalId = resolveMaterialChipsByGoal(
    goalsForMaterials,
    (materialLinksResult.data ?? []) as unknown as RawGoalMaterialLink[]
  );

  const goals: SupervisorGoalDisplay[] = rawGoals.map((g) => ({
    id: g.id,
    category: g.area,
    text: g.text,
    target_percent: g.target_percent,
    status: g.status,
    visible_to_parent: g.visible_to_parent,
  }));

  // Same two follow-up queries the SLP's own student page runs, to show
  // per-assessment progress/score.
  const rawResults = (assessmentResultsResult.data ?? []) as unknown as Array<{
    id: string;
    assessment_id: string;
    date: string;
    status: "in_progress" | "completed";
    completed_at: string | null;
    assessment: { id: string; name: string } | null;
  }>;
  const resultIds = rawResults.map((r) => r.id);
  const assessmentIdsInUse = Array.from(new Set(rawResults.map((r) => r.assessment_id)));

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
      : [
          { data: [] as { assessment_id: string }[] },
          {
            data: [] as {
              result_id: string;
              question_id: string;
              response_type: AssessmentQuestionResponseType;
              value: AssessmentAnswerValue;
            }[],
          },
        ];

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

  const assessmentResultDisplays: AssessmentResultDisplay[] = rawResults.map((r) => {
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
  });

  const sessions = (sessionsResult.data ?? []) as SessionRecord[];
  const attendance = (attendanceResult.data ?? []) as AttendanceRecord[];
  const sessionStreak = computeCadenceStreak(
    sessions.map((s) => s.date),
    student.expected_frequency,
    getTodayLocalDateString(),
    [
      ...attendance.map((a) => a.date),
      ...(holidaysResult.data ?? []).flatMap((h) =>
        eachDateInRange(h.start_date, h.end_date)
      ),
    ]
  );

  return (
    <main className="flex-1 bg-cream-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <SupervisorViewingBanner memberName={link.member_name} />

        <Link
          href={`/supervisor/members/${id}`}
          className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-brand-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to students
        </Link>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AvatarBadge avatar={student.avatar} size="lg" />
            <div>
              <h1 className="text-2xl font-bold text-stone-900">{student.name}</h1>
              <p className="text-stone-600">{student.class || "No class"}</p>
              {student.scheduled_days.length > 0 && (
                <p className="mt-0.5 text-xs text-stone-400">
                  Scheduled:{" "}
                  {formatSchedule(
                    student.scheduled_days,
                    student.schedule_end_date
                  )}
                </p>
              )}
              <StudentStatusHeader
                studentId={student.id}
                status={student.status}
                archivedAt={student.archived_at}
                tags={studentTags}
              />
            </div>
          </div>
          <StreakBadge
            streak={sessionStreak}
            storageKey={`supervisor-session-streak:${student.id}`}
            label={formatCadenceStreakLabel(sessionStreak, student.expected_frequency)}
          />
        </div>

        <div className="mt-4">
          <Link
            href={`${basePath}/progress`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-stone-50 hover:shadow-md"
          >
            <TrendingUp className="h-4 w-4" />
            View progress
          </Link>
        </div>

        <SectionPreferencesProvider
          storageKey="bloomtrack:student-page-sections:supervisor"
          sections={[
            {
              key: "student_info",
              defaultCollapsed: false,
              node: (
                <StudentInfoView
                  studentClass={student.class}
                  dateOfBirth={student.date_of_birth}
                  motherEmail={student.mother_email}
                  fatherEmail={student.father_email}
                  homeroomTeacher={student.homeroom_teacher}
                  customFields={(student.custom_fields ?? []) as unknown as StudentCustomField[]}
                />
              ),
            },
            {
              key: "goals",
              defaultCollapsed: false,
              node: (
                <GoalsView
                  goals={goals}
                  error={goalsResult.error?.message ?? null}
                  materialsByGoalId={materialsByGoalId}
                />
              ),
            },
            {
              key: "assessments",
              defaultCollapsed: true,
              node: (
                <AssessmentsView
                  basePath={`${basePath}/assessment`}
                  results={assessmentResultDisplays}
                  error={assessmentResultsResult.error?.message ?? null}
                />
              ),
            },
            {
              key: "home_practice",
              defaultCollapsed: true,
              node: (
                <HomePracticeView
                  items={(homePracticeResult.data ?? []) as unknown as HomePracticeItem[]}
                  error={homePracticeResult.error?.message ?? null}
                />
              ),
            },
            {
              key: "practice_log",
              defaultCollapsed: true,
              node: (
                <PracticeLogView
                  logs={(practiceLogsResult.data ?? []) as unknown as PracticeLogWithPraise[]}
                  error={practiceLogsResult.error?.message ?? null}
                />
              ),
            },
            {
              key: "behavior",
              defaultCollapsed: true,
              node: (
                <BehaviorView
                  logs={(behaviorLogsResult.data ?? []) as unknown as SupervisorBehaviorLogDisplay[]}
                  error={behaviorLogsResult.error?.message ?? null}
                  behaviorTypes={behaviorTypesResult.data ?? []}
                />
              ),
            },
            {
              key: "package",
              defaultCollapsed: false,
              node: (
                <PackageSection
                  readOnly
                  studentId={student.id}
                  packages={(packagesResult.data ?? []) as unknown as StudentPackage[]}
                  items={buildPackageItems(
                    sessions,
                    attendance,
                    (manualEntriesResult.data ?? []) as unknown as PackageManualEntry[]
                  )}
                />
              ),
            },
            {
              key: "attendance",
              defaultCollapsed: true,
              node: <AttendanceView records={attendance} error={attendanceResult.error?.message ?? null} />,
            },
            {
              key: "sessions",
              defaultCollapsed: true,
              node: <SessionsView sessions={sessions} error={sessionsResult.error?.message ?? null} />,
            },
          ]}
        />
      </div>
    </main>
  );
}
