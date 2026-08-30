"use client";

import { useState, type FormEvent } from "react";
import type { TeacherStudentCustomField } from "@/lib/types";
import { getTodayLocalDateString } from "@/lib/date";
import CustomFieldsEditor, {
  type CustomFieldDraft,
} from "@/components/custom-fields-editor";

export type StudentInfoValues = {
  dateOfBirth: string | null;
  motherEmail: string | null;
  fatherEmail: string | null;
  homeroomTeacher: string | null;
};

type Props = {
  initialValues: StudentInfoValues;
  initialCustomFields: TeacherStudentCustomField[];
  onCancel: () => void;
  onSubmit: (
    values: StudentInfoValues & { customFields: CustomFieldDraft[] }
  ) => Promise<string | null>;
};

/** Focused edit modal for just the "Student info" section's own fields
 *  (date of birth, parent emails, homeroom teacher, custom fields) — a
 *  student's name/class/avatar/schedule/frequency stay editable only from
 *  the dashboard's add/edit-student modal, which already covers all of
 *  these fields too; this one exists so there's an obvious, focused way
 *  to add/edit this info without leaving the student page. */
export default function StudentInfoFormModal({
  initialValues,
  initialCustomFields,
  onCancel,
  onSubmit,
}: Props) {
  const [dateOfBirth, setDateOfBirth] = useState(
    initialValues.dateOfBirth ?? ""
  );
  const [motherEmail, setMotherEmail] = useState(
    initialValues.motherEmail ?? ""
  );
  const [fatherEmail, setFatherEmail] = useState(
    initialValues.fatherEmail ?? ""
  );
  const [homeroomTeacher, setHomeroomTeacher] = useState(
    initialValues.homeroomTeacher ?? ""
  );
  const [customFields, setCustomFields] = useState<CustomFieldDraft[]>(
    initialCustomFields.map((f) => ({ id: f.id, label: f.label, value: f.value }))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await onSubmit({
      dateOfBirth: dateOfBirth || null,
      motherEmail: motherEmail.trim() || null,
      fatherEmail: fatherEmail.trim() || null,
      homeroomTeacher: homeroomTeacher.trim() || null,
      customFields,
    });
    setLoading(false);
    if (result) {
      setError(result);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/50">
      <div className="flex min-h-full items-center justify-center px-4 py-8">
        <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
          <h2 className="text-lg font-bold text-stone-900">Student info</h2>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="info-dob"
                className="block text-sm font-medium text-stone-700"
              >
                Date of birth <span className="text-stone-400">(optional)</span>
              </label>
              <input
                id="info-dob"
                type="date"
                autoFocus
                value={dateOfBirth}
                max={getTodayLocalDateString()}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div>
              <label
                htmlFor="info-homeroom"
                className="block text-sm font-medium text-stone-700"
              >
                Homeroom teacher{" "}
                <span className="text-stone-400">(optional)</span>
              </label>
              <input
                id="info-homeroom"
                type="text"
                value={homeroomTeacher}
                onChange={(e) => setHomeroomTeacher(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="info-mother-email"
                  className="block text-sm font-medium text-stone-700"
                >
                  Mother&apos;s email{" "}
                  <span className="text-stone-400">(optional)</span>
                </label>
                <input
                  id="info-mother-email"
                  type="email"
                  value={motherEmail}
                  onChange={(e) => setMotherEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label
                  htmlFor="info-father-email"
                  className="block text-sm font-medium text-stone-700"
                >
                  Father&apos;s email{" "}
                  <span className="text-stone-400">(optional)</span>
                </label>
                <input
                  id="info-father-email"
                  type="email"
                  value={fatherEmail}
                  onChange={(e) => setFatherEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>

            <CustomFieldsEditor value={customFields} onChange={setCustomFields} />

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
                {loading ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
