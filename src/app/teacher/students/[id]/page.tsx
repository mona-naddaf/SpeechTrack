import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/role";
import { getTodayLocalDateString } from "@/lib/date";
import type {
  AttendanceRecord,
  BehaviorLogWithType,
  HomePracticeItem,
  PracticeLogWithPraise,
  TeacherGoalWithRelations,
  TeacherStudentCustomField,
} from "@/lib/types";
import {
  resolveMaterialChipsByGoal,
  type RawGoalMaterialLink,
} from "@/lib/materials";
import { computeCadenceStreak, formatCadenceStreakLabel } from "@/lib/streaks";
import { formatScheduledDays } from "@/lib/schedule";
import { TEACHER_STUDENT_TOUR_STEPS } from "@/lib/onboarding-tour";
import StreakBadge from "@/components/streak-badge";
import AvatarBadge from "@/components/avatar-badge";
import AttendanceSection from "@/components/attendance-section";
import SessionsSection from "@/components/sessions-section";
import SectionPreferencesProvider from "@/components/section-preferences";
import StudentTour from "@/components/student-tour";
import StudentInfoSection from "./student-info-section";
import GoalsSection from "./goals-section";
import BehaviorSection from "./behavior-section";
import HomePracticeSection from "./home-practice-section";
import PracticeLogSection from "./practice-log-section";
import ExportButtons from "./export-buttons";

export default async function TeacherStudentDetailPage({
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

  if (getUserRole(user) !== "teacher") {
    redirect("/dashboard");
  }

  // RLS scopes this to students owned by the signed-in Teacher, so a
  // student that exists but belongs to someone else comes back as no row,
  // not an error.
  const { data: student } = await supabase
    .from("teacher_students")
    .select(
      "id, name, class, parent_access_code, share_behavior_with_parent, expected_frequency, avatar, scheduled_days, created_at, date_of_birth, mother_email, father_email, homeroom_teacher, custom_fields:teacher_student_custom_fields(id, student_id, label, value, created_at)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!student) {
    notFound();
  }

  const [
    goalsResult,
    subjectsResult,
    formatsResult,
    bankGoalsResult,
    behaviorLogsResult,
    behaviorTypesResult,
    sessionsResult,
    homePracticeResult,
    practiceLogsResult,
    attendanceResult,
  ] = await Promise.all([
    supabase
      .from("teacher_goals")
      .select(
        "id, student_id, subject_id, text, response_format_id, baseline, target_percent, status, source_bank_goal_id, created_at, subject:teacher_subjects(id, name), response_format:teacher_response_formats(id, name)"
      )
      .eq("student_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("teacher_subjects")
      .select("id, name")
      .order("name", { ascending: true }),
    supabase
      .from("teacher_response_formats")
      .select("id, name")
      .order("created_at", { ascending: true }),
    supabase
      .from("teacher_goals")
      .select("id, subject_id, text, response_format_id, target_percent")
      .is("student_id", null)
      .order("text", { ascending: true }),
    supabase
      .from("behavior_logs")
      .select(
        "id, student_id, date, behavior_type_id, severity, note, created_at, behavior_type:teacher_behavior_types(id, name, color)"
      )
      .eq("student_id", id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("teacher_behavior_types")
      .select("id, name, color")
      .order("name", { ascending: true }),
    supabase
      .from("teacher_sessions")
      .select("id, student_id, date, note, created_at")
      .eq("student_id", id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("teacher_home_practice_items")
      .select(
        "id, what_to_practice, how_to_practice, last_worked_date, created_at"
      )
      .eq("student_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("teacher_practice_logs")
      .select(
        "id, date, activities, how_it_went, note, created_at, praise:teacher_praise(id, message, created_at)"
      )
      .eq("student_id", id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
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
          .from("teacher_material_goals")
          .select("goal_id, material:teacher_materials(id, title, url)")
          .in("goal_id", materialLookupGoalIds)
      : { data: [] as RawGoalMaterialLink[] };
  const materialsByGoalId = resolveMaterialChipsByGoal(
    studentGoals,
    (materialLinksResult.data ?? []) as unknown as RawGoalMaterialLink[]
  );

  const sessionStreak = computeCadenceStreak(
    (sessionsResult.data ?? []).map((s) => s.date),
    student.expected_frequency,
    getTodayLocalDateString(),
    (attendanceResult.data ?? []).map((a) => a.date)
  );

  return (
    <main className="flex-1 bg-cream-50 px-4 py-8 sm:px-6 sm:py-10">
      <StudentTour role="teacher" steps={TEACHER_STUDENT_TOUR_STEPS} />
      <div className="mx-auto max-w-3xl">
        <Link
          href="/teacher/dashboard"
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
            storageKey={`teacher-session-streak:${student.id}`}
            label={formatCadenceStreakLabel(
              sessionStreak,
              student.expected_frequency
            )}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href={`/teacher/students/${student.id}/progress`}
            data-tour="student-view-progress"
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-stone-50 hover:shadow-md"
          >
            <TrendingUp className="h-4 w-4" />
            View progress
          </Link>
          <ExportButtons studentId={student.id} studentName={student.name} />
        </div>

        <SectionPreferencesProvider
          storageKey="bloomtrack:student-page-sections:teacher"
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
                      []) as unknown as TeacherStudentCustomField[]
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
                    (goalsResult.data ??
                      []) as unknown as TeacherGoalWithRelations[]
                  }
                  initialGoalsError={goalsResult.error?.message ?? null}
                  subjects={subjectsResult.data ?? []}
                  responseFormats={formatsResult.data ?? []}
                  bankGoals={bankGoalsResult.data ?? []}
                  materialsByGoalId={materialsByGoalId}
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
                      []) as unknown as BehaviorLogWithType[]
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
                  ownerField="teacher_id"
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
                  newSessionHref={`/teacher/students/${student.id}/session/new`}
                />
              ),
            },
          ]}
        />
      </div>
    </main>
  );
}
