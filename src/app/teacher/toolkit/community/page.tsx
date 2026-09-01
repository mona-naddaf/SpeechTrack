import Link from "next/link";
import { ArrowLeft, Library, Sliders, Smile, Target } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/role";
import type {
  CommunityAuthor,
  CommunityRatingRow,
  TeacherSharedGoalRow,
  TeacherSharedMaterialRow,
  TeacherSharedResponseFormatRow,
  TeacherSubject,
} from "@/lib/types";
import CommunityBrowse, {
  type CommonSharedFormat,
  type CommonSharedGoal,
  type CommonSharedMaterial,
} from "@/components/community-browse";

const SHARED_GOAL_SELECT_COLUMNS =
  "id, teacher_id, subject_id, text, response_format_id, target_percent, created_at, subject:teacher_subjects(id, name), response_format:teacher_response_formats(id, name, type, config)";
const SHARED_FORMAT_SELECT_COLUMNS = "id, teacher_id, name, type, config, created_at";
const SHARED_MATERIAL_SELECT_COLUMNS =
  "id, teacher_id, title, url, description, subject_id, created_at, subject:teacher_subjects(id, name)";

/** Same postgrest-js to-one-relation quirk noted throughout
 *  src/lib/materials.ts (no generated Database types) — a joined
 *  `subject`/`response_format` comes back as a single object at
 *  runtime, but nothing guarantees that at the type level. */
function unwrapOne<T>(rel: T | T[] | null | undefined): T | null {
  return Array.isArray(rel) ? (rel[0] ?? null) : (rel ?? null);
}

export default async function TeacherCommunityPage() {
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

  const [
    goalsResult,
    formatsResult,
    materialsResult,
    subjectsResult,
    copiedGoalsResult,
    copiedFormatsResult,
    copiedMaterialsResult,
    goalRatingsResult,
    formatRatingsResult,
    materialRatingsResult,
  ] = await Promise.all([
    supabase
      .from("teacher_goals")
      .select(SHARED_GOAL_SELECT_COLUMNS)
      .eq("visibility", "shared")
      .is("student_id", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("teacher_response_formats")
      .select(SHARED_FORMAT_SELECT_COLUMNS)
      .eq("visibility", "shared")
      .order("created_at", { ascending: false }),
    supabase
      .from("teacher_materials")
      .select(SHARED_MATERIAL_SELECT_COLUMNS)
      .eq("visibility", "shared")
      .order("created_at", { ascending: false }),
    supabase.from("teacher_subjects").select("id, name").order("name", { ascending: true }),
    // Which shared items she already has a copy of (see copied_from_id
    // in 0026_community_copy_tracking.sql) — drives the "Already in your
    // bank" disabled state so "Add to my bank" can't duplicate a copy.
    supabase
      .from("teacher_goals")
      .select("copied_from_id")
      .eq("teacher_id", user.id)
      .not("copied_from_id", "is", null),
    supabase
      .from("teacher_response_formats")
      .select("copied_from_id")
      .eq("teacher_id", user.id)
      .not("copied_from_id", "is", null),
    supabase
      .from("teacher_materials")
      .select("copied_from_id")
      .eq("teacher_id", user.id)
      .not("copied_from_id", "is", null),
    // Ratings on every goal/format/material she can see. No item_id
    // filter needed: community_ratings' own SELECT policy
    // (community_item_is_visible, 0027_community_ratings.sql) already
    // scopes this to exactly the same "owns it or it's shared"
    // universe as the three queries above, so this can't return a
    // rating for anything not already shown on this page.
    supabase
      .from("community_ratings")
      .select("item_id, rater_id, rating")
      .eq("item_type", "teacher_goal"),
    supabase
      .from("community_ratings")
      .select("item_id, rater_id, rating")
      .eq("item_type", "teacher_response_format"),
    supabase
      .from("community_ratings")
      .select("item_id, rater_id, rating")
      .eq("item_type", "teacher_material"),
  ]);

  const rawGoals = (goalsResult.data ?? []) as unknown as (TeacherSharedGoalRow & {
    subject: TeacherSharedGoalRow["subject"] | TeacherSubject[];
    response_format:
      | TeacherSharedGoalRow["response_format"]
      | NonNullable<TeacherSharedGoalRow["response_format"]>[];
  })[];
  const rawFormats = (formatsResult.data ??
    []) as unknown as TeacherSharedResponseFormatRow[];
  const rawMaterials = (materialsResult.data ?? []) as unknown as (TeacherSharedMaterialRow & {
    subject: TeacherSharedMaterialRow["subject"] | TeacherSubject[];
  })[];

  const goals: CommonSharedGoal[] = rawGoals.map((row) => {
    const subject = unwrapOne(row.subject);
    const responseFormat = unwrapOne(row.response_format);
    return {
      id: row.id,
      ownerId: row.teacher_id,
      text: row.text,
      categoryName: subject?.name ?? "Uncategorized",
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
    ownerId: row.teacher_id,
    name: row.name,
    type: row.type,
    config: row.config,
  }));

  const materials: CommonSharedMaterial[] = rawMaterials.map((row) => {
    const subject = unwrapOne(row.subject);
    return {
      id: row.id,
      ownerId: row.teacher_id,
      title: row.title,
      url: row.url,
      description: row.description,
      categoryName: subject?.name ?? "Uncategorized",
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
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/teacher/dashboard"
            className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-brand-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/teacher/toolkit/goals"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Target className="h-4 w-4" />
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
          </div>
        </div>

        <div className="mt-4">
          <h1 className="text-2xl font-bold text-stone-900">Community</h1>
          <p className="mt-1 text-stone-600">
            Browse goals, response formats, and materials other Teachers have
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
            categoryLabel="Subject"
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
            goalItemType="teacher_goal"
            formatItemType="teacher_response_format"
            materialItemType="teacher_material"
            myCategories={(subjectsResult.data ?? []) as TeacherSubject[]}
            goalsTable="teacher_goals"
            formatsTable="teacher_response_formats"
            materialsTable="teacher_materials"
            categoryTable="teacher_subjects"
            categoryIdColumn="subject_id"
            ownerColumn="teacher_id"
          />
        </div>
      </div>
    </main>
  );
}
