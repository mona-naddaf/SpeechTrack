import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { resolveDefaultFormatId } from "@/lib/default-format";
import type { GoalWithRelations, SessionGoal } from "@/lib/types";
import {
  resolveMaterialChipsByGoal,
  type RawGoalMaterialLink,
} from "@/lib/materials";
import {
  computeLastUsedStatsByGoalAndMaterial,
  type ProgressGoal,
  type RawMaterialTrialJoin,
} from "@/lib/progress";
import AvatarBadge from "@/components/avatar-badge";
import FutureGoalNotesBanner from "@/components/future-goal-notes-banner";
import NewSessionForm from "./new-session-form";

export default async function NewSessionPage({
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

  const { data: student } = await supabase
    .from("students")
    .select("id, name, class, avatar")
    .eq("id", id)
    .maybeSingle();

  if (!student) {
    notFound();
  }

  const { data: goals, error } = await supabase
    .from("goals")
    .select(
      "id, text, source_bank_goal_id, area:areas(id, name), response_format:response_formats(id, name, type, config)"
    )
    .eq("student_id", id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const sessionGoals = (goals ?? []) as unknown as SessionGoal[];
  const goalIds = sessionGoals.map((g) => g.id);
  // A material linked to a bank goal (from /toolkit/materials) applies
  // to every goal sourced from it, not just one student's row — so the
  // material lookup below also needs to check each bank template id.
  const bankGoalIds = Array.from(
    new Set(
      sessionGoals
        .map((g) => g.source_bank_goal_id)
        .filter((bankId): bankId is string => Boolean(bankId))
    )
  );
  const materialLookupGoalIds = Array.from(new Set([...goalIds, ...bankGoalIds]));

  // Which materials each goal has linked (for the in-card picker), and
  // any past trials tagged with a material for these goals (to seed
  // "Last used" stats once one gets selected) — both follow-up queries
  // since they depend on the goal ids just fetched above.
  const [materialLinksResult, materialTrialsResult] =
    materialLookupGoalIds.length > 0
      ? await Promise.all([
          supabase
            .from("material_goals")
            .select("goal_id, material:materials(id, title, url)")
            .in("goal_id", materialLookupGoalIds),
          supabase
            .from("trials")
            .select("goal_id, material_id, value, session:sessions(date)")
            .in("goal_id", goalIds)
            .not("material_id", "is", null),
        ])
      : [{ data: [] as RawGoalMaterialLink[] }, { data: [] as RawMaterialTrialJoin[] }];

  const materialsByGoalId = resolveMaterialChipsByGoal(
    sessionGoals,
    (materialLinksResult.data ?? []) as unknown as RawGoalMaterialLink[]
  );
  const lastUsedByGoalId = computeLastUsedStatsByGoalAndMaterial(
    sessionGoals.map((g) => ({ ...g, status: "active" }) as ProgressGoal),
    (materialTrialsResult.data ?? []) as unknown as RawMaterialTrialJoin[]
  );

  // Everything the "+ Add goal" quick action needs to open the exact same
  // Set-a-goal flow as the student page, without leaving this session —
  // same queries as goals-section.tsx's own data-fetching page.
  const [
    { data: allGoalsData },
    { data: areasData },
    { data: responseFormatsData },
    { data: bankGoalsData },
    { data: futureGoalNotesData },
  ] = await Promise.all([
    supabase
      .from("goals")
      .select(
        "id, student_id, area_id, text, response_format_id, baseline, target_percent, status, visible_to_parent, track_id, step_order, created_at, area:areas(id, name), response_format:response_formats(id, name), track:goal_tracks(id, name)"
      )
      .eq("student_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("areas").select("id, name").order("name", { ascending: true }),
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
      .from("future_goal_notes")
      .select("id, text")
      .eq("slp_id", user.id)
      .eq("student_id", id)
      .is("resolved_at", null)
      .order("created_at", { ascending: true }),
  ]);

  return (
    <main className="flex-1 bg-cream-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/students/${student.id}`}
          className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-brand-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {student.name}
        </Link>

        <h1 className="mt-4 text-2xl font-bold text-stone-900">
          New session
        </h1>
        <div className="mt-1 flex items-center gap-2">
          <AvatarBadge avatar={student.avatar} size="sm" />
          <p className="text-stone-600">{student.name}</p>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-600">
            Couldn&apos;t load goals: {error.message}
          </p>
        )}

        <FutureGoalNotesBanner notes={futureGoalNotesData ?? []} />

        <div className="mt-6">
          <NewSessionForm
            studentId={student.id}
            goals={sessionGoals}
            initialMaterialsByGoalId={materialsByGoalId}
            lastUsedByGoalId={lastUsedByGoalId}
            areas={areasData ?? []}
            responseFormats={responseFormatsData ?? []}
            defaultFormatId={resolveDefaultFormatId(user, responseFormatsData ?? [])}
            bankGoals={bankGoalsData ?? []}
            initialStudentGoals={
              (allGoalsData ?? []) as unknown as GoalWithRelations[]
            }
          />
        </div>
      </div>
    </main>
  );
}
