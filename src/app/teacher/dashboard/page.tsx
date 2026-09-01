import Link from "next/link";
import { redirect } from "next/navigation";
import { Library, ListChecks, Settings, Sliders, Smile } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/role";
import { daysAgoLocalDateString, getTodayLocalDateString } from "@/lib/date";
import { weekStartOf } from "@/lib/streaks";
import {
  computeCaseloadStreaks,
  findAtRiskStreaks,
  groupDatesByStudent,
} from "@/lib/caseload";
import { buildTeacherDashboardSteps } from "@/lib/onboarding-tour";
import CaseloadWinsCard from "@/components/caseload-wins-card";
import StreakRiskNudges from "@/components/streak-risk-nudges";
import DashboardTour from "@/components/dashboard-tour";
import LinkSupervisorButton from "@/components/link-supervisor-button";
import SignOutButton from "./sign-out-button";
import StudentsSection from "./students-section";

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
      "id, name, class, expected_frequency, avatar, scheduled_days, created_at"
    )
    .order("created_at", { ascending: false });

  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : "";
  const displayName = fullName || user.email;

  // Caseload wins + at-risk nudges — all derived from the same three
  // lightweight queries. teacher_sessions/attendance_records still don't
  // need an explicit teacher_id filter (RLS on those two tables is still
  // owner-only, untouched by 0025_community_sharing_browse.sql), but the
  // goals count does need one now: that migration added a second
  // permissive SELECT policy allowing *any* account's visibility='shared'
  // rows, so without this filter another Teacher's shared bank goal
  // could in principle count toward her "recent wins" here.
  // attendance_records feeds the same streak math as sessions — an
  // excused absence protects a streak without counting as a session (see
  // computeCadenceStreak in src/lib/streaks.ts).
  const today = getTodayLocalDateString();
  const [sessionsResult, attendanceResult, masteredCountResult] =
    await Promise.all([
      supabase.from("teacher_sessions").select("student_id, date"),
      supabase.from("attendance_records").select("student_id, date"),
      supabase
        .from("teacher_goals")
        .select("id", { count: "exact", head: true })
        .eq("teacher_id", user.id)
        .eq("status", "mastered")
        .gte("mastered_at", daysAgoLocalDateString(30)),
    ]);

  const sessionDatesByStudentId = groupDatesByStudent(
    sessionsResult.data ?? []
  );
  const absentDatesByStudentId = groupDatesByStudent(
    attendanceResult.data ?? []
  );
  const caseloadStreaks = computeCaseloadStreaks(
    students ?? [],
    sessionDatesByStudentId,
    today,
    absentDatesByStudentId
  );
  const sessionsThisWeek = (sessionsResult.data ?? []).filter(
    (s) => weekStartOf(s.date) === weekStartOf(today)
  ).length;
  const atRiskStudents = findAtRiskStreaks(
    students ?? [],
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
              href="/teacher/toolkit/materials"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Library className="h-4 w-4" />
              Materials
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

        <div className="mt-6 space-y-3">
          <CaseloadWinsCard
            masteredCount={masteredCountResult.count ?? 0}
            longestStreak={caseloadStreaks[0] ?? null}
            sessionsThisWeek={sessionsThisWeek}
          />
          <StreakRiskNudges
            atRiskStudents={atRiskStudents}
            basePath="/teacher/students"
          />
        </div>

        <div className="mt-8">
          <StudentsSection
            teacherId={user.id}
            initialStudents={students ?? []}
            initialError={error?.message ?? null}
          />
        </div>
      </div>
    </main>
  );
}
