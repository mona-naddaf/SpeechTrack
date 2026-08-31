"use client";

import { User } from "lucide-react";
import { computeAge } from "@/lib/date";
import type { StudentCustomField } from "@/lib/types";
import SectionHeader from "@/components/section-header";
import { useSectionPreferences } from "@/components/section-preferences";

type Props = {
  studentClass: string | null;
  dateOfBirth: string | null;
  motherEmail: string | null;
  fatherEmail: string | null;
  homeroomTeacher: string | null;
  customFields: StudentCustomField[];
};

/** Read-only mirror of StudentInfoSection — same fields, no "Edit"
 *  button and no modal. Renders nothing at all when every field is
 *  empty, same as the original. */
export default function StudentInfoView({
  studentClass,
  dateOfBirth,
  motherEmail,
  fatherEmail,
  homeroomTeacher,
  customFields,
}: Props) {
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

  if (isEmpty) return null;

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
                  {motherEmail}
                </dd>
              </div>
            )}
            {fatherEmail && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                  Father&apos;s email
                </dt>
                <dd className="mt-0.5 truncate text-sm text-stone-800">
                  {fatherEmail}
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
    </div>
  );
}
