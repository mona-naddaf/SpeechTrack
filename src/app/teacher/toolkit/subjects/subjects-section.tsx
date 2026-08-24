"use client";

import { useState } from "react";
import { BookMarked, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { TeacherSubject } from "@/lib/types";
import SubjectFormModal from "./subject-form-modal";
import DeleteSubjectConfirmModal from "./delete-subject-confirm-modal";

type Props = {
  initialSubjects: TeacherSubject[];
};

export default function SubjectsSection({ initialSubjects }: Props) {
  const [subjects, setSubjects] = useState<TeacherSubject[]>(initialSubjects);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<TeacherSubject | null>(
    null
  );
  const [deletingSubject, setDeletingSubject] = useState<TeacherSubject | null>(
    null
  );
  const [inUseMessage, setInUseMessage] = useState<string | null>(null);

  function sortByName(list: TeacherSubject[]) {
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }

  async function handleAdd({ name }: { name: string }) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "You need to be signed in.";

    const { data, error } = await supabase
      .from("teacher_subjects")
      .insert({ teacher_id: user.id, name })
      .select("id, name")
      .single();

    if (error || !data) {
      return error?.message ?? "Something went wrong. Please try again.";
    }

    setSubjects((prev) => sortByName([...prev, data]));
    setShowAddModal(false);
    return null;
  }

  async function handleEdit({ name }: { name: string }) {
    if (!editingSubject) return null;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("teacher_subjects")
      .update({ name })
      .eq("id", editingSubject.id)
      .select("id, name")
      .single();

    if (error || !data) {
      return error?.message ?? "Something went wrong. Please try again.";
    }

    setSubjects((prev) =>
      sortByName(prev.map((s) => (s.id === data.id ? data : s)))
    );
    setEditingSubject(null);
    return null;
  }

  async function handleDeleteRequest(subject: TeacherSubject) {
    setInUseMessage(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("teacher_goals")
      .select("id")
      .eq("subject_id", subject.id)
      .limit(1);

    if (error) {
      setInUseMessage(error.message);
      return;
    }

    if ((data ?? []).length > 0) {
      setInUseMessage(
        `"${subject.name}" is used by at least one goal, so it can't be deleted. Change or remove it from those goals first.`
      );
      return;
    }

    setDeletingSubject(subject);
  }

  async function handleDeleteConfirm() {
    if (!deletingSubject) return null;

    const supabase = createClient();
    const { error } = await supabase
      .from("teacher_subjects")
      .delete()
      .eq("id", deletingSubject.id);

    if (error) {
      return error.message;
    }

    setSubjects((prev) => prev.filter((s) => s.id !== deletingSubject.id));
    setDeletingSubject(null);
    return null;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
          <BookMarked className="h-5 w-5 text-brand-500" />
          Subjects
        </h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md"
        >
          <Plus className="h-4 w-4" />
          Add subject
        </button>
      </div>

      {inUseMessage && (
        <p className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {inUseMessage}
        </p>
      )}

      {subjects.length === 0 && (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
            <BookMarked className="h-6 w-6 text-brand-500" />
          </div>
          <p className="text-stone-500">
            No subjects yet — add one to start organizing goals.
          </p>
        </div>
      )}

      {subjects.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {subjects.map((subject) => (
            <li
              key={subject.id}
              className="flex items-center gap-1 rounded-full border border-stone-200 bg-white py-1 pl-3 pr-1 shadow-sm"
            >
              <span className="text-sm font-medium text-stone-700">
                {subject.name}
              </span>
              <button
                onClick={() => setEditingSubject(subject)}
                className="rounded-full px-2 py-1 text-xs font-medium text-stone-500 transition-colors hover:bg-stone-100"
              >
                Edit
              </button>
              <button
                onClick={() => handleDeleteRequest(subject)}
                className="rounded-full px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      {showAddModal && (
        <SubjectFormModal
          mode="add"
          onCancel={() => setShowAddModal(false)}
          onSubmit={handleAdd}
        />
      )}

      {editingSubject && (
        <SubjectFormModal
          mode="edit"
          initialSubject={editingSubject}
          onCancel={() => setEditingSubject(null)}
          onSubmit={handleEdit}
        />
      )}

      {deletingSubject && (
        <DeleteSubjectConfirmModal
          subject={deletingSubject}
          onCancel={() => setDeletingSubject(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  );
}
