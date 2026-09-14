"use client";

import { useState } from "react";
import { Search } from "lucide-react";

export type GoalComboboxOption = {
  id: string;
  text: string;
  /** Shown alongside the goal text in the results panel — its area/
   *  subject name, since a search spans every category at once. */
  categoryName: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Already-filtered matches to show — this component only renders
   *  them, it doesn't do the filtering itself (callers combine search
   *  with whatever other filters they already have in place). */
  options: GoalComboboxOption[];
  onSelect: (option: GoalComboboxOption) => void;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
};

/** One merged search-box + live-results widget: typing filters `options`
 *  and matches appear directly beneath the input as she types — no
 *  separate "open the list" step, unlike a plain search box next to a
 *  native `<select>` that still has to be clicked open. Selecting a
 *  result calls `onSelect` and closes the panel; the input's value
 *  becomes whatever the caller sets it to (typically the picked goal's
 *  own text), so the combobox visibly shows what's selected. */
export default function GoalCombobox({
  value,
  onChange,
  options,
  onSelect,
  placeholder = "Search by goal text…",
  emptyMessage = "No goals match your search",
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);

  function handleSelect(option: GoalComboboxOption) {
    onSelect(option);
    setOpen(false);
  }

  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // Also open on a plain click, not just on focus — once the field
        // already has focus (e.g. right after Escape closed the panel, or
        // after picking a result handed focus back here), a click doesn't
        // fire a new focus event, so relying on onFocus alone left the
        // list stuck closed with no way to reopen it short of tabbing
        // away and back. This is what "browse without typing" needs to
        // actually be reachable at all times, not just on the very first
        // click into the box.
        onClick={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder}
        className="w-full rounded-lg border border-stone-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />

      {open && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-stone-200 bg-white py-1 shadow-lg">
          {options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-stone-500">{emptyMessage}</p>
          ) : (
            options.map((option) => (
              <button
                key={option.id}
                type="button"
                // Keeps focus on the input instead of letting the browser's
                // default mousedown behavior shift it to this button. That
                // used to be handled by delaying the blur-triggered close
                // with a 150ms timer instead — a race that a slower click
                // (or a slower re-render) could lose, closing the panel
                // before its own onClick ever fired, which read as "I
                // clicked a result and nothing happened." Blocking the
                // focus change here means the input never blurs on this
                // click at all, so onClick below always gets to run.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(option)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-50"
              >
                <span className="flex-1">{option.text}</span>
                <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
                  {option.categoryName}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
