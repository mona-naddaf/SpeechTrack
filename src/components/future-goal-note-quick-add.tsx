"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  notesTable: "future_goal_notes" | "teacher_future_goal_notes";
  ownerColumn: "slp_id" | "teacher_id";
  studentId: string;
};

/** A "jot this down for later" note, tied to a student but with none of a
 *  real goal's structure — meant for a quick idea mid-session ("work on
 *  /r/ blends next") that would otherwise be forgotten. Shows up as a
 *  reminder at the top of this student's next session
 *  (FutureGoalNotesBanner) until promoted into a real goal or dismissed
 *  from the student page's "Future goals" area. */
export default function FutureGoalNoteQuickAdd({
  notesTable,
  ownerColumn,
  studentId,
}: Props) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;

    setSaving(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You need to be signed in.");
      setSaving(false);
      return;
    }

    const { error: insertError } = await supabase.from(notesTable).insert({
      [ownerColumn]: user.id,
      student_id: studentId,
      text: text.trim(),
    });

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    setText("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md p-4">
      <label
        htmlFor="future-goal-idea"
        className="block text-sm font-medium text-stone-700"
      >
        Future goal idea <span className="text-stone-400">(optional)</span>
      </label>
      <form onSubmit={handleSubmit} className="mt-1 flex gap-2">
        <input
          id="future-goal-idea"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Work on /r/ blends next"
          className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <button
          type="submit"
          disabled={saving || !text.trim()}
          className="shrink-0 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-stone-50 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
      {saved && (
        <p className="mt-1.5 text-xs text-green-600">Saved for next time.</p>
      )}
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}
