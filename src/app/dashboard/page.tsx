import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList, Library, Sliders, Smile, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/role";
import { daysAgoLocalDateString, getTodayLocalDateString } from "@/lib/date";
import { weekStartOf } from "@/lib/streaks";
import {
  computeCaseloadStreaks,
  findAtRiskStreaks,
  groupDatesByStudent,
} from "@/lib/caseload";
import { buildSlpDashboardSteps } from "@/lib/onboarding-tour";
import CaseloadWinsCard from "@/components/caseload-wins-card";
import StreakRiskNudges from "@/components/streak-risk-nudges";
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
      "id, name, class, expected_frequency, avatar, scheduled_days, created_at"
    )
    .order("created_at", { ascending: false });

  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : "";
  const displayName = fullName || user.email;

  // Caseload wins + at-risk nudges — all derived from the same three
  // lightweight queries (RLS already scopes each to her own students, so
  // none needs an explicit slp_id filter). attendance_records feeds the
  // same streak math as sessions — an excused absence protects a streak
  // without counting as a session (see computeCadenceStreak in
  // src/lib/streaks.ts).
  const today = getTodayLocalDateString();
  const [sessionsResult, attendanceResult, masteredCountResult] =
    await Promise.all([
      supabase.from("sessions").select("student_id, date"),
      supabase.from("attendance_records").select("student_id, date"),
      supabase
        .from("goals")
        .select("id", { count: "exact", head: true })
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
