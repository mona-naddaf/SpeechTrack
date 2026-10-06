import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  Gamepad2,
  Library,
  ListChecks,
  ListTree,
  Settings,
  Sliders,
  Smile,
  Tags,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/role";
import {
  daysAgoLocalDateString,
  eachDateInRange,
  getTodayLocalDateString,
} from "@/lib/date";
import { weekStartOf } from "@/lib/streaks";
import {
  addSharedDatesToEveryStudent,
  computeCaseloadStreaks,
  findAtRiskStreaks,
  groupDatesByStudent,
} from "@/lib/caseload";
import { buildTeacherDashboardSteps } from "@/lib/onboarding-tour";
import CaseloadWinsCard from "@/components/caseload-wins-card";
import StudentsListSection from "@/components/students-list-section";
import { isStillBeingSeen } from "@/lib/student-list";
import type { Student, StudentTag } from "@/lib/types";
import StreakRiskNudges from "@/components/streak-risk-nudges";
import CountdownsWidget from "@/components/countdowns-widget";
import DashboardTour from "@/components/dashboard-tour";
import LinkSupervisorButton from "@/components/link-supervisor-button";
import SignOutButton from "./sign-out-button";

export default async function TeacherDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already guards this route, but a Server Component should
  // never trust that alone — check again before rendering anything.
  if (!user) {
    redirect("/login");
  }

  // This dashboard is Teacher-only — an SLP account (or an older account
  // with no role set yet, which defaults to "slp") belongs on /dashboard.
  if (getUserRole(user) !== "teacher") {
    redirect("/dashboard");
  }

  const { data: students, error } = await supabase
    .from("teacher_students")
    .select(
      "id, name, class, expected_frequency, avatar, scheduled_days, schedule_end_date, created_at, status, archived_at, started_on"
    )
    .order("created_at", { ascending: false });

  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : "";
  const displayName = fullName || user.email;

  // Caseload wins + at-risk nudges — all derived from the same four
  // lightweight queries. teacher_sessions/attendance_records/holidays
  // still don't need an explicit teacher_id filter (RLS on all three is
  // owner-only, untouched by 0025_community_sharing_browse.sql), but the
  // goals count does need one now: that migration added a second
  // permissive SELECT policy allowing *any* account's visibility='shared'
  // rows, so without this filter another Teacher's shared bank goal
  // could in principle count toward her "recent wins" here.
  // attendance_records and holidays both feed the same streak math as
  // sessions — an excused absence or a marked holiday protects a streak
  // without counting as a session (see computeCadenceStreak in
  // src/lib/streaks.ts, and addSharedDatesToEveryStudent below for how
  // holidays — one shared date list, not per-student like attendance —
  // get folded in for every student alike).
  const today = getTodayLocalDateString();
  const [
    sessionsResult,
    attendanceResult,
    holidaysResult,
    countdownsResult,
    masteredGoalsResult,
    tagsResult,
    tagLinksResult,
  ] = await Promise.all([
      supabase.from("teacher_sessions").select("student_id, date"),
      supabase.from("attendance_records").select("student_id, date"),
      supabase
        .from("holidays")
        .select("id, title, start_date, end_date, created_at"),
      supabase
        .from("countdowns")
        .select("id, title, target_date, created_at")
        .order("target_date", { ascending: true }),
      supabase
        .from("teacher_goals")
        .select("student_id")
        .eq("teacher_id", user.id)
        .eq("status", "mastered")
        .gte("mastered_at", daysAgoLocalDateString(30)),
      // Explicit owner filter on her own tags, same defensive habit as
      // the goals query above. Links are reached through her students.
      supabase
        .from("teacher_student_tags")
        .select("id, name, color")
        .eq("teacher_id", user.id)
        .order("name", { ascending: true }),
      supabase.from("teacher_student_tag_links").select("student_id, tag_id"),
    ]);

  // Stopped and Archived students are no longer being seen, so they drop
  // out of caseload wins and streak nudges; Trial students stay.
  const seenStudents = (students ?? []).filter(isStillBeingSeen);
  const seenStudentIds = new Set(seenStudents.map((s) => s.id));
  const seenSessions = (sessionsResult.data ?? []).filter((s) =>
    seenStudentIds.has(s.student_id)
  );
  const masteredCount = (masteredGoalsResult.data ?? []).filter((g) =>
    seenStudentIds.has(g.student_id)
  ).length;
  const sessionCountByStudentId: Record<string, number> = {};
  for (const s of sessionsResult.data ?? []) {
    sessionCountByStudentId[s.student_id] =
      (sessionCountByStudentId[s.student_id] ?? 0) + 1;
  }

  const sessionDatesByStudentId = groupDatesByStudent(seenSessions);
  const absentDatesByStudentId = addSharedDatesToEveryStudent(
    groupDatesByStudent(attendanceResult.data ?? []),
    seenStudents.map((s) => s.id),
    (holidaysResult.data ?? []).flatMap((h) =>
      eachDateInRange(h.start_date, h.end_date)
    )
  );
  const caseloadStreaks = computeCaseloadStreaks(
    seenStudents,
    sessionDatesByStudentId,
    today,
    absentDatesByStudentId
  );
  const sessionsThisWeek = seenSessions.filter(
    (s) => weekStartOf(s.date) === weekStartOf(today)
  ).length;
  const atRiskStudents = findAtRiskStreaks(
    seenStudents,
    sessionDatesByStudentId,
    today,
    absentDatesByStudentId
  );

  return (
    <main className="flex-1 bg-cream-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-stone-900 sm:text-2xl">
            Welcome, {displayName} <span aria-hidden>👋</span>
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/teacher/schedule"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <CalendarDays className="h-4 w-4" />
              Schedule
            </Link>
            <Link
              href="/teacher/toolkit/goals"
              data-tour="toolkit-nav"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <ListChecks className="h-4 w-4" />
              Goal bank
            </Link>
            <Link
              href="/teacher/toolkit/subjects"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Sliders className="h-4 w-4" />
              Subjects &amp; formats
            </Link>
            <Link
              href="/teacher/toolkit/behavior-types"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Smile className="h-4 w-4" />
              Behavior types
            </Link>
            <Link
              href="/teacher/toolkit/student-tags"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Tags className="h-4 w-4" />
              Student tags
            </Link>
            <Link
              href="/teacher/toolkit/materials"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Library className="h-4 w-4" />
              Materials
            </Link>
            <Link
              href="/teacher/toolkit/track-templates"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <ListTree className="h-4 w-4" />
              Track templates
            </Link>
            <Link
              href="/teacher/toolkit/reinforcement-boards"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Gamepad2 className="h-4 w-4" />
              Reinforcement bank
            </Link>
            <DashboardTour
              role="teacher"
              steps={buildTeacherDashboardSteps((students ?? []).length > 0)}
              autoStart={user.user_metadata?.has_seen_tour !== true}
              continueHref={
                students?.[0] ? `/teacher/students/${students[0].id}` : null
              }
            />
            <Link
              href="/settings"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
            <LinkSupervisorButton />
            <SignOutButton />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <CaseloadWinsCard
            masteredCount={masteredCount}
            longestStreak={caseloadStreaks[0] ?? null}
            sessionsThisWeek={sessionsThisWeek}
          />
          <StreakRiskNudges
            atRiskStudents={atRiskStudents}
            basePath="/teacher/students"
          />
          <CountdownsWidget
            countdowns={countdownsResult.data ?? []}
            today={today}
            manageHref="/teacher/schedule"
          />
        </div>

        <div className="mt-5">
          <StudentsListSection
            ownerId={user.id}
            ownerField="teacher_id"
            studentsTable="teacher_students"
            tagLinksTable="teacher_student_tag_links"
            studentBasePath="/teacher/students"
            prefsStorageKey="bloomtrack:student-list:teacher"
            initialStudents={(students ?? []) as unknown as Student[]}
            initialError={error?.message ?? null}
            tags={(tagsResult.data ?? []) as StudentTag[]}
            tagLinks={tagLinksResult.data ?? []}
            sessionCountByStudentId={sessionCountByStudentId}
          />
        </div>
      </div>
    </main>
  );
}
