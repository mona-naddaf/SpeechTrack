import type { AttendanceRecord, PackageManualEntry, StudentPackage } from "./types";

export type PackageItemKind = "session" | "absence" | "manual";

export const PACKAGE_ITEM_KIND_LABELS: Record<PackageItemKind, string> = {
  session: "Logged session",
  absence: "Counted absence",
  manual: "Manual entry",
};

/** One thing that can fill a package circle, normalized across the three
 *  source tables. `id` is the source row's id (unique across tables,
 *  they're all gen_random_uuid()). */
export type PackageItem = {
  kind: PackageItemKind;
  id: string;
  /** YYYY-MM-DD */
  date: string;
  created_at: string;
  /** Session note / absence note / manual entry note, for the list. */
  note: string | null;
};

export function buildPackageItems(
  sessions: { id: string; date: string; created_at: string; note: string | null }[],
  attendance: Pick<
    AttendanceRecord,
    "id" | "date" | "created_at" | "reason_note" | "counts_toward_package"
  >[],
  manualEntries: PackageManualEntry[]
): PackageItem[] {
  return [
    ...sessions.map((s) => ({
      kind: "session" as const,
      id: s.id,
      date: s.date,
      created_at: s.created_at,
      note: s.note,
    })),
    ...attendance
      .filter((a) => a.counts_toward_package)
      .map((a) => ({
        kind: "absence" as const,
        id: a.id,
        date: a.date,
        created_at: a.created_at,
        note: a.reason_note,
      })),
    ...manualEntries.map((m) => ({
      kind: "manual" as const,
      id: m.id,
      date: m.date,
      created_at: m.created_at,
      note: m.note,
    })),
  ];
}

export type PackageState = {
  current: StudentPackage;
  /** The items filling the current package's circles, chronological,
   *  at most current.total_sessions long. */
  counted: PackageItem[];
  isFull: boolean;
  /** Items logged after the current package filled up — nothing has
   *  consumed them yet, so they'll fill the renewed package. */
  extras: PackageItem[];
  /** Manual entries no ended package consumed — the ones that belong to
   *  the current package and get deleted if it's cancelled. Includes
   *  any dated before the current start_date (e.g. after an edit moved
   *  it later): they don't count, but nothing else could ever use them. */
  ownedManualEntries: PackageItem[];
};

/** Chronological order for PostgREST timestamptz strings. Not
 *  localeCompare: locale collation sorts "+" after ".", so a timestamp on
 *  an exact second ("…:05+00:00") would land after "…:05.3+00:00".
 *  Date.parse only has millisecond precision, so sub-millisecond ties
 *  fall back to plain code-unit order — chronological for this fixed
 *  "+00:00" format, since PostgREST only trims trailing fraction zeros
 *  and "+" < "." < "0"-"9". */
function compareTimestamps(a: string, b: string) {
  const diff = Date.parse(a) - Date.parse(b);
  if (diff !== 0) return diff;
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareItems(a: PackageItem, b: PackageItem) {
  // YYYY-MM-DD strings compare chronologically as plain strings.
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return compareTimestamps(a.created_at, b.created_at);
}

/** Derives which items fill which package — nothing about this is stored.
 *
 *  Packages are walked oldest-first (by created_at, i.e. renewal order).
 *  Each one consumes the first `total_sessions` not-yet-consumed items
 *  dated on/after its start_date, in (date, created_at) order. An item
 *  consumed by an earlier package is never counted again, and an item
 *  no package consumed is simply left over — which is the whole carry-
 *  over mechanism: the extras after a package fills stay unconsumed
 *  until a renewed package (whose start_date is on/before the first
 *  extra, see renewalStartDate) picks them up.
 *
 *  Because it's recomputed from the current rows every time, deleting
 *  any item un-fills a circle automatically: if it was in an ended
 *  package, that package takes the next item along, and so on down the
 *  chain. Editing the current package's start_date or total_sessions
 *  works the same way — items before a later start just stop being
 *  eligible (manual entries included, exactly like logged sessions),
 *  and a smaller total fills sooner, leaving the rest as extras.
 *
 *  Ended packages only ever see items before later packages do, so
 *  editing, cancelling (deleting) the current package, or deleting an
 *  item no ended package consumed, can never change an ended package.
 *
 *  Returns null when the student has no current (un-ended) package. */
export function derivePackageState(
  packages: StudentPackage[],
  items: PackageItem[]
): PackageState | null {
  const current = packages.find((p) => p.ended_at === null);
  if (!current) return null;

  const sortedItems = [...items].sort(compareItems);
  const sortedPackages = [...packages].sort((a, b) =>
    compareTimestamps(a.created_at, b.created_at)
  );
  const consumed = new Set<string>();

  let counted: PackageItem[] = [];
  let ownedManualEntries: PackageItem[] = [];
  for (const pkg of sortedPackages) {
    if (pkg.id === current.id) {
      ownedManualEntries = sortedItems.filter(
        (item) => item.kind === "manual" && !consumed.has(item.id)
      );
    }
    const taken = sortedItems
      .filter((item) => !consumed.has(item.id) && item.date >= pkg.start_date)
      .slice(0, pkg.total_sessions);
    for (const item of taken) consumed.add(item.id);
    if (pkg.id === current.id) counted = taken;
  }

  const isFull = counted.length >= current.total_sessions;
  const extras = isFull
    ? sortedItems.filter(
        (item) => !consumed.has(item.id) && item.date >= current.start_date
      )
    : [];

  return { current, counted, isFull, extras, ownedManualEntries };
}

/** start_date for the package that replaces a full one: today, or the
 *  first extra item's date if that's earlier, so every extra logged
 *  while waiting for renewal is on/after the new start and carries over. */
export function renewalStartDate(state: PackageState, today: string): string {
  const firstExtra = state.extras[0]?.date;
  return firstExtra && firstExtra < today ? firstExtra : today;
}
