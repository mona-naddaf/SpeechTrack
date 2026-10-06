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
};

function compareItems(a: PackageItem, b: PackageItem) {
  return a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at);
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
 *  chain.
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
    a.created_at.localeCompare(b.created_at)
  );
  const consumed = new Set<string>();

  let counted: PackageItem[] = [];
  for (const pkg of sortedPackages) {
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

  return { current, counted, isFull, extras };
}

/** start_date for the package that replaces a full one: today, or the
 *  first extra item's date if that's earlier, so every extra logged
 *  while waiting for renewal is on/after the new start and carries over. */
export function renewalStartDate(state: PackageState, today: string): string {
  const firstExtra = state.extras[0]?.date;
  return firstExtra && firstExtra < today ? firstExtra : today;
}
