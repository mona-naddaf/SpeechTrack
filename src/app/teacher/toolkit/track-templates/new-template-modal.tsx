"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TeacherSubject, TeacherTrackTemplateWithSubject } from "@/lib/types";

type Props = {
  subjects: TeacherSubject[];
  onCancel: () => void;
  onCreated: (created: TeacherTrackTemplateWithSubject) => void;
};

/** PATH B of Track Templates: build one from scratch, with no student
 *  attached — just a name and a subject to start. Steps get added on the
 *  editor page right after this. */
export default function NewTemplateModal({ subjects, onCancel, onCreated }: Props) {
  const [name, setName] = useState("");
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please name this template.");
      return;
    }
    if (!subjectId) {
      setError("Please choose a subject.");
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      setError("You need to be signed in.");
      return;
    }

    const { data, error: insertError } = await supabase
      .from("teacher_track_templates")
      .insert({
        teacher_id: user.id,
        name: trimmedName,
        subject_id: subjectId,
      })
      .select("id, teacher_id, name, subject_id, created_at, subject:teacher_subjects(id, name)")
      .single();

    setLoading(false);

    if (insertError || !data) {
      setError(insertError?.message ?? "Something went wrong. Please try again.");
      return;
    }

    onCreated(data as unknown as TeacherTrackTemplateWithSubject);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-stone-900/50 px-4 py-8">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-stone-900">New template</h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="template-name"
              className="block text-sm font-medium text-stone-700"
            >
              Name
            </label>
            <input
              id="template-name"
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sight words: level 1 to 3"
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div>
            <label
              htmlFor="template-subject"
              className="block text-sm font-medium text-stone-700"
            >
              Subject
            </label>
            <select
              id="template-subject"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {subjects.length === 0 && <option value="">No subjects yet</option>}
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-stone-50 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {loading ? "Creating…" : "Create template"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
