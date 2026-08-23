"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Student } from "@/lib/types";
import StudentFormModal from "./student-form-modal";
import DeleteConfirmModal from "./delete-confirm-modal";

type Props = {
  userId: string;
  initialStudents: Student[];
  initialError: string | null;
};

export default function StudentsSection({
  userId,
  initialStudents,
  initialError,
}: Props) {
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [listError] = useState<string | null>(initialError);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(
    null
  );

  function sortByNewest(list: Student[]) {
    return [...list].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  async function handleAdd({
    name,
    className,
  }: {
    name: string;
    className: string;
  }) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("students")
      .insert({ slp_id: userId, name, class: className || null })
      .select("id, name, class, created_at")
      .single();

    if (error || !data) {
      return error?.message ?? "Something went wrong. Please try again.";
    }

    setStudents((prev) => sortByNewest([...prev, data]));
    setShowAddModal(false);
    return null;
  }

  async function handleEdit({
    name,
    className,
  }: {
    name: string;
    className: string;
  }) {
    if (!editingStudent) return null;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("students")
      .update({ name, class: className || null })
      .eq("id", editingStudent.id)
      .select("id, name, class, created_at")
      .single();

    if (error || !data) {
      return error?.message ?? "Something went wrong. Please try again.";
    }

    setStudents((prev) => prev.map((s) => (s.id === data.id ? data : s)));
    setEditingStudent(null);
    return null;
  }

  async function handleDelete() {
    if (!deletingStudent) return null;

    const supabase = createClient();
    const { error } = await supabase
      .from("students")
      .delete()
      .eq("id", deletingStudent.id);

    if (error) {
      return error.message;
    }

    setStudents((prev) => prev.filter((s) => s.id !== deletingStudent.id));
    setDeletingStudent(null);
    return null;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-slate-900">Students</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
        >
          Add student
        </button>
      </div>

      {listError && (
        <p className="mt-4 text-sm text-red-600">
          Couldn&apos;t load students: {listError}
        </p>
      )}

      {!listError && students.length === 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          No students yet. Add your first student to get started.
        </div>
      )}

      {students.length > 0 && (
        <ul className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {students.map((student) => (
            <li
              key={student.id}
              className="flex items-center justify-between gap-3 px-4 py-1 sm:px-5"
            >
              <Link
                href={`/students/${student.id}`}
                className="min-w-0 flex-1 py-3"
              >
                <p className="truncate font-medium text-slate-900">
                  {student.name}
                </p>
                <p className="truncate text-sm text-slate-500">
                  {student.class || "No class"}
                </p>
              </Link>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => setEditingStudent(student)}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
                >
                  Edit
                </button>
                <button
                  onClick={() => setDeletingStudent(student)}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showAddModal && (
        <StudentFormModal
          mode="add"
          onCancel={() => setShowAddModal(false)}
          onSubmit={handleAdd}
        />
      )}

      {editingStudent && (
        <StudentFormModal
          mode="edit"
          initialStudent={editingStudent}
          onCancel={() => setEditingStudent(null)}
          onSubmit={handleEdit}
        />
      )}

      {deletingStudent && (
        <DeleteConfirmModal
          student={deletingStudent}
          onCancel={() => setDeletingStudent(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
