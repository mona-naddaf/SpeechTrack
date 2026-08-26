import { DAYS_OF_WEEK, DAY_LABELS } from "@/lib/schedule";
import type { DayOfWeek } from "@/lib/types";

type Props = {
  value: DayOfWeek[];
  onChange: (value: DayOfWeek[]) => void;
};

/** Simple Mon–Sun checkboxes for which days sessions/lessons are
 *  scheduled — shared by the SLP and Teacher add/edit student forms. */
export default function SchedulePicker({ value, onChange }: Props) {
  const selected = new Set(value);

  function toggle(day: DayOfWeek) {
    const next = new Set(selected);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    onChange(DAYS_OF_WEEK.filter((d) => next.has(d)));
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
            aria-pressed={selected.has(day)}
            className={`rounded-lg py-2 text-xs font-medium transition-all ${
              selected.has(day)
                ? "bg-brand-700 text-white shadow-sm"
                : "border border-stone-300 bg-white text-stone-600 hover:bg-cream-100"
            }`}
          >
            {DAY_LABELS[day]}
          </button>
        ))}
      </div>
    </div>
  );
}
