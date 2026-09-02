"use client";

import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import type { ScheduleEvent } from "@/lib/types";
import { DEFAULT_DURATION_MINUTES, DEFAULT_EVENT_COLOR } from "@/lib/schedule";
import { COLOR_OPTIONS, getColorOption } from "@/lib/colors";
import DurationInput from "@/components/duration-input";

export type ScheduleEventFormValues = {
  title: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  note: string | null;
  color: string;
};

type Props = {
  mode: "add" | "edit";
  initialEvent?: ScheduleEvent | null;
  /** Date to preselect for a brand-new event — whichever day/week the
   *  Schedule page happened to be showing when "+ Add event" was
   *  clicked, so the form doesn't default to some unrelated date the
   *  user then has to change by hand. Ignored in edit mode, where the
   *  event's own date always wins. */
  initialDate: string;
  onCancel: () => void;
  onSubmit: (values: ScheduleEventFormValues) => Promise<string | null>;
  /** Edit mode only — hands off to the caller's own delete-confirm
   *  flow (DeleteScheduleEventConfirmModal) rather than deleting
   *  directly from here, same "confirm modal is a separate step"
   *  convention every other delete in this app follows. */
  onDelete?: () => void;
};

/** Add/edit form for a standalone Schedule page event (a meeting, or
 *  anything else not tied to a student) — shared by the SLP and Teacher
 *  Schedule pages via ScheduleView, since schedule_events is one table
 *  for both sides (see 0031_schedule_events.sql). */
export default function ScheduleEventFormModal({
  mode,
  initialEvent,
  initialDate,
  onCancel,
  onSubmit,
  onDelete,
}: Props) {
  const [title, setTitle] = useState(initialEvent?.title ?? "");
  const [date, setDate] = useState(initialEvent?.date ?? initialDate);
  const [startTime, setStartTime] = useState(initialEvent?.start_time ?? "09:00");
  const [durationMinutes, setDurationMinutes] = useState(
    initialEvent?.duration_minutes ?? DEFAULT_DURATION_MINUTES
  );
  const [note, setNote] = useState(initialEvent?.note ?? "");
  const [color, setColor] = useState(initialEvent?.color ?? DEFAULT_EVENT_COLOR);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Title is required.");
      return;
    }
    if (!date) {
      setError("Date is required.");
      return;
    }

    setLoading(true);
    setError(null);
    const result = await onSubmit({
      title: trimmedTitle,
      date,
      startTime,
      durationMinutes,
      note: note.trim() || null,
      color,
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
            {mode === "add" ? "Add event" : "Edit event"}
          </h2>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="event-title"
                className="block text-sm font-medium text-stone-700"
              >
                Title
              </label>
              <input
                id="event-title"
                type="text"
                required
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. IEP meeting"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <div>
                <label
                  htmlFor="event-date"
                  className="block text-sm font-medium text-stone-700"
                >
                  Date
                </label>
                <input
                  id="event-date"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label
                  htmlFor="event-time"
                  className="block text-sm font-medium text-stone-700"
                >
                  Start time
                </label>
                <input
                  id="event-time"
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>

            <div>
              <span className="block text-sm font-medium text-stone-700">
                Duration
              </span>
              <div className="mt-1">
                <DurationInput minutes={durationMinutes} onChange={setDurationMinutes} />
              </div>
            </div>

            <div>
              <label
                htmlFor="event-note"
                className="block text-sm font-medium text-stone-700"
              >
                Note <span className="text-stone-400">(optional)</span>
              </label>
              <textarea
                id="event-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div>
              <span className="block text-sm font-medium text-stone-700">
                Color
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    aria-label={c.label}
                    aria-pressed={color === c.value}
                    className={`h-8 w-8 rounded-full ${c.swatchClass} transition-all ${
                      color === c.value
                        ? "ring-2 ring-stone-900 ring-offset-2"
                        : "hover:scale-110"
                    }`}
                  />
                ))}
              </div>
              <p className="mt-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${getColorOption(color).badgeClass} ${getColorOption(color).borderClass}`}
                >
                  {title.trim() || "Preview"}
                </span>
              </p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex items-center justify-between gap-2 pt-2">
              {mode === "edit" && onDelete ? (
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
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
                      ? "Add event"
                      : "Save changes"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
