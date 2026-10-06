"use client";

import { useState } from "react";
import { FolderInput, Trash2 } from "lucide-react";

export type BulkDeleteImpact = {
  total: number;
  /** Selected goals currently shared to the Community page. */
  shared: number;
  /** Selected goals that have at least one material linked. */
  withMaterials: number;
  /** Student goals created from these bank goals (left untouched). */
  studentGoals: number;
};

/** Bulk (or single) bank-goal delete confirmation, spelling out every side
 *  effect: shared goals leave the Community page (copies people already
 *  made are separate goals and stay), material links are removed but the
 *  materials stay, and student goals created from them are not touched —
 *  their source_bank_goal_id link just becomes empty (ON DELETE SET NULL,
 *  0018_bank_goal_materials.sql). */
export function BulkDeleteConfirmModal({
  impact,
  onCancel,
  onConfirm,
}: {
  impact: BulkDeleteImpact;
  onCancel: () => void;
  onConfirm: () => Promise<string | null>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    const result = await onConfirm();
    setLoading(false);
    if (result) setError(result);
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/50">
      <div className="flex min-h-full items-center justify-center px-4 py-8">
        <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
          <h2 className="flex items-center gap-2 text-lg font-bold text-stone-900">
            <Trash2 className="h-5 w-5 text-red-500" />
            {impact.total === 1 ? "Delete bank goal" : `Delete ${impact.total} bank goals`}
          </h2>
          <p className="mt-2 text-sm text-stone-600" data-testid="bulk-delete-summary">
            {impact.total === 1
              ? "This bank goal will be deleted."
              : `${impact.total} bank goals will be deleted.`}{" "}
            This action cannot be undone.
          </p>
          <ul className="mt-3 space-y-1.5 rounded-md bg-cream-50 p-3 text-sm text-stone-700" data-testid="bulk-delete-impact">
            {impact.shared > 0 && (
              <li data-testid="impact-shared">
                {impact.total === 1
                  ? "This goal is shared and will disappear from the Community page"
                  : `${impact.shared} of these ${plural(impact.shared, "is", "are")} shared and will disappear from the Community page`}
                ; people who already copied {plural(impact.shared, "it", "them")} keep their copies.
              </li>
            )}
            {impact.withMaterials > 0 && (
              <li data-testid="impact-materials">
                {impact.total === 1
                  ? "This goal has materials linked"
                  : `${impact.withMaterials} of these ${plural(impact.withMaterials, "has", "have")} materials linked`}
                . The materials stay in your library; only the link to {plural(impact.withMaterials, "this goal", "these goals")} is removed.
              </li>
            )}
            <li data-testid="impact-students">
              {impact.studentGoals > 0
                ? `${impact.studentGoals} student ${plural(impact.studentGoals, "goal was", "goals were")} created from ${plural(impact.total, "this goal", "these")}. ${plural(impact.studentGoals, "It stays", "They stay")} exactly as ${plural(impact.studentGoals, "it is", "they are")}.`
                : "Goals already assigned to students are never changed by deleting bank goals."}
            </li>
          </ul>

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

          <div className="mt-6 flex justify-end gap-2">
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
              onClick={handleConfirm}
              disabled={loading}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-red-700 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {loading ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** "Move to area/subject": pick a destination, then — if it already has
 *  goals with the same (normalized) text as some selected ones — choose
 *  "Skip those" or "Move all anyway". */
export function BulkMoveModal({
  categoryLabel,
  categories,
  selectedCount,
  countDuplicatesIn,
  onCancel,
  onMove,
}: {
  categoryLabel: "Area" | "Subject";
  categories: { id: string; name: string }[];
  selectedCount: number;
  /** How many selected goals already have a same-text goal in `destId`. */
  countDuplicatesIn: (destId: string) => number;
  onCancel: () => void;
  onMove: (destId: string, skipDuplicates: boolean) => Promise<string | null>;
}) {
  const lower = categoryLabel.toLowerCase();
  const [destId, setDestId] = useState(categories[0]?.id ?? "");
  const [dupCount, setDupCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const destName = categories.find((c) => c.id === destId)?.name ?? "";

  async function run(skipDuplicates: boolean) {
    setLoading(true);
    setError(null);
    const result = await onMove(destId, skipDuplicates);
    setLoading(false);
    if (result) setError(result);
  }

  function handleContinue() {
    if (!destId) return;
    const n = countDuplicatesIn(destId);
    if (n > 0) setDupCount(n);
    else run(false);
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/50">
      <div className="flex min-h-full items-center justify-center px-4 py-8">
        <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
          <h2 className="flex items-center gap-2 text-lg font-bold text-stone-900">
            <FolderInput className="h-5 w-5 text-brand-500" />
            Move to {lower}
          </h2>

          {dupCount === null ? (
            <>
              <p className="mt-2 text-sm text-stone-600">
                Move {selectedCount} {selectedCount === 1 ? "goal" : "goals"} to another {lower}.
                Goals already assigned to students keep their own {lower}.
              </p>
              <label htmlFor="bulk-move-dest" className="mt-4 block text-sm font-medium text-stone-700">
                {categoryLabel}
              </label>
              <select
                id="bulk-move-dest"
                value={destId}
                onChange={(e) => setDestId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <p className="mt-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900" data-testid="bulk-move-duplicates">
              {dupCount} of the selected {dupCount === 1 ? "goal has" : "goals have"} the same text as a goal
              already in {destName}.
            </p>
          )}

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50 disabled:opacity-50"
            >
              Cancel
            </button>
            {dupCount === null ? (
              <button
                type="button"
                onClick={handleContinue}
                disabled={loading || !destId}
                className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 disabled:opacity-50"
              >
                {loading ? "Moving…" : "Move"}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => run(true)}
                  disabled={loading}
                  className="rounded-lg border border-brand-300 bg-white px-4 py-2 text-sm font-semibold text-brand-800 shadow-sm hover:bg-brand-50 disabled:opacity-50"
                >
                  Skip those
                </button>
                <button
                  type="button"
                  onClick={() => run(false)}
                  disabled={loading}
                  className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 disabled:opacity-50"
                >
                  Move all anyway
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
