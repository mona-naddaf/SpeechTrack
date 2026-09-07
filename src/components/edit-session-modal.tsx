"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SessionRecord } from "@/lib/types";
import { formatDate } from "@/lib/date";

type Props = {
  session: SessionRecord;
  /** "sessions" for the SLP side, "teacher_sessions" for Teacher — the
   *  two tables have the identical shape this modal edits. */
  sessionsTable: "sessions" | "teacher_sessions";
  onCancel: () => void;
  onSaved: (updated: SessionRecord) => void;
};

/** Edits just a past session's note + parent-sharing toggle — not the
 *  trial data logged that day. Opened from SessionsSection's per-row
 *  "Edit" button; deliberately small and fast, same spirit as the other
 *  small field-editor modals in the app (e.g. DeleteGoalConfirmModal),
 *  rather than reopening the full session-logging flow. */
export default function EditSessionModal({
  session,
  sessionsTable,
  onCancel,
  onSaved,
}: Props) {
  const [note, setNote] = useState(session.note ?? "");
  const [visibleToParent, setVisibleToParent] = useState(session.visible_to_parent);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error } = await supabase
      .from(sessionsTable)
      .update({
        note: note.trim() || null,
        visible_to_parent: visibleToParent,
      })
      .eq("id", session.id)
      .select("id, student_id, date, note, visible_to_parent, created_at")
      .single();

    setLoading(false);

    if (error || !data) {
      setError(error?.message ?? "Something went wrong. Please try again.");
      return;
    }

    onSaved(data);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-stone-900/50 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-stone-900">Edit session note</h2>
        <p className="mt-1 text-sm text-stone-500">{formatDate(session.date)}</p>

        <div className="mt-4">
          <label
            htmlFor="edit-session-note"
            className="block text-sm font-medium text-stone-700"
          >
            Session note
          </label>
          <textarea
            id="edit-session-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="What happened in this session?"
          />
          <label className="mt-2 flex items-center gap-2 text-xs font-medium text-stone-500">
            <input
              type="checkbox"
              checked={visibleToParent}
              onChange={(e) => setVisibleToParent(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
            />
            Share this note with parent
          </label>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

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
            onClick={handleSave}
            disabled={loading}
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {loading ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
