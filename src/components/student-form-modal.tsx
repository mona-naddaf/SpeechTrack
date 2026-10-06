"use client";

import { useState, type FormEvent } from "react";
import type {
  ExpectedFrequency,
  ScheduledDayTime,
  Student,
  StudentStatus,
  StudentTag,
  TeacherStudent,
} from "@/lib/types";
import { EXPECTED_FREQUENCY_LABELS } from "@/lib/streaks";
import { STUDENT_STATUSES, STUDENT_STATUS_LABELS } from "@/lib/student-list";
import { getColorOption } from "@/lib/colors";
import AvatarPicker from "@/components/avatar-picker";
import SchedulePicker from "@/components/schedule-picker";

export type StudentFormValues = {
  name: string;
  className: string;
  expectedFrequency: ExpectedFrequency;
  avatar: string | null;
  scheduledDays: ScheduledDayTime[];
  scheduleEndDate: string | null;
  status: StudentStatus;
  startedOn: string | null;
  tagIds: string[];
};

type Props = {
  mode: "add" | "edit";
  initialStudent?: Student | TeacherStudent | null;
  /** The student's current tag ids (edit mode). */
  initialTagIds?: string[];
  /** Her whole tag palette, for the picker. */
  availableTags: StudentTag[];
  onCancel: () => void;
  onSubmit: (values: StudentFormValues) => Promise<string | null>;
};

const FREQUENCY_OPTIONS: ExpectedFrequency[] = [
  "daily",
  "few_times_week",
  "weekly",
];

/** Add/edit student — shared by the SLP and Teacher dashboards
 *  (students and teacher_students have the same editable shape). */
export default function StudentFormModal({
  mode,
  initialStudent,
  initialTagIds,
  availableTags,
  onCancel,
  onSubmit,
}: Props) {
  const [name, setName] = useState(initialStudent?.name ?? "");
  const [className, setClassName] = useState(initialStudent?.class ?? "");
  const [expectedFrequency, setExpectedFrequency] =
    useState<ExpectedFrequency>(initialStudent?.expected_frequency ?? "weekly");
  const [avatar, setAvatar] = useState<string | null>(
    initialStudent?.avatar ?? null
  );
  const [scheduledDays, setScheduledDays] = useState<ScheduledDayTime[]>(
    initialStudent?.scheduled_days ?? []
  );
  const [scheduleEndDate, setScheduleEndDate] = useState<string | null>(
    initialStudent?.schedule_end_date ?? null
  );
  const [status, setStatus] = useState<StudentStatus>(
    initialStudent?.status ?? "active"
  );
  const [startedOn, setStartedOn] = useState(initialStudent?.started_on ?? "");
  const [tagIds, setTagIds] = useState<string[]>(initialTagIds ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTag(id: string) {
    setTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name is required.");
      return;
    }

    setLoading(true);
    setError(null);
    const result = await onSubmit({
      name: trimmedName,
      className: className.trim(),
      expectedFrequency,
      avatar,
      scheduledDays,
      scheduleEndDate,
      status,
      startedOn: startedOn || null,
      tagIds,
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
          <h2 className="text-lg font-bold text-stone-900">
            {mode === "add" ? "Add student" : "Edit student"}
          </h2>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="student-name"
                className="block text-sm font-medium text-stone-700"
              >
                Name
              </label>
              <input
                id="student-name"
                type="text"
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div>
              <label
                htmlFor="student-class"
                className="block text-sm font-medium text-stone-700"
              >
                Class <span className="text-stone-400">(optional)</span>
              </label>
              <input
                id="student-class"
                type="text"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="student-status"
                  className="block text-sm font-medium text-stone-700"
                >
                  Status
                </label>
                <select
                  id="student-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as StudentStatus)}
                  disabled={Boolean(initialStudent?.archived_at)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-stone-50"
                >
                  {STUDENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STUDENT_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="student-started-on"
                  className="block text-sm font-medium text-stone-700"
                >
                  Started on <span className="text-stone-400">(optional)</span>
                </label>
                <input
                  id="student-started-on"
                  type="date"
                  value={startedOn}
                  onChange={(e) => setStartedOn(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>
            {initialStudent?.archived_at && (
              <p className="-mt-2 text-xs text-stone-500">
                Archived students stay Stopped — restore the student to change
                their status.
              </p>
            )}

            <div>
              <span className="block text-sm font-medium text-stone-700">
                Tags <span className="text-stone-400">(optional)</span>
              </span>
              {availableTags.length === 0 ? (
                <p className="mt-1 text-xs text-stone-500">
                  No tags yet — create them under Student tags in the toolkit.
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2" data-testid="student-form-tags">
                  {availableTags.map((tag) => {
                    const selected = tagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleTag(tag.id)}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                          selected
                            ? `${getColorOption(tag.color).badgeClass} ring-2 ring-stone-900 ring-offset-1`
                            : "bg-white text-stone-600 ring-1 ring-stone-300 hover:bg-stone-50"
                        }`}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="student-frequency"
                className="block text-sm font-medium text-stone-700"
              >
                How often do you plan to log sessions?
              </label>
              <select
                id="student-frequency"
                value={expectedFrequency}
                onChange={(e) =>
                  setExpectedFrequency(e.target.value as ExpectedFrequency)
                }
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {FREQUENCY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {EXPECTED_FREQUENCY_LABELS[option]}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-stone-500">
                Used to track this student&apos;s session streak.
              </p>
            </div>

            <AvatarPicker value={avatar} onChange={setAvatar} />

            <SchedulePicker
              value={scheduledDays}
              onChange={setScheduledDays}
              endDate={scheduleEndDate}
              onEndDateChange={setScheduleEndDate}
            />

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
                {loading
                  ? "Saving…"
                  : mode === "add"
                    ? "Add student"
                    : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
