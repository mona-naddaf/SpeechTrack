import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/role";
import type { TeacherSessionGoal } from "@/lib/types";
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
import NewSessionForm from "./new-session-form";

export default async function NewTeacherSessionPage({
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

  const { data: student } = await supabase
    .from("teacher_students")
    .select("id, name, class, avatar")
    .eq("id", id)
    .maybeSingle();

  if (!student) {
    notFound();
  }

  const { data: goals, error } = await supabase
    .from("teacher_goals")
    .select(
      "id, text, source_bank_goal_id, subject:teacher_subjects(id, name), response_format:teacher_response_formats(id, name, type, config)"
    )
    .eq("student_id", id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const sessionGoals = (goals ?? []) as unknown as TeacherSessionGoal[];
  const goalIds = sessionGoals.map((g) => g.id);
  // A material linked to a bank goal (from /teacher/toolkit/materials)
  // applies to every goal sourced from it, not just one student's row —
  // so the material lookup below also needs to check each bank
  // template id.
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
            .from("teacher_material_goals")
            .select("goal_id, material:teacher_materials(id, title, url)")
            .in("goal_id", materialLookupGoalIds),
          supabase
            .from("teacher_trials")
            .select("goal_id, material_id, value, session:teacher_sessions(date)")
            .in("goal_id", goalIds)
            .not("material_id", "is", null),
        ])
      : [{ data: [] as RawGoalMaterialLink[] }, { data: [] as RawMaterialTrialJoin[] }];

  const materialsByGoalId = resolveMaterialChipsByGoal(
    sessionGoals,
    (materialLinksResult.data ?? []) as unknown as RawGoalMaterialLink[]
  );
  // buildGoalReport only cares about a goal's text/status/response_format —
  // "subject" fills the same slot "area" does on the SLP side (same
  // adapter as the teacher progress page).
  const lastUsedByGoalId = computeLastUsedStatsByGoalAndMaterial(
    sessionGoals.map(
      (g) =>
        ({
          id: g.id,
          text: g.text,
          status: "active",
          area: g.subject,
          response_format: g.response_format,
        }) as ProgressGoal
    ),
    (materialTrialsResult.data ?? []) as unknown as RawMaterialTrialJoin[]
  );

  return (
    <main className="flex-1 bg-cream-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/teacher/students/${student.id}`}
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

        <div className="mt-6">
          <NewSessionForm
            studentId={student.id}
            goals={sessionGoals}
            initialMaterialsByGoalId={materialsByGoalId}
            lastUsedByGoalId={lastUsedByGoalId}
          />
        </div>
      </div>
    </main>
  );
}
