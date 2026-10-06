"use client";

import { useMemo, useState } from "react";
import { Copy, FolderInput, Plus, Target, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ResponseFormatOption, ShareVisibility } from "@/lib/types";
import { matchesSearch } from "@/lib/search";
import type { GoalBankConfig } from "@/lib/goal-bank-config";
import {
  describeOtherCopies,
  extraCopyIds,
  findDuplicates,
  normalizeGoalText,
} from "@/lib/goal-duplicates";
import SearchInput from "@/components/search-input";
import BankGoalFormModal, { type BankGoalFormValues } from "./bank-goal-form-modal";
import GoalExcelImport, { type ImportedBankGoal } from "./goal-excel-import";
import {
  BulkDeleteConfirmModal,
  BulkMoveModal,
  type BulkDeleteImpact,
} from "./bank-goal-bulk-modals";

const VISIBILITY_LABELS: Record<ShareVisibility, string> = {
  private: "Private",
  shared: "Shared",
};

const VISIBILITY_CLASSES: Record<ShareVisibility, string> = {
  private: "bg-stone-100 text-stone-600",
  shared: "bg-accent-100 text-accent-700",
};

/** A goal-bank row (student_id is null), normalized across sides: the
 *  SLP's area_id/area and the Teacher's subject_id/subject are both
 *  selected under the aliases category_id/category (see bankGoalSelect).
 *  Bank goals are the only goals that can ever be "shared" — the DB
 *  enforces that (0024_community_sharing.sql). */
export type BankGoalRow = {
  id: string;
  category_id: string;
  text: string;
  response_format_id: string | null;
  target_percent: number | null;
  visibility: ShareVisibility;
  created_at: string;
  category: { id: string; name: string } | null;
  response_format: { id: string; name: string } | null;
};

export function bankGoalSelect(c: GoalBankConfig) {
  return `id, category_id:${c.categoryIdColumn}, text, response_format_id, target_percent, visibility, created_at, category:${c.categoryTable}(id, name), response_format:${c.formatsTable}(id, name)`;
}

/** Keeps `.in()` filters (which travel in the URL) to a safe length. */
function chunks<T>(list: T[], size = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

type Props = {
  config: GoalBankConfig;
  ownerId: string;
  initialGoals: BankGoalRow[];
  categories: { id: string; name: string }[];
  responseFormats: ResponseFormatOption[];
  /** Account-wide default format (already validated against
   *  responseFormats) — pre-fills new bank goals and Excel imports. */
  defaultFormatId: string | null;
};

/** The goal bank, shared by the SLP and Teacher toolkits: search, add/edit,
 *  Excel import, bulk select (all visible / per area / duplicates) with
 *  bulk delete and move, and possible-duplicate detection. */
export default function GoalBankSection({
  config,
  ownerId,
  initialGoals,
  categories,
  responseFormats,
  defaultFormatId,
}: Props) {
  const { categoryLabel } = config;
  const lower = categoryLabel.toLowerCase();
  const [goals, setGoals] = useState<BankGoalRow[]>(initialGoals);
  // Local copy so a newly-created category (from an Excel upload) shows up
  // in the headings, pickers and modals without a page reload.
  const [categoryList, setCategoryList] = useState(categories);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<BankGoalRow | null>(null);
  const [search, setSearch] = useState("");
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteTargets, setDeleteTargets] = useState<{ ids: string[]; impact: BulkDeleteImpact } | null>(null);
  const [showMove, setShowMove] = useState(false);
  const [openDupId, setOpenDupId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const duplicates = useMemo(
    () =>
      findDuplicates(
        goals.map((g) => ({
          id: g.id,
          text: g.text,
          created_at: g.created_at,
          categoryName: g.category?.name ?? "Uncategorized",
        }))
      ),
    [goals]
  );
  const flaggedCount = duplicates.othersById.size;

  // Filtered first (search, then duplicates-only), then grouped — so a
  // search matches across every area at once and an area with no
  // matches doesn't render its heading. "Select all" acts on exactly
  // this visible set.
  const visibleGoals = useMemo(
    () =>
      goals.filter(
        (g) =>
          matchesSearch(g.text, search) &&
          (!duplicatesOnly || duplicates.othersById.has(g.id))
      ),
    [goals, search, duplicatesOnly, duplicates]
  );

  const groups = useMemo(() => {
    const byCategory = new Map<string, BankGoalRow[]>();
    for (const goal of visibleGoals) {
      const key = goal.category?.name ?? "Uncategorized";
      (byCategory.get(key) ?? byCategory.set(key, []).get(key)!).push(goal);
    }
    return Array.from(byCategory.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [visibleGoals]);

  const hiddenSelected = [...selected].filter((id) => !visibleGoals.some((g) => g.id === id)).length;

  function setMany(ids: string[], on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allVisibleSelected = visibleGoals.length > 0 && visibleGoals.every((g) => selected.has(g.id));

  async function refetchGoal(id: string): Promise<BankGoalRow | null> {
    const { data } = await (createClient().from(config.goalsTable) as any)
      .select(bankGoalSelect(config))
      .eq("id", id)
      .maybeSingle();
    return data as BankGoalRow | null;
  }

  async function handleAdd(values: BankGoalFormValues) {
    const { data, error } = await (createClient().from(config.goalsTable) as any)
      .insert({
        [config.ownerColumn]: ownerId,
        student_id: null,
        [config.categoryIdColumn]: values.categoryId,
        text: values.text,
        response_format_id: values.responseFormatId,
        target_percent: values.targetPercent,
        visibility: values.visibility,
      })
      .select("id")
      .single();
    if (error || !data) return error?.message ?? "Something went wrong. Please try again.";
    const full = await refetchGoal(data.id);
    if (full) setGoals((prev) => [full, ...prev]);
    setShowAddModal(false);
    return null;
  }

  async function handleEdit(values: BankGoalFormValues) {
    if (!editingGoal) return null;
    const { error } = await (createClient().from(config.goalsTable) as any)
      .update({
        [config.categoryIdColumn]: values.categoryId,
        text: values.text,
        response_format_id: values.responseFormatId,
        target_percent: values.targetPercent,
        visibility: values.visibility,
      })
      .eq("id", editingGoal.id);
    if (error) return error.message;
    const full = await refetchGoal(editingGoal.id);
    if (full) setGoals((prev) => prev.map((g) => (g.id === full.id ? full : g)));
    setEditingGoal(null);
    return null;
  }

  /** Works out the side effects to show before deleting `ids`. */
  async function requestDelete(ids: string[]) {
    setActionError(null);
    setNotice(null);
    const supabase = createClient();
    const withMaterials = new Set<string>();
    let studentGoals = 0;
    for (const part of chunks(ids)) {
      const [links, students] = await Promise.all([
        (supabase.from(config.materialGoalsTable) as any).select("goal_id").in("goal_id", part),
        (supabase.from(config.goalsTable) as any)
          .select("id", { count: "exact", head: true })
          .eq(config.ownerColumn, ownerId)
          .in("source_bank_goal_id", part),
      ]);
      if (links.error || students.error) {
        setActionError((links.error ?? students.error).message);
        return;
      }
      for (const l of links.data ?? []) withMaterials.add(l.goal_id);
      studentGoals += students.count ?? 0;
    }
    const idSet = new Set(ids);
    setDeleteTargets({
      ids,
      impact: {
        total: ids.length,
        shared: goals.filter((g) => idSet.has(g.id) && g.visibility === "shared").length,
        withMaterials: withMaterials.size,
        studentGoals,
      },
    });
  }

  async function confirmDelete() {
    if (!deleteTargets) return null;
    const supabase = createClient();
    const deleted = new Set<string>();
    for (const part of chunks(deleteTargets.ids)) {
      const { data, error } = await (supabase.from(config.goalsTable) as any)
        .delete()
        .eq(config.ownerColumn, ownerId)
        .is("student_id", null)
        .in("id", part)
        .select("id");
      if (error) return error.message;
      for (const r of data ?? []) deleted.add(r.id);
    }
    setGoals((prev) => prev.filter((g) => !deleted.has(g.id)));
    setMany([...deleted], false);
    setDeleteTargets(null);
    setNotice(
      deleted.size === deleteTargets.ids.length
        ? `Deleted ${deleted.size} ${deleted.size === 1 ? "goal" : "goals"}.`
        : `Deleted ${deleted.size} of ${deleteTargets.ids.length} goals — the rest couldn't be deleted.`
    );
    return null;
  }

  function countDuplicatesIn(destId: string) {
    const destKeys = new Set(
      goals.filter((g) => g.category_id === destId && !selected.has(g.id)).map((g) => normalizeGoalText(g.text))
    );
    return goals.filter(
      (g) => selected.has(g.id) && g.category_id !== destId && destKeys.has(normalizeGoalText(g.text))
    ).length;
  }

  async function confirmMove(destId: string, skipDuplicates: boolean) {
    const destKeys = new Set(
      goals.filter((g) => g.category_id === destId && !selected.has(g.id)).map((g) => normalizeGoalText(g.text))
    );
    const candidates = goals.filter((g) => selected.has(g.id) && g.category_id !== destId);
    const toMove = skipDuplicates
      ? candidates.filter((g) => !destKeys.has(normalizeGoalText(g.text)))
      : candidates;
    const skipped = candidates.length - toMove.length;
    const dest = categoryList.find((c) => c.id === destId) ?? null;
    const moved = new Set<string>();
    const supabase = createClient();
    for (const part of chunks(toMove.map((g) => g.id))) {
      // Bank rows only (student_id null): goals already assigned to
      // students are separate rows and keep their own category.
      const { data, error } = await (supabase.from(config.goalsTable) as any)
        .update({ [config.categoryIdColumn]: destId })
        .eq(config.ownerColumn, ownerId)
        .is("student_id", null)
        .in("id", part)
        .select("id");
      if (error) return error.message;
      for (const r of data ?? []) moved.add(r.id);
    }
    setGoals((prev) =>
      prev.map((g) => (moved.has(g.id) ? { ...g, category_id: destId, category: dest } : g))
    );
    setSelected(new Set());
    setShowMove(false);
    setNotice(
      `Moved ${moved.size} ${moved.size === 1 ? "goal" : "goals"} to ${dest?.name ?? `the ${lower}`}` +
        (skipped > 0 ? `; skipped ${skipped} already there.` : ".")
    );
    return null;
  }

  function handleImported(newGoals: ImportedBankGoal[], newCategories: { id: string; name: string }[]) {
    if (newCategories.length > 0) setCategoryList((prev) => [...prev, ...newCategories]);
    if (newGoals.length > 0) setGoals((prev) => [...(newGoals as unknown as BankGoalRow[]), ...prev]);
  }

  const btn =
    "inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:bg-stone-50 disabled:opacity-50";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
          <Target className="h-5 w-5 text-brand-500" />
          Bank goals
        </h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md"
        >
          <Plus className="h-4 w-4" />
          Add to bank
        </button>
      </div>

      <div className="mt-3">
        <GoalExcelImport
          categoryLabel={categoryLabel}
          categories={categoryList}
          goalsTable={config.goalsTable}
          categoryTable={config.categoryTable}
          categoryIdColumn={config.categoryIdColumn}
          formatsTable={config.formatsTable}
          ownerColumn={config.ownerColumn}
          existingGoals={goals.map((g) => ({ text: g.text, categoryName: g.category?.name ?? "Uncategorized" }))}
          defaultFormat={responseFormats.find((f) => f.id === defaultFormatId) ?? null}
          onImported={handleImported}
        />
      </div>

      {notice && (
        <p className="mt-3 rounded-md bg-accent-50 px-3 py-2 text-sm text-accent-800" data-testid="bank-notice">
          {notice}
        </p>
      )}
      {actionError && <p className="mt-3 text-sm text-red-600">{actionError}</p>}

      {goals.length === 0 && (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
            <Target className="h-6 w-6 text-brand-500" />
          </div>
          <p className="text-stone-500">
            No bank goals yet — add one to start building your reusable goal bank.
          </p>
        </div>
      )}

      {goals.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-stone-200 bg-white">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={`Search all ${lower}s by goal text…`}
            variant="attached"
          />

          {/* Selection + duplicates toolbar */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-stone-100 px-4 py-2 text-sm">
            <label className="inline-flex items-center gap-2 font-medium text-stone-700">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                disabled={visibleGoals.length === 0}
                onChange={() => setMany(visibleGoals.map((g) => g.id), !allVisibleSelected)}
                aria-label="Select all visible goals"
                className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
              />
              Select all
              <span className="text-xs font-normal text-stone-400">({visibleGoals.length} shown)</span>
            </label>
            {flaggedCount > 0 && (
              <>
                <span className="text-xs font-medium text-amber-700" data-testid="duplicate-count">
                  {flaggedCount} possible {flaggedCount === 1 ? "duplicate" : "duplicates"}
                </span>
                <label className="inline-flex items-center gap-1.5 text-xs text-stone-600">
                  <input
                    type="checkbox"
                    checked={duplicatesOnly}
                    onChange={(e) => setDuplicatesOnly(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                  />
                  Show duplicates only
                </label>
                <button
                  type="button"
                  onClick={() => setSelected(new Set(extraCopyIds(duplicates)))}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Select duplicates
                </button>
              </>
            )}
          </div>

          {selected.size > 0 && (
            <div
              data-testid="bulk-bar"
              className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-brand-100 bg-brand-50 px-4 py-2 text-sm"
            >
              <span className="font-semibold text-brand-900" data-testid="selected-count">
                {selected.size} selected
              </span>
              {hiddenSelected > 0 && (
                <span className="text-xs text-brand-800">({hiddenSelected} hidden by filters)</span>
              )}
              <div className="ml-auto flex flex-wrap gap-2">
                <button type="button" className={btn} onClick={() => setShowMove(true)}>
                  <FolderInput className="h-4 w-4" />
                  Move to {lower}
                </button>
                <button
                  type="button"
                  className={`${btn} border-red-200 text-red-700 hover:bg-red-50`}
                  onClick={() => requestDelete([...selected])}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  aria-label="Clear selection"
                  className="rounded-lg p-1.5 text-brand-800 hover:bg-brand-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {groups.length === 0 && (
            <p className="p-4 text-sm text-stone-500">
              {duplicatesOnly && !search ? "No possible duplicates." : "No bank goals match your search."}
            </p>
          )}

          {groups.length > 0 && (
            <div className="space-y-6 p-4">
              {groups.map(([categoryName, categoryGoals]) => {
                const allInGroup = categoryGoals.every((g) => selected.has(g.id));
                return (
                  <div key={categoryName} data-testid="bank-group" data-category={categoryName}>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-400">
                        {categoryName}
                      </h3>
                      <label className="inline-flex items-center gap-1.5 text-xs text-stone-500">
                        <input
                          type="checkbox"
                          checked={allInGroup}
                          onChange={() => setMany(categoryGoals.map((g) => g.id), !allInGroup)}
                          aria-label={`Select all in ${categoryName}`}
                          className="h-3.5 w-3.5 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                        />
                        Select all in this {lower}
                      </label>
                    </div>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      {categoryGoals.map((goal) => {
                        const others = duplicates.othersById.get(goal.id);
                        const isSelected = selected.has(goal.id);
                        return (
                          <div
                            key={goal.id}
                            data-testid="bank-goal"
                            data-goal-text={goal.text}
                            className={`flex flex-col rounded-2xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${
                              isSelected ? "border-brand-400 ring-1 ring-brand-300" : "border-stone-200"
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleOne(goal.id)}
                                aria-label={`Select goal: ${goal.text}`}
                                className="mt-0.5 h-4 w-4 shrink-0 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                              />
                              <p className="flex-1 text-sm text-stone-900">{goal.text}</p>
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${VISIBILITY_CLASSES[goal.visibility]}`}
                              >
                                {VISIBILITY_LABELS[goal.visibility]}
                              </span>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 pl-6 text-xs text-stone-500">
                              {others && (
                                <button
                                  type="button"
                                  data-testid="duplicate-chip"
                                  title={describeOtherCopies(others)}
                                  onClick={() => setOpenDupId((cur) => (cur === goal.id ? null : goal.id))}
                                  className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800"
                                >
                                  Possible duplicate
                                </button>
                              )}
                              {goal.response_format && <span>{goal.response_format.name}</span>}
                              {goal.target_percent !== null && <span>Target: {goal.target_percent}%</span>}
                            </div>
                            {others && openDupId === goal.id && (
                              <p className="mt-1 pl-6 text-xs text-amber-800" data-testid="duplicate-detail">
                                {describeOtherCopies(others)}
                              </p>
                            )}

                            <div className="mt-3 flex justify-end gap-1">
                              <button
                                onClick={() => setEditingGoal(goal)}
                                className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => requestDelete([goal.id])}
                                className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showAddModal && (
        <BankGoalFormModal
          mode="add"
          categoryLabel={categoryLabel}
          categories={categoryList}
          responseFormats={responseFormats}
          defaultFormatId={defaultFormatId}
          onCancel={() => setShowAddModal(false)}
          onSubmit={handleAdd}
        />
      )}

      {editingGoal && (
        <BankGoalFormModal
          mode="edit"
          categoryLabel={categoryLabel}
          categories={categoryList}
          responseFormats={responseFormats}
          defaultFormatId={defaultFormatId}
          initialGoal={editingGoal}
          onCancel={() => setEditingGoal(null)}
          onSubmit={handleEdit}
        />
      )}

      {deleteTargets && (
        <BulkDeleteConfirmModal
          impact={deleteTargets.impact}
          onCancel={() => setDeleteTargets(null)}
          onConfirm={confirmDelete}
        />
      )}

      {showMove && (
        <BulkMoveModal
          categoryLabel={categoryLabel}
          categories={categoryList}
          selectedCount={selected.size}
          countDuplicatesIn={countDuplicatesIn}
          onCancel={() => setShowMove(false)}
          onMove={confirmMove}
        />
      )}
    </div>
  );
}
