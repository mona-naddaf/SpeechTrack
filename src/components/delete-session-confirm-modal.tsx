"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/date";
import type { SessionRecord } from "@/lib/types";

type Props = {
  session: SessionRecord;
  trialsTable: "trials" | "teacher_trials";
  onCancel: () => void;
  onConfirm: () => Promise<string | null>;
};

/** Confirms deleting a whole session — same visual pattern as
 *  DeleteGoalConfirmModal — and says up front how many trials go with
 *  it (trials/teacher_trials cascade on session delete, see 0003/0009). */
export default function DeleteSessionConfirmModal({
  session,
  trialsTable,
  onCancel,
  onConfirm,
}: Props) {
  const [trialCount, setTrialCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .from(trialsTable)
      .select("id", { count: "exact", head: true })
      .eq("session_id", session.id)
      .then(({ count, error }) => {
        if (cancelled) return;
        if (error) setError(`Couldn't count trials: ${error.message}`);
        else setTrialCount(count ?? 0);
      });
    return () => {
      cancelled = true;
    };
  }, [session.id, trialsTable]);

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
            Delete session
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            Are you sure you want to delete the session from{" "}
            <span className="font-medium text-stone-900">
              {formatDate(session.date)}
            </span>
            ? This action cannot be undone.
          </p>
          <p
            data-testid="delete-session-trial-count"
            className="mt-2 rounded-md bg-cream-50 p-3 text-sm text-stone-700"
          >
            {trialCount === null
              ? "Counting trials…"
              : trialCount === 0
                ? "No trials were logged in this session."
                : `${trialCount} ${trialCount === 1 ? "trial" : "trials"} will also be deleted.`}
          </p>

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
              disabled={loading || trialCount === null}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-red-700 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {loading ? "Deleting…" : "Delete session"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
