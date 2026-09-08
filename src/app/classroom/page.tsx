import { cookies } from "next/headers";
import { GraduationCap } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/service";
import {
  CLASSROOM_CONTACT_COOKIE_NAME,
  verifyClassroomContactSessionToken,
} from "@/lib/classroom-contact-session";
import { daysAgoLocalDateString } from "@/lib/date";
import { buildGoalReport, type ProgressGoal, type ProgressTrial } from "@/lib/progress";
import type { ClassroomStrategy, ClassroomStrategyLogWithPraise } from "@/lib/types";
import type { BehaviorBreakdownEntry } from "@/app/parent/behavior-section";
import type { ParentSessionNote } from "@/app/parent/session-notes-section";
import ClassroomLoginForm from "./classroom-login-form";
import ClassroomDashboard from "./classroom-dashboard";

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
    <main className="flex flex-1 items-center justify-center bg-gradient-to-b from-cream-50 via-cream-50 to-brand-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 shadow-sm">
            <GraduationCap className="h-7 w-7 text-brand-600" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-stone-900">
            BloomTrack
          </h1>
          <p className="mt-1 text-stone-600">Teacher view — classroom strategies</p>
        </div>
        <div className="mt-6">
          <ClassroomLoginForm />
        </div>
      </div>
    </main>
  );
}

// Same "sorted, percent-scaled" shape as the parent dashboard's behavior
// breakdown (src/app/parent/page.tsx) — kept as its own copy here rather
// than imported, same as every other server-side query on this page,
// since the *rendering* component (BehaviorSection) is what's shared,
// not the data-fetching.
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

export default async function ClassroomPage() {
  const cookieStore = await cookies();
  const session = verifyClassroomContactSessionToken(
    cookieStore.get(CLASSROOM_CONTACT_COOKIE_NAME)?.value
  );

  if (!session) {
    return <LoginScreen />;
  }

  const supabase = createServiceClient();

  // Which set of tables to read from depends on which kind of student this
  // code belongs to — same isTeacherStudent branching as
  // src/app/parent/page.tsx, completely independent of it (a different
  // cookie, a different table for the code itself).
  const isTeacherStudent = session.studentType === "teacher";
  const itemsTable = isTeacherStudent
    ? "teacher_classroom_strategies"
    : "classroom_strategies";
  const logsTable = isTeacherStudent
    ? "teacher_classroom_strategy_logs"
    : "classroom_strategy_logs";
  const goalsTable = isTeacherStudent ? "teacher_goals" : "goals";
  const trialsTable = isTeacherStudent ? "teacher_trials" : "trials";
  const sessionsRelation = isTeacherStudent ? "teacher_sessions" : "sessions";
  const praiseEmbed = isTeacherStudent
    ? "praise:teacher_classroom_strategy_praise(id, message, created_at)"
    : "praise:classroom_strategy_praise(id, message, created_at)";
  const areaEmbed = isTeacherStudent
    ? "area:teacher_subjects(id, name)"
    : "area:areas(id, name)";
  const responseFormatEmbed = isTeacherStudent
    ? "response_format:teacher_response_formats(id, name, type, config)"
    : "response_format:response_formats(id, name, type, config)";
  const behaviorLogsTable = isTeacherStudent ? "behavior_logs" : "slp_behavior_logs";
  const behaviorTypeEmbed = isTeacherStudent
    ? "behavior_type:teacher_behavior_types(id, name, color)"
    : "behavior_type:behavior_types(id, name, color)";

  // Two separate literal .select() calls, same reason as
  // src/app/parent/page.tsx: postgrest-js needs a literal string to type
  // the result, so a runtime-computed column list defeats that.
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

  // Reuses the exact same student-level share_behavior_with_parent flag a
  // parent's view reads — no separate "share with classroom contact" flag,
  // by design (see 0036_classroom_contact_access.sql's comment on this).
  const shareBehaviorWithParent = Boolean(
    (student as { share_behavior_with_parent?: boolean }).share_behavior_with_parent
  );

  const [itemsResult, logsResult, goalsResult, behaviorLogsResult, sessionNotesResult] =
    await Promise.all([
      supabase
        .from(itemsTable)
        .select("id, what_to_do, how_to_do_it, last_used_date, created_at")
        .eq("student_id", student.id)
        .order("created_at", { ascending: false }),
      supabase
        .from(logsTable)
        .select(`id, date, activities, how_it_went, note, created_at, ${praiseEmbed}`)
        .eq("student_id", student.id)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false }),
      // Same visible_to_parent filter a parent's view uses — the
      // classroom contact sees exactly the goals the SLP/Teacher has
      // already opted to share, nothing more.
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
      supabase
        .from(sessionsRelation)
        .select("id, date, note")
        .eq("student_id", student.id)
        .eq("visible_to_parent", true)
        .order("date", { ascending: false }),
    ]);

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

  const sessionNotes: ParentSessionNote[] = (
    (sessionNotesResult.data ?? []) as unknown as {
      id: string;
      date: string;
      note: string | null;
    }[]
  )
    .filter((s) => s.note && s.note.trim())
    .map((s) => ({ id: s.id, date: s.date, note: s.note as string }));

  return (
    <main className="flex-1 bg-gradient-to-b from-cream-50 via-cream-50 to-brand-50 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <ClassroomDashboard
          studentName={student.name}
          items={(itemsResult.data ?? []) as unknown as ClassroomStrategy[]}
          logs={(logsResult.data ?? []) as unknown as ClassroomStrategyLogWithPraise[]}
          itemsError={itemsResult.error?.message ?? null}
          logsError={logsResult.error?.message ?? null}
          progressReports={progressReports}
          showBehaviorSection={shareBehaviorWithParent}
          behaviorBreakdown={behaviorBreakdown}
          sessionNotes={sessionNotes}
        />
      </div>
    </main>
  );
}
