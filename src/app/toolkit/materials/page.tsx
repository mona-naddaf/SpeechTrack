import Link from "next/link";
import { ArrowLeft, ClipboardList, ListTree, Sliders, Smile, Target, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Area, MaterialGoalOption } from "@/lib/types";
import { flattenMaterialJoins, type RawMaterialJoin } from "@/lib/materials";
import MaterialsList from "./materials-list";

export default async function MaterialsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Both queries below add an explicit slp_id filter, not just RLS: since
  // 0025_community_sharing_browse.sql added a second permissive SELECT
  // policy allowing *any* account's visibility='shared' rows, RLS alone
  // would also let another SLP's shared materials/bank goals leak in here.
  const [materialsResult, areasResult, goalsResult] = await Promise.all([
    supabase
      .from("materials")
      .select(
        "id, title, url, description, area_id, visibility, created_at, area:areas(id, name), material_goals(goal_id)"
      )
      .eq("slp_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("areas").select("id, name").order("name", { ascending: true }),
    // Only bank templates and freehand (never-from-bank) goals — a goal
    // created "from bank" isn't offered here, since materials for it
    // should be linked at the bank-template level so they apply to
    // every student assigned that same bank goal (see
    // resolveMaterialChipsByGoal).
    supabase
      .from("goals")
      .select("id, text, area_id, area:areas(id, name), student:students(id, name)")
      .eq("slp_id", user.id)
      .is("source_bank_goal_id", null)
      .order("text", { ascending: true }),
  ]);

  return (
    <main className="flex-1 bg-cream-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-brand-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/toolkit/assessments"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <ClipboardList className="h-4 w-4" />
              Assessments
            </Link>
            <Link
              href="/toolkit/goals"
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
              href="/toolkit/track-templates"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <ListTree className="h-4 w-4" />
              Track templates
            </Link>
            <Link
              href="/toolkit/community"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Users className="h-4 w-4" />
              Community
            </Link>
          </div>
        </div>

        <div className="mt-4">
          <h1 className="text-2xl font-bold text-stone-900">Material bank</h1>
          <p className="mt-1 text-stone-600">
            Save links to the resources you use most — worksheets, videos,
            decks — and optionally tie them to a goal so they show up right
            on the student&apos;s page.
          </p>
        </div>

        {materialsResult.error && (
          <p className="mt-4 text-sm text-red-600">
            Couldn&apos;t load materials: {materialsResult.error.message}
          </p>
        )}

        <div className="mt-6">
          <MaterialsList
            initialMaterials={flattenMaterialJoins(
              (materialsResult.data ?? []) as unknown as RawMaterialJoin[]
            )}
            areas={(areasResult.data ?? []) as Area[]}
            goalOptions={
              (goalsResult.data ?? []) as unknown as MaterialGoalOption[]
            }
          />
        </div>
      </div>
    </main>
  );
}
