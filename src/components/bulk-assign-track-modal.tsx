"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { matchesSearch } from "@/lib/search";
import SearchInput from "@/components/search-input";

type CategoryOption = { id: string; name: string };

/** A goal-bank row normalized to a side-agnostic shape — the caller maps
 *  its area_id/subject_id into `categoryId` before passing this down, the
 *  same way GoalExcelImport's `categories` prop already works across both
 *  sides because Area/TeacherSubject share a shape. */
export type BulkAssignBankGoal = {
  id: string;
  categoryId: string;
  text: string;
  response_format_id: string | null;
  target_percent: number | null;
};

export type BulkAssignTrackOption = { id: string; name: string };

type SelectedItem = {
  bankGoalId: string;
  /** Whether this pick is grouped into the track being built in this
   *  modal, or left standalone (behaves exactly like today: active
   *  immediately, no track_id/step_order). */
  inTrack: boolean;
  /** Order relative to the other track-bound picks in this batch —
   *  1-based, doesn't need to be contiguous. */
  order: number;
};

type Props = {
  studentId: string;
  categoryLabel: "Area" | "Subject";
  categories: CategoryOption[];
  bankGoals: BulkAssignBankGoal[];
  existingTracks: BulkAssignTrackOption[];
  goalsTable: "goals" | "teacher_goals";
  tracksTable: "goal_tracks" | "teacher_goal_tracks";
  categoryTable: "areas" | "teacher_subjects";
  responseFormatTable: "response_formats" | "teacher_response_formats";
  categoryIdColumn: "area_id" | "subject_id";
  ownerColumn: "slp_id" | "teacher_id";
  onCancel: () => void;
  /** `insertedGoals` come back already joined the same way the rest of
   *  each side's goals-section queries for display (category, response
   *  format, track). `newTrack` is set only when "Create a new track"
   *  was used, so the caller can add it to its own track list too. */
  onDone: (result: {
    insertedGoals: Record<string, unknown>[];
    newTrack: BulkAssignTrackOption | null;
  }) => void;
};

type TrackChoice = "new" | string; // "new" or an existing track id

/** Bulk-assign flow: pick multiple bank goals at once for a student, and
 *  optionally group some of them (not necessarily all) into a new or
 *  existing track with a step order. Picks left out of the track stay
 *  exactly as a single "Set a goal -> from bank" pick behaves today:
 *  status 'active', no track_id/step_order.
 *
 *  Grouping rule for status: a brand-new track's lowest step_order among
 *  this batch starts 'active' (something has to be the current step);
 *  every other track-bound pick — including anything appended to an
 *  *existing* track — starts 'queued', since either a step ahead of it
 *  already exists or the track already has its own current step. She can
 *  always manually flip a queued step to active (the override in
 *  goal-form-modal.tsx) if a track needs a different starting point. */
export default function BulkAssignTrackModal({
  studentId,
  categoryLabel,
  categories,
  bankGoals,
  existingTracks,
  goalsTable,
  tracksTable,
  categoryTable,
  responseFormatTable,
  categoryIdColumn,
  ownerColumn,
  onCancel,
  onDone,
}: Props) {
  const [selected, setSelected] = useState<Map<string, SelectedItem>>(new Map());
  const [trackChoice, setTrackChoice] = useState<TrackChoice>(
    existingTracks.length > 0 ? existingTracks[0].id : "new"
  );
  const [newTrackName, setNewTrackName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Filtered first, then grouped — a search matches across every
  // area/subject at once instead of needing one picked first. Anything
  // already checked stays checked/selected even while it's filtered out
  // of view (the "Selected" list below always reflects `selected`
  // directly, not this filtered/grouped view).
  const filteredBankGoals = useMemo(
    () => bankGoals.filter((g) => matchesSearch(g.text, search)),
    [bankGoals, search]
  );

  const groups = useMemo(() => {
    const byCategory = new Map<string, BulkAssignBankGoal[]>();
    for (const g of filteredBankGoals) {
      const list = byCategory.get(g.categoryId) ?? [];
      list.push(g);
      byCategory.set(g.categoryId, list);
    }
    return categories
      .map((c) => ({ category: c, goals: byCategory.get(c.id) ?? [] }))
      .filter((g) => g.goals.length > 0);
  }, [filteredBankGoals, categories]);

  const selectedInTrack = Array.from(selected.values())
    .filter((s) => s.inTrack)
    .sort((a, b) => a.order - b.order);

  function toggleSelected(bankGoalId: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (checked) {
        next.set(bankGoalId, { bankGoalId, inTrack: false, order: next.size + 1 });
      } else {
        next.delete(bankGoalId);
      }
      return next;
    });
  }

  function toggleInTrack(bankGoalId: string, inTrack: boolean) {
    setSelected((prev) => {
      const next = new Map(prev);
      const item = next.get(bankGoalId);
      if (item) next.set(bankGoalId, { ...item, inTrack });
      return next;
    });
  }

  function setOrder(bankGoalId: string, order: number) {
    setSelected((prev) => {
      const next = new Map(prev);
      const item = next.get(bankGoalId);
      if (item) next.set(bankGoalId, { ...item, order });
      return next;
    });
  }

  async function handleSubmit() {
    if (selected.size === 0) {
      setError("Pick at least one goal from the bank.");
      return;
    }
    if (selectedInTrack.length > 0 && trackChoice === "new" && !newTrackName.trim()) {
      setError("Name the new track, or switch an item back to standalone.");
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You need to be signed in.");
      setLoading(false);
      return;
    }

    let trackId: string | null = null;
    let newTrack: BulkAssignTrackOption | null = null;
    let stepOffset = 0;

    if (selectedInTrack.length > 0) {
      if (trackChoice === "new") {
        const { data, error: trackError } = await supabase
          .from(tracksTable)
          .insert({
            [ownerColumn]: user.id,
            student_id: studentId,
            name: newTrackName.trim(),
          })
          .select("id, name")
          .single();
        if (trackError || !data) {
          setError(trackError?.message ?? "Couldn't create the track.");
          setLoading(false);
          return;
        }
        const created = data as unknown as { id: string; name: string };
        trackId = created.id;
        newTrack = { id: created.id, name: created.name };
      } else {
        trackId = trackChoice;
        // Appending after whatever the existing track already has, so a
        // second bulk-assign into the same track doesn't collide step
        // numbers with the first.
        const { data: existingSteps } = await (supabase.from(goalsTable) as any)
          .select("step_order")
          .eq("track_id", trackId)
          .order("step_order", { ascending: false })
          .limit(1);
        stepOffset = existingSteps?.[0]?.step_order ?? 0;
      }
    }

    const bankGoalById = new Map(bankGoals.map((g) => [g.id, g]));
    const isNewTrack = trackChoice === "new";
    const lowestTrackOrder =
      selectedInTrack.length > 0 ? Math.min(...selectedInTrack.map((s) => s.order)) : null;

    const insertRows: Record<string, unknown>[] = [];
    for (const item of selected.values()) {
      const bankGoal = bankGoalById.get(item.bankGoalId);
      if (!bankGoal) continue;

      const inTrack = item.inTrack && trackId !== null;
      const stepOrder = inTrack ? stepOffset + item.order : null;
      // Only a brand-new track gets an immediately-active first step —
      // appending to an existing track always queues (that track already
      // has its own current step underway).
      const status = inTrack
        ? isNewTrack && item.order === lowestTrackOrder
          ? "active"
          : "queued"
        : "active";

      insertRows.push({
        [ownerColumn]: user.id,
        student_id: studentId,
        [categoryIdColumn]: bankGoal.categoryId,
        text: bankGoal.text,
        response_format_id: bankGoal.response_format_id,
        target_percent: bankGoal.target_percent,
        status,
        track_id: inTrack ? trackId : null,
        step_order: stepOrder,
        source_bank_goal_id: bankGoal.id,
      });
    }

    const categoryAlias = categoryLabel.toLowerCase();
    const { data: inserted, error: insertError } = await (supabase.from(goalsTable) as any)
      .insert(insertRows)
      .select(
        `id, student_id, ${categoryIdColumn}, text, response_format_id, baseline, target_percent, status, source_bank_goal_id, track_id, step_order, visible_to_parent, created_at, ${categoryAlias}:${categoryTable}(id, name), response_format:${responseFormatTable}(id, name), track:${tracksTable}(id, name)`
      );

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    onDone({ insertedGoals: (inserted ?? []) as Record<string, unknown>[], newTrack });
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/50">
      <div className="flex min-h-full items-center justify-center px-4 py-8">
        <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
          <h2 className="text-lg font-bold text-stone-900">
            Assign multiple goals from the bank
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Pick as many as you need. Any of them can optionally be grouped
            into a sequenced track — the rest start active right away, same
            as picking one at a time.
          </p>

          {/* Search box + its live-filtered results merged into one
              bordered, scrollable block — matches update directly beneath
              the box as she types, no separate step to reveal them. */}
          <div className="mt-4 max-h-72 overflow-y-auto rounded-lg border border-stone-200">
            {bankGoals.length > 0 && (
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search the bank by goal text…"
                variant="attached"
                className="sticky top-0 z-10 bg-white"
              />
            )}
            <div className="p-3">
            {groups.length === 0 && (
              <p className="text-sm text-stone-500">
                {bankGoals.length === 0
                  ? "No goals in the bank yet."
                  : "No bank goals match your search."}
              </p>
            )}
            {groups.map(({ category, goals }) => (
              <div key={category.id} className="mb-3 last:mb-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                  {category.name}
                </p>
                <div className="mt-1 space-y-1">
                  {goals.map((g) => (
                    <label key={g.id} className="flex items-center gap-2 text-sm text-stone-700">
                      <input
                        type="checkbox"
                        checked={selected.has(g.id)}
                        onChange={(e) => toggleSelected(g.id, e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                      />
                      {g.text}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            </div>
          </div>

          {selected.size > 0 && (
            <div className="mt-4 rounded-lg border border-stone-200 p-3">
              <p className="text-sm font-medium text-stone-700">
                Selected ({selected.size})
              </p>
              <div className="mt-2 space-y-2">
                {Array.from(selected.values()).map((item) => {
                  const bankGoal = bankGoals.find((g) => g.id === item.bankGoalId);
                  if (!bankGoal) return null;
                  return (
                    <div
                      key={item.bankGoalId}
                      className="flex flex-wrap items-center gap-2 text-sm"
                    >
                      <span className="flex-1 text-stone-700">{bankGoal.text}</span>
                      <label className="flex items-center gap-1.5 text-xs text-stone-500">
                        <input
                          type="checkbox"
                          checked={item.inTrack}
                          onChange={(e) => toggleInTrack(item.bankGoalId, e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                        />
                        Part of a track
                      </label>
                      {item.inTrack && (
                        <label className="flex items-center gap-1 text-xs text-stone-500">
                          Step
                          <input
                            type="number"
                            min={1}
                            value={item.order}
                            onChange={(e) =>
                              setOrder(item.bankGoalId, Number(e.target.value) || 1)
                            }
                            className="w-14 rounded border border-stone-300 px-1.5 py-0.5"
                          />
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>

              {selectedInTrack.length > 0 && (
                <div className="mt-3 border-t border-stone-100 pt-3">
                  <p className="text-xs font-medium text-stone-600">Track</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <select
                      value={trackChoice}
                      onChange={(e) => setTrackChoice(e.target.value)}
                      className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    >
                      <option value="new">Create a new track…</option>
                      {existingTracks.map((t) => (
                        <option key={t.id} value={t.id}>
                          Add to &quot;{t.name}&quot;
                        </option>
                      ))}
                    </select>
                    {trackChoice === "new" && (
                      <input
                        type="text"
                        value={newTrackName}
                        onChange={(e) => setNewTrackName(e.target.value)}
                        placeholder="Track name, e.g. /l/ sound"
                        className="flex-1 rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    )}
                  </div>
                  <p className="mt-1 text-xs text-stone-400">
                    {trackChoice === "new"
                      ? "The lowest step number starts active; the rest wait their turn."
                      : "These will be appended after the track's current steps, queued until their turn."}
                  </p>
                </div>
              )}
            </div>
          )}

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-stone-50 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || selected.size === 0}
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {loading ? "Assigning…" : `Assign ${selected.size || ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
