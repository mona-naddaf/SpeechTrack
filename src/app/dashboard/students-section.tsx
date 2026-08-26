"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, UserPlus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ExpectedFrequency, Student } from "@/lib/types";
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
    expectedFrequency,
  }: {
    name: string;
    className: string;
    expectedFrequency: ExpectedFrequency;
  }) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("students")
      .insert({
        slp_id: userId,
        name,
        class: className || null,
        expected_frequency: expectedFrequency,
      })
      .select("id, name, class, expected_frequency, created_at")
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
    expectedFrequency,
  }: {
    name: string;
    className: string;
    expectedFrequency: ExpectedFrequency;
  }) {
    if (!editingStudent) return null;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("students")
      .update({
        name,
        class: className || null,
        expected_frequency: expectedFrequency,
      })
      .eq("id", editingStudent.id)
      .select("id, name, class, expected_frequency, created_at")
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
        <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
          <Users className="h-5 w-5 text-brand-500" />
          Students
        </h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md"
        >
          <UserPlus className="h-4 w-4" />
          Add student
        </button>
      </div>

      {listError && (
        <p className="mt-4 text-sm text-red-600">
          Couldn&apos;t load students: {listError}
        </p>
      )}

      {!listError && students.length === 0 && (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
            <Users className="h-6 w-6 text-brand-500" />
          </div>
          <p className="text-stone-500">
            No students yet — add your first one to start tracking progress.
          </p>
        </div>
      )}

      {students.length > 0 && (
        <ul className="mt-4 divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md">
          {students.map((student) => (
            <li
              key={student.id}
              className="flex items-center justify-between gap-3 px-4 py-1 transition-colors hover:bg-cream-50 sm:px-5"
            >
              <Link
                href={`/students/${student.id}`}
                className="flex min-w-0 flex-1 items-center gap-2 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-stone-900">
                    {student.name}
                  </p>
                  <p className="truncate text-sm text-stone-500">
                    {student.class || "No class"}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-stone-300" />
              </Link>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => setEditingStudent(student)}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100"
                >
                  Edit
                </button>
                <button
                  onClick={() => setDeletingStudent(student)}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
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
