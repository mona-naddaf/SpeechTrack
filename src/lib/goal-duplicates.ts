/** Duplicate detection for bank goals. Two goals are "possible
 *  duplicates" when their text matches after trimming, lowercasing,
 *  collapsing whitespace and removing trailing punctuation — compared
 *  across every area/subject. Shared by the goal bank page and the Excel
 *  import summary. */

export function normalizeGoalText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[\s.,;:!?…]+$/u, "")
    .trim();
}

export type DuplicateCandidate = {
  id: string;
  text: string;
  created_at: string;
  categoryName: string;
};

export type DuplicateInfo = {
  /** Goal id → the area/subject names of its other copies (one entry per
   *  other copy, so two copies in the same area show that area twice). */
  othersById: Map<string, string[]>;
  /** Normalized text → every goal sharing it (2+), oldest first. */
  groups: DuplicateCandidate[][];
};

function oldestFirst(a: DuplicateCandidate, b: DuplicateCandidate) {
  return a.created_at.localeCompare(b.created_at) || (a.id < b.id ? -1 : 1);
}

export function findDuplicates(goals: DuplicateCandidate[]): DuplicateInfo {
  const byKey = new Map<string, DuplicateCandidate[]>();
  for (const g of goals) {
    const key = normalizeGoalText(g.text);
    if (!key) continue;
    (byKey.get(key) ?? byKey.set(key, []).get(key)!).push(g);
  }
  const groups = [...byKey.values()]
    .filter((list) => list.length > 1)
    .map((list) => [...list].sort(oldestFirst));
  const othersById = new Map<string, string[]>();
  for (const group of groups) {
    for (const g of group) {
      othersById.set(
        g.id,
        group.filter((o) => o.id !== g.id).map((o) => o.categoryName)
      );
    }
  }
  return { othersById, groups };
}

/** Every copy except the oldest in each duplicate group — what "Select
 *  duplicates" selects, so deleting them leaves exactly one of each. */
export function extraCopyIds(info: DuplicateInfo): string[] {
  return info.groups.flatMap((group) => group.slice(1).map((g) => g.id));
}

/** "Also in Articulation" / "Also in Articulation and Fluency" / "Also
 *  in Articulation (2 copies)". */
export function describeOtherCopies(names: string[]): string {
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  const parts = [...counts.entries()].map(([n, c]) => (c > 1 ? `${n} (${c} copies)` : n));
  const list =
    parts.length <= 1
      ? parts.join("")
      : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `Also in ${list}`;
}
