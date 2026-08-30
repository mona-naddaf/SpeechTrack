/** One row of the custom-fields editor's form state — `id` is null for a
 *  field added during this editing session (not yet in the DB), or the
 *  existing student_custom_fields/teacher_student_custom_fields row id
 *  otherwise. */
export type CustomFieldDraft = {
  id: string | null;
  label: string;
  value: string;
};

export type CustomFieldsDiff = {
  toInsert: { label: string; value: string }[];
  toUpdate: { id: string; label: string; value: string }[];
  toDeleteIds: string[];
};

/** Reconciles the custom-field rows a student started with (`initialIds`)
 *  against what's in the form now (`current`) into insert/update/delete
 *  batches — table-agnostic, so the SLP and Teacher sides each run this
 *  against their own table. A row with a blank label or value is dropped
 *  rather than saved (matching the codebase's other "empty means don't
 *  persist it" auto-save patterns), whether it was blanked out or simply
 *  removed from the list — either way its id (if it had one) ends up in
 *  toDeleteIds. */
export function diffCustomFields(
  initialIds: string[],
  current: CustomFieldDraft[]
): CustomFieldsDiff {
  const kept = current
    .map((f) => ({ id: f.id, label: f.label.trim(), value: f.value.trim() }))
    .filter((f) => f.label && f.value);

  const toInsert = kept
    .filter((f) => f.id === null)
    .map((f) => ({ label: f.label, value: f.value }));

  const toUpdate = kept.filter(
    (f): f is { id: string; label: string; value: string } => f.id !== null
  );

  const keptIds = new Set(toUpdate.map((f) => f.id));
  const toDeleteIds = initialIds.filter((id) => !keptIds.has(id));

  return { toInsert, toUpdate, toDeleteIds };
}
