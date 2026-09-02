import { useState } from "react";
import { DAYS_OF_WEEK, DAY_LABELS, DEFAULT_DURATION_MINUTES } from "@/lib/schedule";
import type { DayOfWeek, ScheduledDayTime } from "@/lib/types";

/** New days get this time by default — matches the placeholder
 *  0029_scheduled_times_and_end_date.sql backfilled onto pre-existing
 *  scheduled_days entries, so "no time chosen yet" looks the same
 *  whether the row predates this feature or was just added. */
const DEFAULT_TIME = "09:00";

/** The duration dropdown's quick-pick options — the common session
 *  lengths. Anything else (including one of these typed by hand) falls
 *  through to the adjoining "Custom" number input instead. */
const DURATION_PRESETS = [15, 30, 45, 60];

/** One day's duration control: a select for the common lengths plus a
 *  "Custom" option that reveals a free-form number input. Kept as its
 *  own component (rather than inlined per-row JSX) so the "is this
 *  value a preset or custom" toggle can be local component state —
 *  SchedulePicker itself only ever tracks the resulting number. */
function DurationInput({
  minutes,
  onChange,
}: {
  minutes: number;
  onChange: (minutes: number) => void;
}) {
  const [customMode, setCustomMode] = useState(
    !DURATION_PRESETS.includes(minutes)
  );

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={customMode ? "custom" : String(minutes)}
        onChange={(e) => {
          if (e.target.value === "custom") {
            setCustomMode(true);
          } else {
            setCustomMode(false);
            onChange(Number(e.target.value));
          }
        }}
        className="rounded-lg border border-stone-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      >
        {DURATION_PRESETS.map((m) => (
          <option key={m} value={m}>
            {m} min
          </option>
        ))}
        <option value="custom">Custom…</option>
      </select>
      {customMode && (
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={480}
          step={1}
          value={minutes}
          onChange={(e) => {
            const parsed = Math.round(Number(e.target.value));
            onChange(Number.isFinite(parsed) ? Math.min(480, Math.max(1, parsed)) : 1);
          }}
          aria-label="Custom duration in minutes"
          className="w-16 rounded-lg border border-stone-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      )}
    </div>
  );
}

type Props = {
  value: ScheduledDayTime[];
  onChange: (value: ScheduledDayTime[]) => void;
  /** "Scheduled through" — end of term/year. Optional: some callers
   *  (none yet, but keeps this component's own concerns together)
   *  might want the day/time picker without the end-date field. */
  endDate: string | null;
  onEndDateChange: (value: string | null) => void;
};

/** Mon–Sun day toggles, each selected day getting its own time picker,
 *  plus a "Scheduled through" end date — shared by the SLP and Teacher
 *  add/edit student forms. Always emits `value` re-sorted into Mon-Sun
 *  order regardless of the order days were toggled in. */
export default function SchedulePicker({
  value,
  onChange,
  endDate,
  onEndDateChange,
}: Props) {
  type DayEntry = { time: string; duration_minutes: number };
  const byDay = new Map<DayOfWeek, DayEntry>(
    value.map((entry) => [
      entry.day,
      { time: entry.time, duration_minutes: entry.duration_minutes },
    ])
  );

  function sorted(next: Map<DayOfWeek, DayEntry>): ScheduledDayTime[] {
    return DAYS_OF_WEEK.filter((d) => next.has(d)).map((day) => ({
      day,
      ...next.get(day)!,
    }));
  }

  function toggle(day: DayOfWeek) {
    const next = new Map(byDay);
    if (next.has(day)) next.delete(day);
    else
      next.set(day, {
        time: DEFAULT_TIME,
        duration_minutes: DEFAULT_DURATION_MINUTES,
      });
    onChange(sorted(next));
  }

  function setTime(day: DayOfWeek, time: string) {
    const next = new Map(byDay);
    next.set(day, { ...next.get(day)!, time });
    onChange(sorted(next));
  }

  function setDuration(day: DayOfWeek, duration_minutes: number) {
    const next = new Map(byDay);
    next.set(day, { ...next.get(day)!, duration_minutes });
    onChange(sorted(next));
  }

  return (
    <div>
      <span className="block text-sm font-medium text-stone-700">
        Scheduled days <span className="text-stone-400">(optional)</span>
      </span>
      <div className="mt-2 grid grid-cols-7 gap-1.5">
        {DAYS_OF_WEEK.map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => toggle(day)}
            aria-pressed={byDay.has(day)}
            className={`rounded-lg py-2 text-xs font-medium transition-all ${
              byDay.has(day)
                ? "bg-brand-700 text-white shadow-sm"
                : "border border-stone-300 bg-white text-stone-600 hover:bg-cream-100"
            }`}
          >
            {DAY_LABELS[day]}
          </button>
        ))}
      </div>

      {value.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {value.map(({ day, time, duration_minutes }) => (
            <div key={day} className="flex flex-wrap items-center gap-2">
              <span className="w-9 text-xs font-medium text-stone-500">
                {DAY_LABELS[day]}
              </span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(day, e.target.value)}
                required
                className="rounded-lg border border-stone-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <DurationInput
                minutes={duration_minutes}
                onChange={(m) => setDuration(day, m)}
              />
            </div>
          ))}
        </div>
      )}

      <div className="mt-3">
        <label
          htmlFor="schedule-end-date"
          className="block text-sm font-medium text-stone-700"
        >
          Scheduled through <span className="text-stone-400">(optional)</span>
        </label>
        <input
          id="schedule-end-date"
          type="date"
          value={endDate ?? ""}
          onChange={(e) => onEndDateChange(e.target.value || null)}
          className="mt-1 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <p className="mt-1 text-xs text-stone-500">
          End of term or school year, if this schedule won&apos;t continue past
          a known date.
        </p>
      </div>
    </div>
  );
}
