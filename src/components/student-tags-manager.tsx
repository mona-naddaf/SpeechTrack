"use client";

import { useState } from "react";
import { Plus, Tags, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { StudentTag } from "@/lib/types";
import { COLOR_OPTIONS, getColorOption } from "@/lib/colors";

type Props = {
  ownerId: string;
  ownerField: "slp_id" | "teacher_id";
  tagsTable: "student_tags" | "teacher_student_tags";
  tagLinksTable: "student_tag_links" | "teacher_student_tag_links";
  initialTags: StudentTag[];
};

function sortByName(list: StudentTag[]) {
  return [...list].sort((a, b) => a.name.localeCompare(b.name));
}

/** Toolkit → Student tags, shared by the SLP and Teacher sides: add,
 *  rename, recolor, delete — same interaction pattern as behavior types.
 *  Deleting a tag removes it from every student (the link table's FK
 *  cascades), so the confirmation says how many students have it. */
export default function StudentTagsManager({
  ownerId,
  ownerField,
  tagsTable,
  tagLinksTable,
  initialTags,
}: Props) {
  const [tags, setTags] = useState<StudentTag[]>(initialTags);
  const [form, setForm] = useState<{ mode: "add" } | { mode: "edit"; tag: StudentTag } | null>(null);
  const [deleting, setDeleting] = useState<{ tag: StudentTag; studentCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(values: { name: string; color: string }) {
    const supabase = createClient();
    if (form?.mode === "edit") {
      const { data, error } = await supabase
        .from(tagsTable)
        .update(values)
        .eq("id", form.tag.id)
        .select("id, name, color")
        .single();
      if (error || !data) return error?.message ?? "Something went wrong. Please try again.";
      setTags((prev) => sortByName(prev.map((t) => (t.id === data.id ? data : t))));
    } else {
      const { data, error } = await supabase
        .from(tagsTable)
        .insert({ [ownerField]: ownerId, ...values })
        .select("id, name, color")
        .single();
      if (error || !data) return error?.message ?? "Something went wrong. Please try again.";
      setTags((prev) => sortByName([...prev, data]));
    }
    setForm(null);
    return null;
  }

  async function handleDeleteRequest(tag: StudentTag) {
    setError(null);
    const { count, error } = await createClient()
      .from(tagLinksTable)
      .select("student_id", { count: "exact", head: true })
      .eq("tag_id", tag.id);
    if (error) {
      setError(error.message);
      return;
    }
    setDeleting({ tag, studentCount: count ?? 0 });
  }

  async function handleDeleteConfirm() {
    if (!deleting) return null;
    const { data, error } = await createClient()
      .from(tagsTable)
      .delete()
      .eq("id", deleting.tag.id)
      .select("id");
    if (error) return error.message;
    if (!data || data.length === 0) return "Couldn't delete this tag.";
    setTags((prev) => prev.filter((t) => t.id !== deleting.tag.id));
    setDeleting(null);
    return null;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
          <Tags className="h-5 w-5 text-brand-500" />
          Student tags
        </h2>
        <button
          onClick={() => setForm({ mode: "add" })}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md"
        >
          <Plus className="h-4 w-4" />
          Add tag
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {tags.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
            <Tags className="h-6 w-6 text-brand-500" />
          </div>
          <p className="text-stone-500">
            No tags yet — add one (e.g. &ldquo;Mainstream&rdquo;, &ldquo;Paid&rdquo;) to group your students.
          </p>
        </div>
      ) : (
        <ul className="mt-4 flex flex-wrap gap-2" data-testid="student-tags-list">
          {tags.map((tag) => {
            const color = getColorOption(tag.color);
            return (
              <li
                key={tag.id}
                data-tag-name={tag.name}
                className="flex items-center gap-1 rounded-full border border-stone-200 bg-white py-1 pl-1 pr-1 shadow-sm"
              >
                <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium ${color.badgeClass}`}>
                  <span className={`h-2 w-2 rounded-full ${color.swatchClass}`} />
                  {tag.name}
                </span>
                <button
                  onClick={() => setForm({ mode: "edit", tag })}
                  className="rounded-full px-2 py-1 text-xs font-medium text-stone-500 transition-colors hover:bg-stone-100"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteRequest(tag)}
                  className="rounded-full px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {form && (
        <TagFormModal
          initial={form.mode === "edit" ? form.tag : null}
          onCancel={() => setForm(null)}
          onSubmit={handleSave}
        />
      )}
      {deleting && (
        <DeleteTagModal
          tag={deleting.tag}
          studentCount={deleting.studentCount}
          onCancel={() => setDeleting(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  );
}

function TagFormModal({
  initial,
  onCancel,
  onSubmit,
}: {
  initial: StudentTag | null;
  onCancel: () => void;
  onSubmit: (values: { name: string; color: string }) => Promise<string | null>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? "grey");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required.");
      return;
    }
    setLoading(true);
    setError(null);
    const result = await onSubmit({ name: trimmed, color });
    setLoading(false);
    if (result) setError(result);
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/50">
      <div className="flex min-h-full items-center justify-center px-4 py-8">
        <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
          <h2 className="text-lg font-bold text-stone-900">{initial ? "Edit tag" : "Add tag"}</h2>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label htmlFor="student-tag-name" className="block text-sm font-medium text-stone-700">
                Name
              </label>
              <input
                id="student-tag-name"
                type="text"
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Mainstream"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <span className="block text-sm font-medium text-stone-700">Color</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    aria-label={c.label}
                    aria-pressed={color === c.value}
                    className={`h-8 w-8 rounded-full ${c.swatchClass} transition-all ${
                      color === c.value ? "ring-2 ring-stone-900 ring-offset-2" : "hover:scale-110"
                    }`}
                  />
                ))}
              </div>
              <p className="mt-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getColorOption(color).badgeClass}`}>
                  {name.trim() || "Preview"}
                </span>
              </p>
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
                {loading ? "Saving…" : initial ? "Save changes" : "Add tag"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function DeleteTagModal({
  tag,
  studentCount,
  onCancel,
  onConfirm,
}: {
  tag: StudentTag;
  studentCount: number;
  onCancel: () => void;
  onConfirm: () => Promise<string | null>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
          <h2 className="flex items-center gap-2 text-lg font-bold text-stone-900">
            <Trash2 className="h-5 w-5 text-red-500" />
            Delete tag
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            Are you sure you want to delete <span className="font-medium">{tag.name}</span>? This
            action cannot be undone.
          </p>
          <p data-testid="delete-tag-student-count" className="mt-2 rounded-md bg-cream-50 p-3 text-sm text-stone-700">
            {studentCount === 0
              ? "No students have this tag."
              : `${studentCount} ${studentCount === 1 ? "student has" : "students have"} this tag — it will be removed from ${studentCount === 1 ? "them" : "all of them"}.`}
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
