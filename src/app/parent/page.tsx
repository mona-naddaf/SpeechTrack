import { cookies } from "next/headers";
import { HeartHandshake } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/service";
import { PARENT_COOKIE_NAME, verifyParentSessionToken } from "@/lib/parent-session";
import { daysAgoLocalDateString } from "@/lib/date";
import { buildGoalReport, type ProgressGoal, type ProgressTrial } from "@/lib/progress";
import type { HomePracticeItem, PracticeLogWithPraise } from "@/lib/types";
import type { BehaviorBreakdownEntry } from "./behavior-section";
import ParentLoginForm from "./parent-login-form";
import ParentDashboard from "./parent-dashboard";

type RawTrial = {
  id: string;
  goal_id: string;
  value: Record<string, unknown>;
  created_at: string;
  session: { id: string; date: string; student_id: string } | null;
};

type RawBehaviorLog = {
  id: string;
  behavior_type: { id: string; name: string; color: string } | null;
};

function LoginScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-cream-50 via-cream-50 to-brand-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 shadow-sm">
            <HeartHandshake className="h-7 w-7 text-brand-600" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-stone-900">
            BloomTrack
          </h1>
          <p className="mt-1 text-stone-600">Home practice, made easy</p>
        </div>
        <div className="mt-6">
          <ParentLoginForm />
        </div>
      </div>
    </main>
  );
}

// Turns a raw count-by-behavior-type into the sorted, percent-scaled
// shape BehaviorSection renders — same "bar width relative to the
// largest count" logic as the SLP/Teacher-side behavior breakdown.
function buildBehaviorBreakdown(logs: RawBehaviorLog[]): BehaviorBreakdownEntry[] {
  const counts = new Map<string, { name: string; color: string; count: number }>();
  for (const log of logs) {
    if (!log.behavior_type) continue;
    const existing = counts.get(log.behavior_type.id);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(log.behavior_type.id, {
        name: log.behavior_type.name,
        color: log.behavior_type.color,
        count: 1,
      });
    }
  }

  const maxCount = Math.max(1, ...Array.from(counts.values()).map((c) => c.count));
  return Array.from(counts.entries())
    .map(([id, c]) => ({
      id,
      name: c.name,
      color: c.color,
      count: c.count,
      percent: Math.round((c.count / maxCount) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}

export default async function ParentPage() {
  const cookieStore = await cookies();
  const session = verifyParentSessionToken(
    cookieStore.get(PARENT_COOKIE_NAME)?.value
  );

  if (!session) {
    return <LoginScreen />;
  }

  const supabase = createServiceClient();

  // Which set of tables to read from depends on which kind of student this
  // code belongs to (see ParentStudentType) — the UI below is identical
  // either way, only the source tables differ.
  const isTeacherStudent = session.studentType === "teacher";
  const itemsTable = isTeacherStudent
    ? "teacher_home_practice_items"
    : "home_practice_items";
  const logsTable = isTeacherStudent
    ? "teacher_practice_logs"
    : "practice_logs";
  const goalsTable = isTeacherStudent ? "teacher_goals" : "goals";
  const trialsTable = isTeacherStudent ? "teacher_trials" : "trials";
  const sessionsRelation = isTeacherStudent ? "teacher_sessions" : "sessions";
  // teacher_practice_logs' praise rows live in teacher_praise — aliased
  // back to "praise" so both branches produce the same PracticeLogWithPraise shape.
  const praiseEmbed = isTeacherStudent
    ? "praise:teacher_praise(id, message, created_at)"
    : "praise(id, message, created_at)";
  // Same idea: alias each side's own relation names ("subject" for
  // Teacher, "area" for SLP) back to "area", so buildGoalReport() and
  // ProgressSection work unchanged against either shape.
  const areaEmbed = isTeacherStudent
    ? "area:teacher_subjects(id, name)"
    : "area:areas(id, name)";
  const responseFormatEmbed = isTeacherStudent
    ? "response_format:teacher_response_formats(id, name, type, config)"
    : "response_format:response_formats(id, name, type, config)";
  // Both students.share_behavior_with_parent and
  // teacher_students.share_behavior_with_parent exist now (0011, 0012), so
  // this reads the same way either side — only the log/type tables differ.
  const behaviorLogsTable = isTeacherStudent ? "behavior_logs" : "slp_behavior_logs";
  const behaviorTypeEmbed = isTeacherStudent
    ? "behavior_type:teacher_behavior_types(id, name, color)"
    : "behavior_type:behavior_types(id, name, color)";

  // Two separate literal .select() calls rather than one driven by a
  // computed column-list string — postgrest-js statically parses a select()
  // argument's literal type to shape its result, and a runtime-computed
  // string defeats that (surfacing as an opaque GenericStringError result
  // type), so each branch needs its own literal here.
  const { data: student } = isTeacherStudent
    ? await supabase
        .from("teacher_students")
        .select("id, name, share_behavior_with_parent")
        .eq("id", session.studentId)
        .maybeSingle()
    : await supabase
        .from("students")
        .select("id, name, share_behavior_with_parent")
        .eq("id", session.studentId)
        .maybeSingle();

  // Cookie pointed at a student that no longer exists — treat as logged out.
  if (!student) {
    return <LoginScreen />;
  }

  const shareBehaviorWithParent = Boolean(
    (student as { share_behavior_with_parent?: boolean }).share_behavior_with_parent
  );

  const [itemsResult, logsResult, goalsResult, behaviorLogsResult] =
    await Promise.all([
      supabase
        .from(itemsTable)
        .select(
          "id, what_to_practice, how_to_practice, last_worked_date, created_at"
        )
        .eq("student_id", student.id)
        .order("created_at", { ascending: false }),
      supabase
        .from(logsTable)
        .select(`id, date, activities, how_it_went, note, created_at, ${praiseEmbed}`)
        .eq("student_id", student.id)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from(goalsTable)
        .select(`id, text, status, ${areaEmbed}, ${responseFormatEmbed}`)
        .eq("student_id", student.id)
        .eq("visible_to_parent", true)
        .order("created_at", { ascending: false }),
      shareBehaviorWithParent
        ? supabase
            .from(behaviorLogsTable)
            .select(`id, ${behaviorTypeEmbed}`)
            .eq("student_id", student.id)
            .gte("date", daysAgoLocalDateString(30))
        : Promise.resolve({ data: [] as RawBehaviorLog[], error: null }),
    ]);

  // Only shared goals ever reach this point (filtered by visible_to_parent
  // above), so no further filtering is needed before building reports.
  const visibleGoals = (goalsResult.data ?? []) as unknown as ProgressGoal[];
  const visibleGoalIds = visibleGoals.map((g) => g.id);

  const trialsResult =
    visibleGoalIds.length > 0
      ? await supabase
          .from(trialsTable)
          .select(
            `id, goal_id, value, created_at, session:${sessionsRelation}!inner(id, date, student_id)`
          )
          .eq("session.student_id", student.id)
          .in("goal_id", visibleGoalIds)
          .order("created_at", { ascending: true })
      : { data: [] as RawTrial[], error: null };

  const rawTrials = (trialsResult.data ?? []) as unknown as RawTrial[];
  const trials: ProgressTrial[] = rawTrials
    .filter((t) => t.session !== null)
    .map((t) => ({
      id: t.id,
      goal_id: t.goal_id,
      value: t.value,
      session_date: t.session!.date,
    }));

  const progressReports = visibleGoals.map((goal) => buildGoalReport(goal, trials));

  const behaviorBreakdown = buildBehaviorBreakdown(
    (behaviorLogsResult.data ?? []) as unknown as RawBehaviorLog[]
  );

  return (
    <main className="min-h-screen bg-gradient-to-b from-cream-50 via-cream-50 to-brand-50 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <ParentDashboard
          studentName={student.name}
          items={(itemsResult.data ?? []) as unknown as HomePracticeItem[]}
          logs={(logsResult.data ?? []) as unknown as PracticeLogWithPraise[]}
          itemsError={itemsResult.error?.message ?? null}
          logsError={logsResult.error?.message ?? null}
          progressReports={progressReports}
          showBehaviorSection={shareBehaviorWithParent}
          behaviorBreakdown={behaviorBreakdown}
        />
      </div>
    </main>
  );
}
