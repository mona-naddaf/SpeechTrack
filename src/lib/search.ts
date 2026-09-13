/** Case-insensitive, partial-match text search — the one rule every goal
 *  search box in the app follows, so "matches" means the same thing
 *  everywhere it's used (student-page "Set a goal" bank picker, the Goal
 *  Bank toolkit page, Community browse's Goals section, and the
 *  bulk-assign-from-bank picker). An empty/whitespace-only query matches
 *  everything, so callers can pass it straight through without a
 *  separate "no query" branch. */
export function matchesSearch(text: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return text.toLowerCase().includes(q);
}
