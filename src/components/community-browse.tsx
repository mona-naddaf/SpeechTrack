"use client";

import { useMemo, useState, type ReactElement } from "react";
import { Check, ExternalLink, Library, Plus, Sliders, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ResponseFormatType } from "@/lib/types";
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
        />
      )}
      {tab === "formats" && (
        <FormatsTab
          formats={filteredFormats}
          currentUserId={currentUserId}
          authorName={authorName}
          onAdd={handleAddFormat}
          AddButton={AddButton}
        />
      )}
      {tab === "materials" && (
        <MaterialsTab
          materials={filteredMaterials}
          currentUserId={currentUserId}
          authorName={authorName}
          onAdd={handleAddMaterial}
          AddButton={AddButton}
        />
      )}
    </div>
  );
}

type AddButtonComponent = (props: { id: string; onClick: () => void }) => ReactElement;

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
}: {
  goals: CommonSharedGoal[];
  currentUserId: string;
  authorName: (ownerId: string) => string;
  onAdd: (goal: CommonSharedGoal) => void;
  AddButton: AddButtonComponent;
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
}: {
  formats: CommonSharedFormat[];
  currentUserId: string;
  authorName: (ownerId: string) => string;
  onAdd: (format: CommonSharedFormat) => void;
  AddButton: AddButtonComponent;
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
}: {
  materials: CommonSharedMaterial[];
  currentUserId: string;
  authorName: (ownerId: string) => string;
  onAdd: (material: CommonSharedMaterial) => void;
  AddButton: AddButtonComponent;
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
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
