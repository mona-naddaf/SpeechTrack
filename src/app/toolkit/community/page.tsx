import Link from "next/link";
import { ArrowLeft, ClipboardList, Gamepad2, Sliders, Smile, Target, Library, ListTree } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  Area,
  CommunityAuthor,
  CommunityCategoryRow,
  CommunityLinkedGoalRow,
  CommunityRatingRow,
  SharedGoalRow,
  SharedMaterialRow,
  SharedResponseFormatRow,
} from "@/lib/types";
import CommunityBrowse, {
  type CommonSharedFormat,
  type CommonSharedGoal,
  type CommonSharedMaterial,
} from "@/components/community-browse";

const SHARED_GOAL_SELECT_COLUMNS =
  "id, slp_id, area_id, text, response_format_id, target_percent, created_at, area:areas(id, name), response_format:response_formats(id, name, type, config)";
const SHARED_FORMAT_SELECT_COLUMNS = "id, slp_id, name, type, config, created_at";
const SHARED_MATERIAL_SELECT_COLUMNS =
  "id, slp_id, title, url, description, area_id, created_at, area:areas(id, name)";

/** Same postgrest-js to-one-relation quirk noted throughout
 *  src/lib/materials.ts (no generated Database types) — a joined
 *  `area`/`response_format` comes back as a single object at runtime,
 *  but nothing guarantees that at the type level. */
function unwrapOne<T>(rel: T | T[] | null | undefined): T | null {
  return Array.isArray(rel) ? (rel[0] ?? null) : (rel ?? null);
}

export default async function CommunityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [
    goalsResult,
    formatsResult,
    materialsResult,
    areasResult,
    copiedGoalsResult,
    copiedFormatsResult,
    copiedMaterialsResult,
    goalRatingsResult,
    formatRatingsResult,
    materialRatingsResult,
  ] = await Promise.all([
    supabase
      .from("goals")
      .select(SHARED_GOAL_SELECT_COLUMNS)
      .eq("visibility", "shared")
      .is("student_id", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("response_formats")
      .select(SHARED_FORMAT_SELECT_COLUMNS)
      .eq("visibility", "shared")
      .order("created_at", { ascending: false }),
    supabase
      .from("materials")
      .select(SHARED_MATERIAL_SELECT_COLUMNS)
      .eq("visibility", "shared")
      .order("created_at", { ascending: false }),
    supabase.from("areas").select("id, name").order("name", { ascending: true }),
    // Which shared items she already has a copy of (see copied_from_id
    // in 0026_community_copy_tracking.sql) — drives the "Already in your
    // bank" disabled state so "Add to my bank" can't duplicate a copy.
    supabase
      .from("goals")
      .select("copied_from_id")
      .eq("slp_id", user.id)
      .not("copied_from_id", "is", null),
    supabase
      .from("response_formats")
      .select("copied_from_id")
      .eq("slp_id", user.id)
      .not("copied_from_id", "is", null),
    supabase
      .from("materials")
      .select("copied_from_id")
      .eq("slp_id", user.id)
      .not("copied_from_id", "is", null),
    // Ratings on every goal/format/material she can see. No item_id
    // filter needed: community_ratings' own SELECT policy
    // (community_item_is_visible, 0027_community_ratings.sql) already
    // scopes this to exactly the same "owns it or it's shared"
    // universe as the three queries above, so this can't return a
    // rating for anything not already shown on this page.
    supabase.from("community_ratings").select("item_id, rater_id, rating").eq("item_type", "goal"),
    supabase
      .from("community_ratings")
      .select("item_id, rater_id, rating")
      .eq("item_type", "response_format"),
    supabase.from("community_ratings").select("item_id, rater_id, rating").eq("item_type", "material"),
  ]);

  const rawGoals = (goalsResult.data ?? []) as unknown as (SharedGoalRow & {
    area: SharedGoalRow["area"] | Area[];
    response_format:
      | SharedGoalRow["response_format"]
      | NonNullable<SharedGoalRow["response_format"]>[];
  })[];
  const rawFormats = (formatsResult.data ?? []) as unknown as SharedResponseFormatRow[];
  const rawMaterials = (materialsResult.data ?? []) as unknown as (SharedMaterialRow & {
    area: SharedMaterialRow["area"] | Area[];
  })[];

  // The embedded `area:areas(...)` join above only resolves for an item
  // *she* owns — areas is still owner-only RLS, so someone else's shared
  // goal/material embeds `area: null` here. get_shared_item_categories
  // (0028_community_shared_categories.sql) is the narrow, safely-scoped
  // lookup that fills in the real name for everyone else's items too,
  // the same pattern get_shared_item_authors already uses for display
  // names. Falls back to the embedded join (then "Uncategorized") so
  // this degrades gracefully if the RPC call itself fails.
  const goalIds = rawGoals.map((row) => row.id);
  const materialIds = rawMaterials.map((row) => row.id);

  const [goalCategoriesResult, materialCategoriesResult, linkedGoalsResult] =
    await Promise.all([
      goalIds.length > 0
        ? supabase.rpc("get_shared_item_categories", { p_item_type: "goal", p_item_ids: goalIds })
        : Promise.resolve({ data: [] as CommunityCategoryRow[] }),
      materialIds.length > 0
        ? supabase.rpc("get_shared_item_categories", {
            p_item_type: "material",
            p_item_ids: materialIds,
          })
        : Promise.resolve({ data: [] as CommunityCategoryRow[] }),
      materialIds.length > 0
        ? supabase.rpc("get_shared_material_linked_goals", {
            p_material_type: "material",
            p_material_ids: materialIds,
          })
        : Promise.resolve({ data: [] as CommunityLinkedGoalRow[] }),
    ]);

  const goalCategoryNameById = new Map(
    ((goalCategoriesResult.data ?? []) as { item_id: string; category_name: string }[]).map(
      (r) => [r.item_id, r.category_name]
    )
  );
  const materialCategoryNameById = new Map(
    (
      (materialCategoriesResult.data ?? []) as { item_id: string; category_name: string }[]
    ).map((r) => [r.item_id, r.category_name])
  );
  const linkedGoalsByMaterialId = new Map<string, { id: string; text: string }[]>();
  for (const row of (linkedGoalsResult.data ?? []) as {
    material_id: string;
    goal_id: string;
    goal_text: string;
  }[]) {
    const list = linkedGoalsByMaterialId.get(row.material_id) ?? [];
    list.push({ id: row.goal_id, text: row.goal_text });
    linkedGoalsByMaterialId.set(row.material_id, list);
  }

  const goals: CommonSharedGoal[] = rawGoals.map((row) => {
    const area = unwrapOne(row.area);
    const responseFormat = unwrapOne(row.response_format);
    return {
      id: row.id,
      ownerId: row.slp_id,
      text: row.text,
      categoryName: goalCategoryNameById.get(row.id) ?? area?.name ?? "Uncategorized",
      targetPercent: row.target_percent,
      responseFormat: responseFormat
        ? {
            id: responseFormat.id,
            name: responseFormat.name,
            type: responseFormat.type,
            config: responseFormat.config,
          }
        : null,
    };
  });

  const formats: CommonSharedFormat[] = rawFormats.map((row) => ({
    id: row.id,
    ownerId: row.slp_id,
    name: row.name,
    type: row.type,
    config: row.config,
  }));

  const materials: CommonSharedMaterial[] = rawMaterials.map((row) => {
    const area = unwrapOne(row.area);
    return {
      id: row.id,
      ownerId: row.slp_id,
      title: row.title,
      url: row.url,
      description: row.description,
      categoryName: materialCategoryNameById.get(row.id) ?? area?.name ?? "Uncategorized",
      linkedGoals: linkedGoalsByMaterialId.get(row.id) ?? [],
    };
  });

  const ownerIds = Array.from(
    new Set([
      ...goals.map((g) => g.ownerId),
      ...formats.map((f) => f.ownerId),
      ...materials.map((m) => m.ownerId),
    ])
  );

  const authorsById: Record<string, string> = {};
  if (ownerIds.length > 0) {
    const { data: authors } = await supabase.rpc("get_shared_item_authors", {
      p_ids: ownerIds,
    });
    for (const author of (authors ?? []) as CommunityAuthor[]) {
      authorsById[author.id] = author.display_name;
    }
  }

  const loadError =
    goalsResult.error?.message ??
    formatsResult.error?.message ??
    materialsResult.error?.message ??
    null;

  const alreadyCopiedGoalIds = (
    (copiedGoalsResult.data ?? []) as { copied_from_id: string }[]
  ).map((r) => r.copied_from_id);
  const alreadyCopiedFormatIds = (
    (copiedFormatsResult.data ?? []) as { copied_from_id: string }[]
  ).map((r) => r.copied_from_id);
  const alreadyCopiedMaterialIds = (
    (copiedMaterialsResult.data ?? []) as { copied_from_id: string }[]
  ).map((r) => r.copied_from_id);

  const mapRatingRows = (
    rows: { item_id: string; rater_id: string; rating: number }[] | null
  ): CommunityRatingRow[] =>
    (rows ?? []).map((r) => ({ itemId: r.item_id, raterId: r.rater_id, rating: r.rating }));
  const goalRatings = mapRatingRows(goalRatingsResult.data);
  const formatRatings = mapRatingRows(formatRatingsResult.data);
  const materialRatings = mapRatingRows(materialRatingsResult.data);

  return (
    <main className="flex-1 bg-cream-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Link
            href="/dashboard"
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-sm text-stone-500 transition-colors hover:text-brand-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Link
              href="/toolkit/assessments"
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <ClipboardList className="h-4 w-4" />
              Assessments
            </Link>
            <Link
              href="/toolkit/goals"
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Target className="h-4 w-4" />
              Goal bank
            </Link>
            <Link
              href="/toolkit/formats"
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Sliders className="h-4 w-4" />
              Response formats
            </Link>
            <Link
              href="/toolkit/behavior-types"
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Smile className="h-4 w-4" />
              Behavior types
            </Link>
            <Link
              href="/toolkit/materials"
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Library className="h-4 w-4" />
              Materials
            </Link>
            <Link
              href="/toolkit/track-templates"
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <ListTree className="h-4 w-4" />
              Track templates
            </Link>
            <Link
              href="/toolkit/reinforcement-boards"
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Gamepad2 className="h-4 w-4" />
              Reinforcement bank
            </Link>
          </div>
        </div>

        <div className="mt-4">
          <h1 className="text-2xl font-bold text-stone-900">Community</h1>
          <p className="mt-1 text-stone-600">
            Browse goals, response formats, and materials other SLPs have
            marked &quot;Shared&quot;, and add anything useful straight into
            your own bank.
          </p>
        </div>

        {loadError && (
          <p className="mt-4 text-sm text-red-600">
            Couldn&apos;t load the community bank: {loadError}
          </p>
        )}

        <div className="mt-6">
          <CommunityBrowse
            currentUserId={user.id}
            categoryLabel="Area"
            goals={goals}
            formats={formats}
            materials={materials}
            authorsById={authorsById}
            alreadyCopiedGoalIds={alreadyCopiedGoalIds}
            alreadyCopiedFormatIds={alreadyCopiedFormatIds}
            alreadyCopiedMaterialIds={alreadyCopiedMaterialIds}
            goalRatings={goalRatings}
            formatRatings={formatRatings}
            materialRatings={materialRatings}
            goalItemType="goal"
            formatItemType="response_format"
            materialItemType="material"
            myCategories={(areasResult.data ?? []) as Area[]}
            goalsTable="goals"
            formatsTable="response_formats"
            materialsTable="materials"
            categoryTable="areas"
            categoryIdColumn="area_id"
            ownerColumn="slp_id"
          />
        </div>
      </div>
    </main>
  );
}
