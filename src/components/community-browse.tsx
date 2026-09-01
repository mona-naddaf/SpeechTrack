"use client";

import { useMemo, useState, type Dispatch, type ReactElement, type SetStateAction } from "react";
import { Check, ExternalLink, Library, Plus, Sliders, Star, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { CommunityItemType, CommunityRatingRow, ResponseFormatType } from "@/lib/types";
import { RESPONSE_FORMAT_TYPE_LABELS } from "@/lib/response-format-types";

type Category = { id: string; name: string };

/** Side-agnostic shapes CommunityBrowse actually renders/copies from —
 *  the SLP and Teacher community pages each map their raw
 *  SharedGoalRow/TeacherSharedGoalRow (etc., from src/lib/types.ts)
 *  query results into these before handing them to this component, so
 *  it never needs to know "area" vs "subject" field names. Only the
 *  *write* side (find-or-create category, insert the copy) still needs
 *  real table/column names — passed separately as props. */
export type CommonSharedGoal = {
  id: string;
  ownerId: string;
  text: string;
  categoryName: string;
  targetPercent: number | null;
  responseFormat: {
    id: string;
    name: string;
    type: ResponseFormatType;
    config: Record<string, unknown>;
  } | null;
};

export type CommonSharedFormat = {
  id: string;
  ownerId: string;
  name: string;
  type: ResponseFormatType;
  config: Record<string, unknown>;
};

export type CommonSharedMaterial = {
  id: string;
  ownerId: string;
  title: string;
  url: string;
  description: string | null;
  categoryName: string;
  /** From get_shared_material_linked_goals() (0028_community_shared_categories.sql)
   *  — only ever populated with goals that are *also* shared, never a
   *  private/student-assigned one (see that migration for why). Usually
   *  0 or 1 entries, but a material can link to more than one goal. */
  linkedGoals: { id: string; text: string }[];
};

type Tab = "goals" | "formats" | "materials";

type Props = {
  currentUserId: string;
  /** "Area" for the SLP side, "Subject" for the Teacher side — drives
   *  labels only (the actual table name is categoryTable below). */
  categoryLabel: "Area" | "Subject";
  goals: CommonSharedGoal[];
  formats: CommonSharedFormat[];
  materials: CommonSharedMaterial[];
  /** display_name for every distinct owner id across all three lists,
   *  from get_shared_item_authors() — see the two page.tsx callers. */
  authorsById: Record<string, string>;
  /** copied_from_id values already present on her own rows (one array
   *  per tab) — every shared item id she already has a copy of, so
   *  "Add to my bank" can't create a duplicate. See
   *  0026_community_copy_tracking.sql and the two page.tsx callers. */
  alreadyCopiedGoalIds: string[];
  alreadyCopiedFormatIds: string[];
  alreadyCopiedMaterialIds: string[];
  /** Every rating on any goal/format/material she can see (one array per
   *  tab — see 0027_community_ratings.sql and the two page.tsx callers).
   *  Used both to show each item's average/count and to seed her own
   *  star picker with whatever she's already rated it. */
  goalRatings: CommunityRatingRow[];
  formatRatings: CommunityRatingRow[];
  materialRatings: CommunityRatingRow[];
  /** The community_ratings.item_type value each tab's rows are stored
   *  under — "goal"/"response_format"/"material" on the SLP side,
   *  "teacher_goal"/etc. on the Teacher side. */
  goalItemType: "goal" | "teacher_goal";
  formatItemType: "response_format" | "teacher_response_format";
  materialItemType: "material" | "teacher_material";
  /** Her own areas/subjects, for find-or-create-by-name when copying a
   *  goal or material into her bank (same matching logic
   *  GoalExcelImport already uses for bulk import). */
  myCategories: Category[];
  goalsTable: "goals" | "teacher_goals";
  formatsTable: "response_formats" | "teacher_response_formats";
  materialsTable: "materials" | "teacher_materials";
  categoryTable: "areas" | "teacher_subjects";
  categoryIdColumn: "area_id" | "subject_id";
  ownerColumn: "slp_id" | "teacher_id";
};

/** One item's rating summary, derived from a CommunityRatingRow[] — see
 *  summarizeRatings() below. */
type RatingSummary = { average: number; count: number; myRating: number | null };

/** Groups a flat rating list by item id into per-item average/count/
 *  "my rating" — used once per tab (goals/formats/materials each carry
 *  their own item_type, so their rating lists never mix). */
function summarizeRatings(
  rows: CommunityRatingRow[],
  currentUserId: string
): Map<string, RatingSummary> {
  const byItem = new Map<string, number[]>();
  for (const row of rows) {
    const list = byItem.get(row.itemId) ?? [];
    list.push(row.rating);
    byItem.set(row.itemId, list);
  }
  const summaries = new Map<string, RatingSummary>();
  for (const [itemId, values] of byItem) {
    const mine = rows.find((r) => r.itemId === itemId && r.raterId === currentUserId);
    summaries.set(itemId, {
      average: values.reduce((sum, v) => sum + v, 0) / values.length,
      count: values.length,
      myRating: mine ? mine.rating : null,
    });
  }
  return summaries;
}

const TABS: { key: Tab; label: string; icon: typeof Target }[] = [
  { key: "goals", label: "Goals", icon: Target },
  { key: "formats", label: "Response formats", icon: Sliders },
  { key: "materials", label: "Materials", icon: Library },
];

function formatTypeLabel(type: ResponseFormatType): string {
  return RESPONSE_FORMAT_TYPE_LABELS.find((t) => t.type === type)?.label ?? type;
}

/** Browse/discovery for every 'shared' goal, response format, and
 *  material across accounts on one side (SLP or Teacher) — plus "Add to
 *  my bank" on anyone else's item, which copies it into her own bank as
 *  a fresh, private-by-default row (sharing status never carries over
 *  automatically, per the community-sharing spec). Her own shared items
 *  are shown separately, read-only, further down the page — adding her
 *  own item to her own bank makes no sense, so that action never
 *  appears there. */
export default function CommunityBrowse({
  currentUserId,
  categoryLabel,
  goals,
  formats,
  materials,
  authorsById,
  alreadyCopiedGoalIds,
  alreadyCopiedFormatIds,
  alreadyCopiedMaterialIds,
  goalRatings,
  formatRatings,
  materialRatings,
  goalItemType,
  formatItemType,
  materialItemType,
  myCategories,
  goalsTable,
  formatsTable,
  materialsTable,
  categoryTable,
  categoryIdColumn,
  ownerColumn,
}: Props) {
  const [tab, setTab] = useState<Tab>("goals");
  const [categoryFilter, setCategoryFilter] = useState("");
  // Grows locally as find-or-create discovers/creates categories while
  // copying items, so a second copy in the same visit reuses them
  // instead of re-creating (or re-querying) every time.
  const [categories, setCategories] = useState<Category[]>(myCategories);
  // Every shared item id she already has a copy of — seeded from the
  // server-fetched copied_from_id values (a copy from an earlier visit,
  // or from another tab/device) and grown as copies succeed in this
  // session. Drives the "Already in your bank" disabled button state.
  const [copiedIds, setCopiedIds] = useState<Set<string>>(
    () =>
      new Set([
        ...alreadyCopiedGoalIds,
        ...alreadyCopiedFormatIds,
        ...alreadyCopiedMaterialIds,
      ])
  );
  // Subset of copiedIds added *in this session* — just distinguishes the
  // "Added" label (brief positive feedback right after a click) from
  // "Already in your bank" (was already true when the page loaded).
  const [justAddedIds, setJustAddedIds] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Local, mutable copies of the server-fetched rating lists — updated
  // optimistically the moment a rating upsert succeeds, so the average/
  // count and her own star picker reflect it immediately.
  const [goalRatingsState, setGoalRatingsState] = useState<CommunityRatingRow[]>(goalRatings);
  const [formatRatingsState, setFormatRatingsState] =
    useState<CommunityRatingRow[]>(formatRatings);
  const [materialRatingsState, setMaterialRatingsState] =
    useState<CommunityRatingRow[]>(materialRatings);
  const [ratingPendingId, setRatingPendingId] = useState<string | null>(null);

  const goalRatingSummaries = useMemo(
    () => summarizeRatings(goalRatingsState, currentUserId),
    [goalRatingsState, currentUserId]
  );
  const formatRatingSummaries = useMemo(
    () => summarizeRatings(formatRatingsState, currentUserId),
    [formatRatingsState, currentUserId]
  );
  const materialRatingSummaries = useMemo(
    () => summarizeRatings(materialRatingsState, currentUserId),
    [materialRatingsState, currentUserId]
  );

  /** Submits (or updates) her rating on one item — upserted on the same
   *  (item_type, item_id, rater_id) uniqueness constraint the DB
   *  enforces, so re-rating always updates her existing row rather than
   *  creating a second one. RLS (community_item_is_ratable,
   *  0027_community_ratings.sql) independently blocks this for her own
   *  items, but the UI never renders a picker there to begin with (see
   *  RatingControl below) — belt-and-braces, not the only guard. */
  async function handleRate(
    itemType: CommunityItemType,
    itemId: string,
    rating: number,
    setLocal: Dispatch<SetStateAction<CommunityRatingRow[]>>
  ) {
    setRatingPendingId(itemId);
    setError(null);
    const supabase = createClient();

    const { error: rateError } = await supabase.from("community_ratings").upsert(
      { item_type: itemType, item_id: itemId, rater_id: currentUserId, rating },
      { onConflict: "item_type,item_id,rater_id" }
    );

    setRatingPendingId(null);
    if (rateError) {
      setError(rateError.message);
      return;
    }
    setLocal((prev) => {
      const idx = prev.findIndex(
        (r) => r.itemId === itemId && r.raterId === currentUserId
      );
      if (idx === -1) return [...prev, { itemId, raterId: currentUserId, rating }];
      const next = [...prev];
      next[idx] = { itemId, raterId: currentUserId, rating };
      return next;
    });
  }

  function switchTab(next: Tab) {
    setTab(next);
    setCategoryFilter("");
    setError(null);
  }

  function authorName(ownerId: string): string {
    if (ownerId === currentUserId) return "You";
    return authorsById[ownerId] ?? "Anonymous";
  }

  const categoryOptions = useMemo(() => {
    const names = new Set<string>();
    if (tab === "goals") for (const g of goals) names.add(g.categoryName);
    else if (tab === "formats") for (const f of formats) names.add(formatTypeLabel(f.type));
    else for (const m of materials) names.add(m.categoryName);
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [tab, goals, formats, materials]);

  const filteredGoals = useMemo(
    () => goals.filter((g) => !categoryFilter || g.categoryName === categoryFilter),
    [goals, categoryFilter]
  );
  const filteredFormats = useMemo(
    () =>
      formats.filter(
        (f) => !categoryFilter || formatTypeLabel(f.type) === categoryFilter
      ),
    [formats, categoryFilter]
  );
  const filteredMaterials = useMemo(
    () => materials.filter((m) => !categoryFilter || m.categoryName === categoryFilter),
    [materials, categoryFilter]
  );

  /** Finds her own area/subject by case-insensitive name, or creates one
   *  if she doesn't have a matching category yet — same find-or-create
   *  pattern GoalExcelImport uses for bulk goal imports. */
  async function findOrCreateCategoryId(
    supabase: ReturnType<typeof createClient>,
    name: string
  ): Promise<string | null> {
    const key = name.trim().toLowerCase();
    const existing = categories.find((c) => c.name.trim().toLowerCase() === key);
    if (existing) return existing.id;

    const { data, error: createError } = await supabase
      .from(categoryTable)
      .insert({ [ownerColumn]: currentUserId, name: name.trim() })
      .select("id, name")
      .single();

    if (createError || !data) {
      setError(createError?.message ?? `Couldn't create "${name}".`);
      return null;
    }
    const created = data as unknown as Category;
    setCategories((prev) => [...prev, created]);
    return created.id;
  }

  /** True if she already has a copy of this exact shared item — checked
   *  fresh against her own table (not just the copiedIds state, which
   *  could be stale if a copy was made from another tab/device since
   *  this page loaded) right before every insert, so "Add to my bank"
   *  can never create a duplicate. */
  async function alreadyHasCopy(
    supabase: ReturnType<typeof createClient>,
    table: "goals" | "teacher_goals" | "response_formats" | "teacher_response_formats" | "materials" | "teacher_materials",
    sourceId: string
  ): Promise<boolean> {
    const { data, error: checkError } = await supabase
      .from(table)
      .select("id")
      .eq(ownerColumn, currentUserId)
      .eq("copied_from_id", sourceId)
      .limit(1)
      .maybeSingle();
    if (checkError) {
      setError(checkError.message);
      return true; // fail closed — don't risk inserting a duplicate
    }
    return data !== null;
  }

  /** Finds her own copy of a shared response format by copied_from_id
   *  (reusing it rather than making a second copy — this is what keeps
   *  0026_community_copy_tracking.sql's lack of a DB-level uniqueness
   *  constraint safe: a shared format copied both directly from the
   *  Formats tab and indirectly via a goal that references it still
   *  only ever produces one row), or creates one if she doesn't have it
   *  yet. Always private — sharing never carries over. */
  async function findOrCreateFormatCopyId(
    supabase: ReturnType<typeof createClient>,
    sourceFormat: NonNullable<CommonSharedGoal["responseFormat"]>
  ): Promise<string | null> {
    const { data: existing, error: existingError } = await supabase
      .from(formatsTable)
      .select("id")
      .eq(ownerColumn, currentUserId)
      .eq("copied_from_id", sourceFormat.id)
      .limit(1)
      .maybeSingle();
    if (existingError) {
      setError(existingError.message);
      return null;
    }
    if (existing) return (existing as { id: string }).id;

    const { data, error: formatError } = await supabase
      .from(formatsTable)
      .insert({
        [ownerColumn]: currentUserId,
        name: sourceFormat.name,
        type: sourceFormat.type,
        config: sourceFormat.config,
        visibility: "private",
        copied_from_id: sourceFormat.id,
      })
      .select("id")
      .single();
    if (formatError || !data) {
      setError(formatError?.message ?? "Couldn't copy the response format.");
      return null;
    }
    return (data as { id: string }).id;
  }

  async function handleAddGoal(goal: CommonSharedGoal) {
    if (copiedIds.has(goal.id)) return;
    setPendingId(goal.id);
    setError(null);
    const supabase = createClient();

    if (await alreadyHasCopy(supabase, goalsTable, goal.id)) {
      setPendingId(null);
      setCopiedIds((prev) => new Set(prev).add(goal.id));
      return;
    }

    const categoryId = await findOrCreateCategoryId(supabase, goal.categoryName);
    if (!categoryId) {
      setPendingId(null);
      return;
    }

    // A fresh copy of the referenced response format, not a reference to
    // it — the two accounts' response_formats rows are entirely separate,
    // and reusing by name risks silently attaching a same-named-but-
    // different-shaped format. Always private: sharing never carries over.
    let responseFormatId: string | null = null;
    if (goal.responseFormat) {
      responseFormatId = await findOrCreateFormatCopyId(supabase, goal.responseFormat);
      if (responseFormatId === null) {
        setPendingId(null);
        return;
      }
    }

    const { error: insertError } = await supabase.from(goalsTable).insert({
      [ownerColumn]: currentUserId,
      student_id: null,
      [categoryIdColumn]: categoryId,
      text: goal.text,
      response_format_id: responseFormatId,
      target_percent: goal.targetPercent,
      visibility: "private",
      copied_from_id: goal.id,
    });

    setPendingId(null);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setCopiedIds((prev) => new Set(prev).add(goal.id));
    setJustAddedIds((prev) => new Set(prev).add(goal.id));
  }

  async function handleAddFormat(format: CommonSharedFormat) {
    if (copiedIds.has(format.id)) return;
    setPendingId(format.id);
    setError(null);
    const supabase = createClient();

    if (await alreadyHasCopy(supabase, formatsTable, format.id)) {
      setPendingId(null);
      setCopiedIds((prev) => new Set(prev).add(format.id));
      return;
    }

    const { error: insertError } = await supabase.from(formatsTable).insert({
      [ownerColumn]: currentUserId,
      name: format.name,
      type: format.type,
      config: format.config,
      visibility: "private",
      copied_from_id: format.id,
    });

    setPendingId(null);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setCopiedIds((prev) => new Set(prev).add(format.id));
    setJustAddedIds((prev) => new Set(prev).add(format.id));
  }

  async function handleAddMaterial(material: CommonSharedMaterial) {
    if (copiedIds.has(material.id)) return;
    setPendingId(material.id);
    setError(null);
    const supabase = createClient();

    if (await alreadyHasCopy(supabase, materialsTable, material.id)) {
      setPendingId(null);
      setCopiedIds((prev) => new Set(prev).add(material.id));
      return;
    }

    const categoryId = await findOrCreateCategoryId(supabase, material.categoryName);
    if (!categoryId) {
      setPendingId(null);
      return;
    }

    const { error: insertError } = await supabase.from(materialsTable).insert({
      [ownerColumn]: currentUserId,
      title: material.title,
      url: material.url,
      description: material.description,
      [categoryIdColumn]: categoryId,
      visibility: "private",
      copied_from_id: material.id,
    });

    setPendingId(null);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setCopiedIds((prev) => new Set(prev).add(material.id));
    setJustAddedIds((prev) => new Set(prev).add(material.id));
  }

  function AddButton({
    id,
    onClick,
  }: {
    id: string;
    onClick: () => void;
  }) {
    if (copiedIds.has(id)) {
      const justAdded = justAddedIds.has(id);
      return (
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
            justAdded ? "bg-accent-100 text-accent-700" : "bg-stone-100 text-stone-500"
          }`}
        >
          <Check className="h-4 w-4" />
          {justAdded ? "Added" : "Already in your bank"}
        </span>
      );
    }
    return (
      <button
        onClick={onClick}
        disabled={pendingId === id}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
      >
        <Plus className="h-4 w-4" />
        {pendingId === id ? "Adding…" : "Add to my bank"}
      </button>
    );
  }

  /** The average/count summary (always shown when there's at least one
   *  rating) plus, for someone else's item, her own 1-5 star picker —
   *  clicking a star submits immediately, same instant-persist pattern
   *  the rest of this app uses (e.g. VisibilityField). `interactive`
   *  false on her own shared items: RLS would reject the insert anyway
   *  (community_item_is_ratable excludes the owner), but the picker
   *  simply isn't rendered there rather than rendering it disabled or
   *  letting a click surface a confusing permissions error. */
  function RatingControl({
    itemId,
    summary,
    interactive,
    onRate,
  }: {
    itemId: string;
    summary: RatingSummary | undefined;
    interactive: boolean;
    onRate: (rating: number) => void;
  }) {
    const average = summary?.average ?? 0;
    const count = summary?.count ?? 0;
    const myRating = summary?.myRating ?? null;
    const pending = ratingPendingId === itemId;

    return (
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1 text-xs text-stone-500">
          <StarGlyphs filled={Math.round(average)} />
          {count > 0
            ? `${average.toFixed(1)} (${count} rating${count === 1 ? "" : "s"})`
            : "No ratings yet"}
        </span>
        {interactive && (
          <span className="inline-flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                disabled={pending}
                onClick={() => onRate(n)}
                aria-label={`Rate ${n} star${n === 1 ? "" : "s"}`}
                className="rounded p-0.5 transition-transform hover:scale-110 disabled:opacity-50"
              >
                <Star
                  className={`h-4 w-4 ${
                    myRating !== null && n <= myRating
                      ? "fill-amber-400 text-amber-400"
                      : "text-stone-300"
                  }`}
                />
              </button>
            ))}
          </span>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => switchTab(key)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              tab === key
                ? "bg-brand-700 text-white shadow-sm"
                : "bg-white text-stone-600 hover:bg-stone-100"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {categoryOptions.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">
              {tab === "formats" ? "All types" : `All ${categoryLabel.toLowerCase()}s`}
            </option>
            {categoryOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          {categoryFilter && (
            <button
              onClick={() => setCategoryFilter("")}
              className="text-sm font-medium text-stone-500 underline underline-offset-2 hover:text-brand-800"
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {tab === "goals" && (
        <GoalsTab
          goals={filteredGoals}
          currentUserId={currentUserId}
          authorName={authorName}
          onAdd={handleAddGoal}
          AddButton={AddButton}
          ratingSummaries={goalRatingSummaries}
          onRate={(itemId, rating) =>
            handleRate(goalItemType, itemId, rating, setGoalRatingsState)
          }
          RatingControl={RatingControl}
        />
      )}
      {tab === "formats" && (
        <FormatsTab
          formats={filteredFormats}
          currentUserId={currentUserId}
          authorName={authorName}
          onAdd={handleAddFormat}
          AddButton={AddButton}
          ratingSummaries={formatRatingSummaries}
          onRate={(itemId, rating) =>
            handleRate(formatItemType, itemId, rating, setFormatRatingsState)
          }
          RatingControl={RatingControl}
        />
      )}
      {tab === "materials" && (
        <MaterialsTab
          materials={filteredMaterials}
          currentUserId={currentUserId}
          authorName={authorName}
          onAdd={handleAddMaterial}
          AddButton={AddButton}
          ratingSummaries={materialRatingSummaries}
          onRate={(itemId, rating) =>
            handleRate(materialItemType, itemId, rating, setMaterialRatingsState)
          }
          RatingControl={RatingControl}
        />
      )}
    </div>
  );
}

type AddButtonComponent = (props: { id: string; onClick: () => void }) => ReactElement;
type RatingControlComponent = (props: {
  itemId: string;
  summary: RatingSummary | undefined;
  interactive: boolean;
  onRate: (rating: number) => void;
}) => ReactElement;

/** Five static stars, `filled` of them solid — the read-only average
 *  display (as opposed to RatingControl's clickable picker). */
function StarGlyphs({ filled }: { filled: number }) {
  return (
    <span className="inline-flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-3.5 w-3.5 ${n <= filled ? "fill-amber-400 text-amber-400" : "text-stone-300"}`}
        />
      ))}
    </span>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
      <p className="text-stone-500">{label}</p>
    </div>
  );
}

function GoalsTab({
  goals,
  currentUserId,
  authorName,
  onAdd,
  AddButton,
  ratingSummaries,
  onRate,
  RatingControl,
}: {
  goals: CommonSharedGoal[];
  currentUserId: string;
  authorName: (ownerId: string) => string;
  onAdd: (goal: CommonSharedGoal) => void;
  AddButton: AddButtonComponent;
  ratingSummaries: Map<string, RatingSummary>;
  onRate: (itemId: string, rating: number) => void;
  RatingControl: RatingControlComponent;
}) {
  const others = goals.filter((g) => g.ownerId !== currentUserId);
  const mine = goals.filter((g) => g.ownerId === currentUserId);

  return (
    <div className="mt-4 space-y-8">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">
          Browse &amp; add
        </h2>
        {others.length === 0 ? (
          <EmptyState label="No shared goals from other accounts yet." />
        ) : (
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {others.map((goal) => (
              <div
                key={goal.id}
                className="flex flex-col rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
                    {goal.categoryName}
                  </span>
                </div>
                <p className="mt-2 flex-1 text-sm text-stone-900">{goal.text}</p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500">
                  {goal.responseFormat && <span>{goal.responseFormat.name}</span>}
                  {goal.targetPercent !== null && (
                    <span>Target: {goal.targetPercent}%</span>
                  )}
                </div>
                <RatingControl
                  itemId={goal.id}
                  summary={ratingSummaries.get(goal.id)}
                  interactive
                  onRate={(rating) => onRate(goal.id, rating)}
                />
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-xs text-stone-400">
                    Shared by {authorName(goal.ownerId)}
                  </span>
                  <AddButton id={goal.id} onClick={() => onAdd(goal)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {mine.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">
            Your shared goals
          </h2>
          <p className="mt-1 text-xs text-stone-500">
            For reference — manage these from your goal bank instead.
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {mine.map((goal) => (
              <div
                key={goal.id}
                className="flex flex-col rounded-2xl border border-dashed border-stone-200 bg-cream-50 p-4"
              >
                <span className="w-fit rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
                  {goal.categoryName}
                </span>
                <p className="mt-2 text-sm text-stone-700">{goal.text}</p>
                <RatingControl
                  itemId={goal.id}
                  summary={ratingSummaries.get(goal.id)}
                  interactive={false}
                  onRate={() => {}}
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function FormatsTab({
  formats,
  currentUserId,
  authorName,
  onAdd,
  AddButton,
  ratingSummaries,
  onRate,
  RatingControl,
}: {
  formats: CommonSharedFormat[];
  currentUserId: string;
  authorName: (ownerId: string) => string;
  onAdd: (format: CommonSharedFormat) => void;
  AddButton: AddButtonComponent;
  ratingSummaries: Map<string, RatingSummary>;
  onRate: (itemId: string, rating: number) => void;
  RatingControl: RatingControlComponent;
}) {
  const others = formats.filter((f) => f.ownerId !== currentUserId);
  const mine = formats.filter((f) => f.ownerId === currentUserId);

  return (
    <div className="mt-4 space-y-8">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">
          Browse &amp; add
        </h2>
        {others.length === 0 ? (
          <EmptyState label="No shared response formats from other accounts yet." />
        ) : (
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {others.map((format) => (
              <div
                key={format.id}
                className="flex flex-col rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <p className="text-sm font-semibold text-stone-900">{format.name}</p>
                <p className="mt-1 text-xs text-stone-400">
                  {formatTypeLabel(format.type)}
                </p>
                <RatingControl
                  itemId={format.id}
                  summary={ratingSummaries.get(format.id)}
                  interactive
                  onRate={(rating) => onRate(format.id, rating)}
                />
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-xs text-stone-400">
                    Shared by {authorName(format.ownerId)}
                  </span>
                  <AddButton id={format.id} onClick={() => onAdd(format)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {mine.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">
            Your shared response formats
          </h2>
          <p className="mt-1 text-xs text-stone-500">
            For reference — manage these from your toolkit instead.
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {mine.map((format) => (
              <div
                key={format.id}
                className="flex flex-col rounded-2xl border border-dashed border-stone-200 bg-cream-50 p-4"
              >
                <p className="text-sm font-medium text-stone-700">{format.name}</p>
                <p className="mt-1 text-xs text-stone-400">
                  {formatTypeLabel(format.type)}
                </p>
                <RatingControl
                  itemId={format.id}
                  summary={ratingSummaries.get(format.id)}
                  interactive={false}
                  onRate={() => {}}
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MaterialsTab({
  materials,
  currentUserId,
  authorName,
  onAdd,
  AddButton,
  ratingSummaries,
  onRate,
  RatingControl,
}: {
  materials: CommonSharedMaterial[];
  currentUserId: string;
  authorName: (ownerId: string) => string;
  onAdd: (material: CommonSharedMaterial) => void;
  AddButton: AddButtonComponent;
  ratingSummaries: Map<string, RatingSummary>;
  onRate: (itemId: string, rating: number) => void;
  RatingControl: RatingControlComponent;
}) {
  const others = materials.filter((m) => m.ownerId !== currentUserId);
  const mine = materials.filter((m) => m.ownerId === currentUserId);

  return (
    <div className="mt-4 space-y-8">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">
          Browse &amp; add
        </h2>
        {others.length === 0 ? (
          <EmptyState label="No shared materials from other accounts yet." />
        ) : (
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {others.map((material) => (
              <div
                key={material.id}
                className="flex flex-col rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="w-fit rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
                  {material.categoryName}
                </span>
                <a
                  href={material.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex items-start gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline"
                >
                  <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {material.title}
                </a>
                {material.description && (
                  <p className="mt-1 text-sm text-stone-500">{material.description}</p>
                )}
                {material.linkedGoals.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {material.linkedGoals.map((goal) => (
                      <span
                        key={goal.id}
                        className="rounded-full bg-cream-50 px-2 py-0.5 text-xs text-stone-500"
                      >
                        {goal.text}
                      </span>
                    ))}
                  </div>
                )}
                <RatingControl
                  itemId={material.id}
                  summary={ratingSummaries.get(material.id)}
                  interactive
                  onRate={(rating) => onRate(material.id, rating)}
                />
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-xs text-stone-400">
                    Shared by {authorName(material.ownerId)}
                  </span>
                  <AddButton id={material.id} onClick={() => onAdd(material)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {mine.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">
            Your shared materials
          </h2>
          <p className="mt-1 text-xs text-stone-500">
            For reference — manage these from your materials bank instead.
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {mine.map((material) => (
              <div
                key={material.id}
                className="flex flex-col rounded-2xl border border-dashed border-stone-200 bg-cream-50 p-4"
              >
                <span className="w-fit rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
                  {material.categoryName}
                </span>
                <p className="mt-2 text-sm font-medium text-stone-700">
                  {material.title}
                </p>
                {material.description && (
                  <p className="mt-1 text-sm text-stone-500">{material.description}</p>
                )}
                {material.linkedGoals.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {material.linkedGoals.map((goal) => (
                      <span
                        key={goal.id}
                        className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500"
                      >
                        {goal.text}
                      </span>
                    ))}
                  </div>
                )}
                <RatingControl
                  itemId={material.id}
                  summary={ratingSummaries.get(material.id)}
                  interactive={false}
                  onRate={() => {}}
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
