import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  ClipboardList,
  Library,
  Settings,
  Sliders,
  Smile,
  Target,
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
import { buildSlpDashboardSteps } from "@/lib/onboarding-tour";
import CaseloadWinsCard from "@/components/caseload-wins-card";
import StreakRiskNudges from "@/components/streak-risk-nudges";
import CountdownsWidget from "@/components/countdowns-widget";
import DashboardTour from "@/components/dashboard-tour";
import LinkSupervisorButton from "@/components/link-supervisor-button";
import SignOutButton from "./sign-out-button";
import StudentsSection from "./students-section";
import NamePromptModal from "./name-prompt-modal";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already guards this route, but a Server Component should
  // never trust that alone — check again before rendering anything.
  if (!user) {
    redirect("/login");
  }

  // This dashboard is SLP-only — a Teacher account (even one that landed
  // here by mistake, e.g. an old bookmark) belongs on its own dashboard.
  if (getUserRole(user) === "teacher") {
    redirect("/teacher/dashboard");
  }

  const { data: students, error } = await supabase
    .from("students")
    .select(
      "id, name, class, expected_frequency, avatar, scheduled_days, schedule_end_date, created_at"
    )
    .order("created_at", { ascending: false });

  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : "";
  const displayName = fullName || user.email;

  // Caseload wins + at-risk nudges — all derived from the same four
  // lightweight queries. sessions/attendance_records/holidays still
  // don't need an explicit slp_id filter (RLS on all three is
  // owner-only, untouched by 0025_community_sharing_browse.sql), but
  // the goals count does need one now: that migration added a second
  // permissive SELECT policy allowing *any* account's visibility='shared'
  // rows, so without this filter another SLP's shared bank goal could in
  // principle count toward her "recent wins" here. attendance_records
  // and holidays both feed the same streak math as sessions — an
  // excused absence or a marked holiday protects a streak without
  // counting as a session (see computeCadenceStreak in
  // src/lib/streaks.ts, and addSharedDatesToEveryStudent below for how
  // holidays — one shared date list, not per-student like attendance —
  // get folded in for every student alike).
  const today = getTodayLocalDateString();
  const [sessionsResult, attendanceResult, holidaysResult, countdownsResult, masteredCountResult] =
    await Promise.all([
      supabase.from("sessions").select("student_id, date"),
      supabase.from("attendance_records").select("student_id, date"),
      supabase
        .from("holidays")
        .select("id, title, start_date, end_date, created_at"),
      supabase
        .from("countdowns")
        .select("id, title, target_date, created_at")
        .order("target_date", { ascending: true }),
      supabase
        .from("goals")
        .select("id", { count: "exact", head: true })
        .eq("slp_id", user.id)
        .eq("status", "mastered")
        .gte("mastered_at", daysAgoLocalDateString(30)),
    ]);

  const sessionDatesByStudentId = groupDatesByStudent(
    sessionsResult.data ?? []
  );
  const absentDatesByStudentId = addSharedDatesToEveryStudent(
    groupDatesByStudent(attendanceResult.data ?? []),
    (students ?? []).map((s) => s.id),
    (holidaysResult.data ?? []).flatMap((h) =>
      eachDateInRange(h.start_date, h.end_date)
    )
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
              href="/schedule"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <CalendarDays className="h-4 w-4" />
              Schedule
            </Link>
            <Link
              href="/toolkit/assessments"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <ClipboardList className="h-4 w-4" />
              Assessments
            </Link>
            <Link
              href="/toolkit/goals"
              data-tour="toolkit-nav"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Target className="h-4 w-4" />
              Goal bank
            </Link>
            <Link
              href="/toolkit/formats"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Sliders className="h-4 w-4" />
              Response formats
            </Link>
            <Link
              href="/toolkit/behavior-types"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Smile className="h-4 w-4" />
              Behavior types
            </Link>
            <Link
              href="/toolkit/materials"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Library className="h-4 w-4" />
              Materials
            </Link>
            <DashboardTour
              role="slp"
              steps={buildSlpDashboardSteps((students ?? []).length > 0)}
              autoStart={user.user_metadata?.has_seen_tour !== true}
              continueHref={students?.[0] ? `/students/${students[0].id}` : null}
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
            basePath="/students"
          />
          <CountdownsWidget
            countdowns={countdownsResult.data ?? []}
            today={today}
            manageHref="/schedule"
          />
        </div>

        <div className="mt-8">
          <StudentsSection
            userId={user.id}
            initialStudents={students ?? []}
            initialError={error?.message ?? null}
          />
        </div>
      </div>

      {!fullName && <NamePromptModal userId={user.id} />}
    </main>
  );
}
