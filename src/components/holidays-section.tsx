"use client";

import { useState } from "react";
import { CalendarOff, ChevronDown, ChevronRight, Plus } from "lucide-react";
import type { Holiday } from "@/lib/types";
import { formatDate } from "@/lib/date";

type Props = {
  holidays: Holiday[];
  onAdd: () => void;
  onEdit: (holiday: Holiday) => void;
};

/** The Schedule page's holiday management list — sorted soonest-first,
 *  each row opens HolidayFormModal for editing (delete lives inside
 *  that same form, same as the events feature). Collapsible since it's
 *  a secondary management tool sitting below the calendar itself, not
 *  the page's main content. */
export default function HolidaysSection({ holidays, onAdd, onEdit }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          className="flex min-w-0 items-center gap-2 text-sm font-semibold text-stone-900 transition-colors hover:text-brand-700"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 shrink-0 text-stone-400" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-stone-400" />
          )}
          <CalendarOff className="h-4 w-4 shrink-0 text-brand-500" />
          Holidays
        </button>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Add holiday
        </button>
      </div>

      {!collapsed &&
        (sorted.length === 0 ? (
          <p className="mt-3 px-2 text-sm text-stone-400">
            No holidays marked yet — a marked holiday shows on the
            calendar and protects a student&apos;s session streak that
            day, the same way an excused absence does.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-stone-100">
            {sorted.map((holiday) => (
              <li key={holiday.id}>
                <button
                  type="button"
                  onClick={() => onEdit(holiday)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-cream-50"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-stone-800">
                    {holiday.title}
                  </span>
                  <span className="shrink-0 text-xs text-stone-500">
                    {formatDate(holiday.date)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
