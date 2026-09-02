"use client";

import { useState } from "react";
import { CalendarClock, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import type { Countdown } from "@/lib/types";
import { daysUntil, formatDate } from "@/lib/date";

type Props = {
  countdowns: Countdown[];
  today: string;
  /** Read-only summary mode (the dashboard): a link out to the Schedule
   *  page, which owns the actual add/edit/delete UI. Mutually exclusive
   *  with onAdd/onEdit — pass exactly one "mode" of props depending on
   *  where this renders. */
  manageHref?: string;
  /** Interactive mode (the Schedule page): rows open for editing, plus
   *  an "+ Add countdown" affordance. */
  onAdd?: () => void;
  onEdit?: (countdown: Countdown) => void;
};

/** "X days until [title]" — shared by the dashboard (a short read-only
 *  preview, `manageHref` set) and the Schedule page (the full,
 *  interactive list, `onAdd`/`onEdit` set). Upcoming countdowns
 *  (target_date >= today) always show first, soonest-first; passed ones
 *  are collapsed behind a "N passed" toggle rather than just gone, since
 *  a passed countdown still needs to be reachable to delete. Renders
 *  nothing in read-only mode with no countdowns at all — there's
 *  nothing worth a whole card for; the interactive mode still renders
 *  (with its own empty state) so "+ Add countdown" is always reachable
 *  from the Schedule page. */
export default function CountdownsWidget({
  countdowns,
  today,
  manageHref,
  onAdd,
  onEdit,
}: Props) {
  const [showPassed, setShowPassed] = useState(false);
  const interactive = onAdd !== undefined;

  const upcoming = countdowns
    .filter((c) => daysUntil(c.target_date, today) >= 0)
    .sort((a, b) => a.target_date.localeCompare(b.target_date));
  const passed = countdowns
    .filter((c) => daysUntil(c.target_date, today) < 0)
    .sort((a, b) => b.target_date.localeCompare(a.target_date));

  if (!interactive && countdowns.length === 0) {
    return null;
  }

  const previewLimit = interactive ? Infinity : 3;
  const visibleUpcoming = upcoming.slice(0, previewLimit);
  const hiddenUpcomingCount = upcoming.length - visibleUpcoming.length;

  function row(countdown: Countdown, isPassed: boolean) {
    const days = daysUntil(countdown.target_date, today);
    const label = isPassed
      ? `${formatDate(countdown.target_date)} — passed`
      : days === 0
        ? "Today!"
        : days === 1
          ? "1 day"
          : `${days} days`;

    const content = (
      <>
        <span
          className={`min-w-0 flex-1 truncate text-sm font-medium ${
            isPassed ? "text-stone-400 line-through" : "text-stone-800"
          }`}
        >
          {countdown.title}
        </span>
        <span
          className={`shrink-0 text-xs font-semibold ${
            isPassed
              ? "text-stone-400"
              : days <= 7
                ? "text-brand-700"
                : "text-stone-500"
          }`}
        >
          {label}
        </span>
      </>
    );

    return interactive ? (
      <button
        key={countdown.id}
        type="button"
        onClick={() => onEdit?.(countdown)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-cream-50"
      >
        {content}
      </button>
    ) : (
      <div key={countdown.id} className="flex items-center gap-2 px-2 py-1">
        {content}
      </div>
    );
  }

  const cardBody = (
    <>
      {visibleUpcoming.length === 0 && passed.length === 0 && (
        <p className="px-2 py-1 text-sm text-stone-400">
          No countdowns yet.
        </p>
      )}
      {visibleUpcoming.map((c) => row(c, false))}
      {hiddenUpcomingCount > 0 && (
        <Link
          href={manageHref ?? "#"}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-brand-700 hover:underline"
        >
          +{hiddenUpcomingCount} more
          <ChevronRight className="h-3 w-3" />
        </Link>
      )}
      {passed.length > 0 && (
        <div className="mt-1 border-t border-stone-100 pt-1">
          <button
            type="button"
            onClick={() => setShowPassed((s) => !s)}
            className="px-2 py-1 text-xs font-medium text-stone-400 hover:text-stone-600"
          >
            {showPassed ? "Hide" : `${passed.length} passed`}
          </button>
          {showPassed && passed.map((c) => row(c, true))}
        </div>
      )}
    </>
  );

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-400">
          <CalendarClock className="h-3.5 w-3.5" />
          Countdowns
        </p>
        {interactive ? (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add countdown
          </button>
        ) : (
          manageHref && (
            <Link
              href={manageHref}
              className="text-xs font-medium text-stone-400 transition-colors hover:text-brand-700"
            >
              Manage
            </Link>
          )
        )}
      </div>
      <div className="mt-2 space-y-0.5">{cardBody}</div>
    </div>
  );
}
