"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

type Props = {
  totalSessions: number;
  manualEntryCount: number;
  onCancel: () => void;
  onConfirm: () => Promise<string | null>;
};

/** Confirms cancelling the current package — same visual pattern as
 *  DeleteGoalConfirmModal. Spells out that the package's manual entries
 *  go with it, while logged sessions and absences are left alone. */
export default function CancelPackageConfirmModal({
  totalSessions,
  manualEntryCount,
  onCancel,
  onConfirm,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    const result = await onConfirm();
    setLoading(false);
    if (result) {
      setError(result);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/50">
      <div className="flex min-h-full items-center justify-center px-4 py-8">
        <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
          <h2 className="flex items-center gap-2 text-lg font-bold text-stone-900">
            <Trash2 className="h-5 w-5 text-red-500" />
            Cancel package
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            Are you sure you want to cancel this {totalSessions}-session
            package? This action cannot be undone.
          </p>
          <p
            data-testid="cancel-package-manual-count"
            className="mt-2 rounded-md bg-cream-50 p-3 text-sm text-stone-700"
          >
            {manualEntryCount === 0
              ? "No manual entries will be deleted."
              : `${manualEntryCount} manual ${
                  manualEntryCount === 1 ? "entry" : "entries"
                } will be deleted.`}
          </p>
          <p className="mt-2 text-xs text-stone-500">
            Logged sessions and absences are never deleted — they just stop
            counting toward a package.
          </p>

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-stone-50 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
            >
              Keep package
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-red-700 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {loading ? "Cancelling…" : "Cancel package"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
