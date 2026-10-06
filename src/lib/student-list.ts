import { DAYS_OF_WEEK } from "./schedule";
import type { DayOfWeek, ScheduledDayTime, StudentStatus } from "./types";

export const STUDENT_STATUSES: StudentStatus[] = ["active", "trial", "stopped"];

export const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  active: "Active",
  trial: "Trial",
  stopped: "Stopped",
};

export type StudentSort =
  | "name_asc"
  | "name_desc"
  | "schedule"
  | "start_oldest"
  | "start_newest";

export const STUDENT_SORT_LABELS: Record<StudentSort, string> = {
  name_asc: "Name (A to Z)",
  name_desc: "Name (Z to A)",
  schedule: "First scheduled day",
  start_oldest: "Start date (oldest first)",
  start_newest: "Start date (newest first)",
};

export type StudentListFilters = {
  tagIds: string[];
  days: DayOfWeek[];
  statuses: StudentStatus[];
};

export const EMPTY_FILTERS: StudentListFilters = { tagIds: [], days: [], statuses: [] };

/** The fields sorting/filtering/counting need — satisfied by both
 *  Student and TeacherStudent plus their tag ids. */
export type ListableStudent = {
  id: string;
  name: string;
  status: StudentStatus;
  archived_at: string | null;
  started_on: string | null;
  scheduled_days: ScheduledDayTime[];
  tagIds: string[];
};

export function hasActiveFilters(f: StudentListFilters) {
  return f.tagIds.length > 0 || f.days.length > 0 || f.statuses.length > 0;
}

/** Each filter type that has any selection must match (AND across
 *  types); within a type, any selected value matches (OR). */
export function matchesFilters(s: ListableStudent, f: StudentListFilters) {
  if (f.tagIds.length > 0 && !s.tagIds.some((id) => f.tagIds.includes(id))) {
    return false;
  }
  if (f.days.length > 0 && !s.scheduled_days.some((d) => f.days.includes(d.day))) {
    return false;
  }
  if (f.statuses.length > 0 && !f.statuses.includes(s.status)) {
    return false;
  }
  return true;
}

/** Monday-first position of a student's earliest scheduled slot, as a
 *  sortable number (day index, then HH:MM) — null with no schedule. A
 *  slot with no time sorts after timed slots on the same day. */
function firstScheduledKey(days: ScheduledDayTime[]): number | null {
  let best: number | null = null;
  for (const d of days) {
    const dayIndex = DAYS_OF_WEEK.indexOf(d.day);
    if (dayIndex < 0) continue;
    const [h, m] = (d.time || "").split(":").map(Number);
    const minutes = Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 24 * 60;
    const key = dayIndex * 10000 + minutes;
    if (best === null || key < best) best = key;
  }
  return best;
}

function byName(a: ListableStudent, b: ListableStudent) {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

/** Missing values (no schedule / no start date) always go last, in
 *  either direction; ties fall back to name A→Z. */
export function sortStudents<T extends ListableStudent>(list: T[], sort: StudentSort): T[] {
  const out = [...list];
  switch (sort) {
    case "name_asc":
      return out.sort(byName);
    case "name_desc":
      return out.sort((a, b) => byName(b, a));
    case "schedule":
      return out.sort((a, b) => {
        const ka = firstScheduledKey(a.scheduled_days);
        const kb = firstScheduledKey(b.scheduled_days);
        if (ka === null || kb === null) {
          if (ka !== kb) return ka === null ? 1 : -1;
          return byName(a, b);
        }
        return ka - kb || byName(a, b);
      });
    case "start_oldest":
    case "start_newest":
      return out.sort((a, b) => {
        if (!a.started_on || !b.started_on) {
          if (a.started_on !== b.started_on) return a.started_on ? -1 : 1;
          return byName(a, b);
        }
        if (a.started_on === b.started_on) return byName(a, b);
        const asc = a.started_on < b.started_on ? -1 : 1;
        return sort === "start_oldest" ? asc : -asc;
      });
  }
}

export type StudentListCounts = {
  /** Active, non-archived students matching the filters. */
  activeStudents: number;
  /** Logged sessions belonging to those students. */
  activeSessions: number;
  trial: number;
  stopped: number;
  archived: number;
};

/** The count strip: only Active (non-archived) students and their
 *  sessions are counted; Trial / Stopped / Archived students matching
 *  the same filters are tallied separately for the "not counted" note. */
export function computeCounts(
  students: ListableStudent[],
  filters: StudentListFilters,
  sessionCountByStudentId: Record<string, number>
): StudentListCounts {
  const counts: StudentListCounts = {
    activeStudents: 0,
    activeSessions: 0,
    trial: 0,
    stopped: 0,
    archived: 0,
  };
  for (const s of students) {
    if (!matchesFilters(s, filters)) continue;
    if (s.archived_at) counts.archived++;
    else if (s.status === "trial") counts.trial++;
    else if (s.status === "stopped") counts.stopped++;
    else {
      counts.activeStudents++;
      counts.activeSessions += sessionCountByStudentId[s.id] ?? 0;
    }
  }
  return counts;
}

/** Stopped and Archived students drop off the Schedule, streak nudges
 *  and caseload wins; Trial students stay (they're still being seen). */
export function isStillBeingSeen(s: { status: StudentStatus; archived_at: string | null }) {
  return s.status !== "stopped" && !s.archived_at;
}

/** Saved sort + filter choices, persisted to localStorage the same way
 *  SectionPreferencesProvider persists section order/collapse. Anything
 *  unrecognised in a saved value (an old sort key, a deleted tag) is
 *  dropped rather than trusted. */
export type StudentListPrefs = { sort: StudentSort; filters: StudentListFilters };

export const DEFAULT_LIST_PREFS: StudentListPrefs = { sort: "name_asc", filters: EMPTY_FILTERS };

export function parseListPrefs(raw: string | null, validTagIds: Set<string>): StudentListPrefs {
  if (!raw) return DEFAULT_LIST_PREFS;
  try {
    const saved = JSON.parse(raw) as Partial<StudentListPrefs>;
    const sort =
      saved.sort && saved.sort in STUDENT_SORT_LABELS ? saved.sort : DEFAULT_LIST_PREFS.sort;
    const f = saved.filters ?? EMPTY_FILTERS;
    return {
      sort,
      filters: {
        tagIds: (f.tagIds ?? []).filter((id) => validTagIds.has(id)),
        days: (f.days ?? []).filter((d) => DAYS_OF_WEEK.includes(d)),
        statuses: (f.statuses ?? []).filter((st) => STUDENT_STATUSES.includes(st)),
      },
    };
  } catch {
    return DEFAULT_LIST_PREFS;
  }
}
