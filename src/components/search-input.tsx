"use client";

import { Search } from "lucide-react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** "standalone" (default): its own full rounded border, sits on its
   *  own. "attached": no border/radius of its own — meant to be the
   *  first child inside a bordered container that also holds the
   *  results right below it, with just a divider line between the two,
   *  so search box + live results read as one merged block instead of
   *  two separate elements with a gap. */
  variant?: "standalone" | "attached";
};

/** A plain search box — icon + text input — reused everywhere a goal list
 *  needs to be searched by any word in its text, across every
 *  area/subject at once. Deliberately dumb: the caller owns the query
 *  state and does the actual (case-insensitive, partial-match)
 *  filtering, since what's being filtered and how it combines with any
 *  other filter already in place differs by call site. */
export default function SearchInput({
  value,
  onChange,
  placeholder = "Search by goal text…",
  className = "",
  variant = "standalone",
}: Props) {
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={
          variant === "attached"
            ? "w-full border-b border-stone-200 py-2 pl-9 pr-3 text-sm focus:outline-none"
            : "w-full rounded-lg border border-stone-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        }
      />
    </div>
  );
}
