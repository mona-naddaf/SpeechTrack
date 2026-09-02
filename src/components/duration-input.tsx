"use client";

import { useState } from "react";

/** The duration dropdown's quick-pick options — the common session/
 *  event lengths. Anything else (including one of these typed by hand)
 *  falls through to the adjoining "Custom" number input instead. */
const DURATION_PRESETS = [15, 30, 45, 60];

/** A duration control: a select for the common lengths plus a "Custom"
 *  option that reveals a free-form number input. Shared by
 *  SchedulePicker (a student's per-day session length) and
 *  ScheduleEventFormModal (a standalone event's length) — both just
 *  need "pick a duration in minutes," so this owns the "is this value a
 *  preset or custom" toggle as its own local state rather than each
 *  caller re-implementing it. */
export default function DurationInput({
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
