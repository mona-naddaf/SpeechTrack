"use client";

import { useState } from "react";
import { Plus, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { computeAge } from "@/lib/date";
import { diffCustomFields } from "@/lib/custom-fields";
import type { StudentCustomField } from "@/lib/types";
import SectionHeader from "@/components/section-header";
import { useSectionPreferences } from "@/components/section-preferences";
import StudentInfoFormModal, {
  type StudentInfoValues,
} from "./student-info-form-modal";

type Props = {
  studentId: string;
  studentClass: string | null;
  initialValues: StudentInfoValues;
  initialCustomFields: StudentCustomField[];
};

/** "Student info" section — computed age, class, homeroom teacher, parent
 *  emails, and any custom fields. Deliberately not shown at all (no
 *  header, no card) when every one of those is empty, since a student who
 *  hasn't had this info added yet shouldn't get a section full of blank
 *  rows — but "Add student info" stays an easy-to-find single link either
 *  way, opening the same edit modal a filled-in section links to via its
 *  "Edit" button. */
export default function StudentInfoSection({
  studentId,
  studentClass,
  initialValues,
  initialCustomFields,
}: Props) {
  const [dateOfBirth, setDateOfBirth] = useState(initialValues.dateOfBirth);
  const [motherEmail, setMotherEmail] = useState(initialValues.motherEmail);
  const [fatherEmail, setFatherEmail] = useState(initialValues.fatherEmail);
  const [homeroomTeacher, setHomeroomTeacher] = useState(
    initialValues.homeroomTeacher
  );
  const [customFields, setCustomFields] =
    useState<StudentCustomField[]>(initialCustomFields);
  const [showEditModal, setShowEditModal] = useState(false);
  const {
    collapsed,
    onToggleCollapse,
    onMoveUp,
    onMoveDown,
    canMoveUp,
    canMoveDown,
  } = useSectionPreferences("student_info");

  const isEmpty =
    !dateOfBirth &&
    !motherEmail &&
    !fatherEmail &&
    !homeroomTeacher &&
    customFields.length === 0;

  async function handleSave({
    dateOfBirth: nextDob,
    motherEmail: nextMother,
    fatherEmail: nextFather,
    homeroomTeacher: nextHomeroom,
    customFields: nextCustomFields,
  }: StudentInfoValues & {
    customFields: { id: string | null; label: string; value: string }[];
  }) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "You need to be signed in.";

    const { error: updateError } = await supabase
      .from("students")
      .update({
        date_of_birth: nextDob,
        mother_email: nextMother,
        father_email: nextFather,
        homeroom_teacher: nextHomeroom,
      })
      .eq("id", studentId);
    if (updateError) return updateError.message;

    const { toInsert, toUpdate, toDeleteIds } = diffCustomFields(
      customFields.map((f) => f.id),
      nextCustomFields
    );

    if (toDeleteIds.length > 0) {
      const { error: delError } = await supabase
        .from("student_custom_fields")
        .delete()
        .in("id", toDeleteIds);
      if (delError) return delError.message;
    }
    if (toUpdate.length > 0) {
      const results = await Promise.all(
        toUpdate.map((f) =>
          supabase
            .from("student_custom_fields")
            .update({ label: f.label, value: f.value })
            .eq("id", f.id)
        )
      );
      const updError = results.find((r) => r.error)?.error;
      if (updError) return updError.message;
    }
    let insertedFields: StudentCustomField[] = [];
    if (toInsert.length > 0) {
      const { data: fieldRows, error: insError } = await supabase
        .from("student_custom_fields")
        .insert(
          toInsert.map((f) => ({
            slp_id: user.id,
            student_id: studentId,
            ...f,
          }))
        )
        .select("id, student_id, label, value, created_at");
      if (insError) return insError.message;
      insertedFields = fieldRows ?? [];
    }

    const remainingFields = customFields
      .filter((f) => !toDeleteIds.includes(f.id))
      .map((f) => {
        const updated = toUpdate.find((u) => u.id === f.id);
        return updated ? { ...f, label: updated.label, value: updated.value } : f;
      });

    setDateOfBirth(nextDob);
    setMotherEmail(nextMother);
    setFatherEmail(nextFather);
    setHomeroomTeacher(nextHomeroom);
    setCustomFields([...remainingFields, ...insertedFields]);
    setShowEditModal(false);
    return null;
  }

  const editModal = showEditModal && (
    <StudentInfoFormModal
      initialValues={{ dateOfBirth, motherEmail, fatherEmail, homeroomTeacher }}
      initialCustomFields={customFields}
      onCancel={() => setShowEditModal(false)}
      onSubmit={handleSave}
    />
  );

  if (isEmpty) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowEditModal(true)}
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800"
        >
          <Plus className="h-3.5 w-3.5" />
          Add student info
        </button>
        {editModal}
      </>
    );
  }

  return (
    <div>
      <SectionHeader
        icon={User}
        title="Student info"
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        actions={
          <button
            onClick={() => setShowEditModal(true)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100"
          >
            Edit
          </button>
        }
      />

      {!collapsed && (
        <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {dateOfBirth && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                  Age
                </dt>
                <dd className="mt-0.5 text-sm text-stone-800">
                  {computeAge(dateOfBirth)} years old
                </dd>
              </div>
            )}
            {studentClass && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                  Class
                </dt>
                <dd className="mt-0.5 text-sm text-stone-800">{studentClass}</dd>
              </div>
            )}
            {homeroomTeacher && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                  Homeroom teacher
                </dt>
                <dd className="mt-0.5 text-sm text-stone-800">
                  {homeroomTeacher}
                </dd>
              </div>
            )}
            {motherEmail && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                  Mother&apos;s email
                </dt>
                <dd className="mt-0.5 truncate text-sm text-stone-800">
                  <a
                    href={`mailto:${motherEmail}`}
                    className="hover:text-brand-700 hover:underline"
                  >
                    {motherEmail}
                  </a>
                </dd>
              </div>
            )}
            {fatherEmail && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                  Father&apos;s email
                </dt>
                <dd className="mt-0.5 truncate text-sm text-stone-800">
                  <a
                    href={`mailto:${fatherEmail}`}
                    className="hover:text-brand-700 hover:underline"
                  >
                    {fatherEmail}
                  </a>
                </dd>
              </div>
            )}
          </dl>

          {customFields.length > 0 && (
            <div className="mt-4 border-t border-stone-100 pt-4">
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                {customFields.map((field) => (
                  <div key={field.id}>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                      {field.label}
                    </dt>
                    <dd className="mt-0.5 text-sm text-stone-800">
                      {field.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      )}

      {editModal}
    </div>
  );
}
