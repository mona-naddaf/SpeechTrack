import type {
  Area,
  Material,
  MaterialChip,
  MaterialVisibility,
  MaterialWithRelations,
  TeacherMaterial,
  TeacherMaterialWithRelations,
  TeacherSubject,
} from "./types";

export const MATERIAL_VISIBILITY_LABELS: Record<MaterialVisibility, string> = {
  private: "Private",
  shared: "Shared",
  for_sale: "For sale",
};

export const MATERIAL_VISIBILITY_CLASSES: Record<MaterialVisibility, string> = {
  private: "bg-stone-100 text-stone-600",
  shared: "bg-stone-100 text-stone-400",
  for_sale: "bg-stone-100 text-stone-400",
};

/** Only "private" actually does anything right now — "shared" and
 *  "for_sale" are shown in the visibility picker so she can see what's
 *  ahead, but aren't selectable yet and are saved as "private" either way. */
export const MATERIAL_VISIBILITY_COMING_SOON: Record<MaterialVisibility, boolean> = {
  private: false,
  shared: true,
  for_sale: true,
};

export const MATERIAL_VISIBILITY_OPTIONS: MaterialVisibility[] = [
  "private",
  "shared",
  "for_sale",
];

/** Basic sanity check for a material link: must parse as an absolute
 *  http(s) URL. Doesn't try to verify it resolves — just that it's well
 *  formed enough (has a scheme) to be worth saving. */
export function isLikelyHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Label for one entry in the "link to goals" picker — who it belongs to
 *  (or "Goal bank" for an unassigned template) plus the goal text, so
 *  goals with similar wording across students stay distinguishable.
 *  Structurally typed so it works for both MaterialGoalOption and
 *  TeacherMaterialGoalOption. */
export function formatGoalOptionLabel(goal: {
  text: string;
  student: { name: string } | null;
}): string {
  const who = goal.student ? goal.student.name : "Goal bank";
  return `${who} — ${goal.text}`;
}

/** Raw shape of a `materials` row selected with `area:areas(id, name)` and
 *  `material_goals(goal_id)` joins. */
export type RawMaterialJoin = Material & {
  area: { id: string; name: string } | Area[] | null;
  material_goals: { goal_id: string }[] | null;
};

/** Flattens the nested area/material_goals joins into MaterialWithRelations —
 *  same postgrest-js to-one-relation quirk noted in assessment.ts (no
 *  generated Database types), handled the same way. */
export function flattenMaterialJoins(
  rows: RawMaterialJoin[]
): MaterialWithRelations[] {
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    url: row.url,
    description: row.description,
    area_id: row.area_id,
    visibility: row.visibility,
    created_at: row.created_at,
    area: Array.isArray(row.area) ? (row.area[0] ?? null) : row.area,
    goal_ids: (row.material_goals ?? []).map((g) => g.goal_id),
  }));
}

/** Raw shape of a `teacher_materials` row selected with
 *  `subject:teacher_subjects(id, name)` and `teacher_material_goals(goal_id)` joins. */
export type RawTeacherMaterialJoin = TeacherMaterial & {
  subject: { id: string; name: string } | TeacherSubject[] | null;
  teacher_material_goals: { goal_id: string }[] | null;
};

export function flattenTeacherMaterialJoins(
  rows: RawTeacherMaterialJoin[]
): TeacherMaterialWithRelations[] {
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    url: row.url,
    description: row.description,
    subject_id: row.subject_id,
    visibility: row.visibility,
    created_at: row.created_at,
    subject: Array.isArray(row.subject) ? (row.subject[0] ?? null) : row.subject,
    goal_ids: (row.teacher_material_goals ?? []).map((g) => g.goal_id),
  }));
}

/** Raw shape of a `material_goals`/`teacher_material_goals` row selected
 *  with a nested `material:materials(id, title, url)` join — used to build
 *  the goal-card chips on a student page (see MaterialChips). */
export type RawGoalMaterialLink = {
  goal_id: string;
  material: MaterialChip | MaterialChip[] | null;
};

/** Groups goal->material links by goal id for quick lookup while
 *  rendering a list of goal cards. Works for both the SLP and Teacher
 *  join tables since the row shape (after the `material:` alias) is
 *  identical either side. */
export function groupMaterialChipsByGoalId(
  rows: RawGoalMaterialLink[]
): Record<string, MaterialChip[]> {
  const byGoalId: Record<string, MaterialChip[]> = {};
  for (const row of rows) {
    const material = Array.isArray(row.material)
      ? (row.material[0] ?? null)
      : row.material;
    if (!material) continue;
    (byGoalId[row.goal_id] ??= []).push(material);
  }
  return byGoalId;
}

/** Resolves each goal's linked materials the way they're actually meant
 *  to be found: a material linked directly to this exact goal row, OR
 *  linked to the bank template this goal was created from
 *  (`source_bank_goal_id`) — so a material tied to a bank goal on
 *  /toolkit/materials shows up for every student who's been assigned
 *  that bank goal, not just one specific student-goal row. Freehand
 *  goals (no bank origin) only ever match on the direct link. Used by
 *  both the goal-card chips (student page) and the session material
 *  picker — same resolution either place. */
export function resolveMaterialChipsByGoal(
  goals: { id: string; source_bank_goal_id: string | null }[],
  rows: RawGoalMaterialLink[]
): Record<string, MaterialChip[]> {
  const byLinkedGoalId = groupMaterialChipsByGoalId(rows);

  const result: Record<string, MaterialChip[]> = {};
  for (const goal of goals) {
    const direct = byLinkedGoalId[goal.id] ?? [];
    const viaBank = goal.source_bank_goal_id
      ? (byLinkedGoalId[goal.source_bank_goal_id] ?? [])
      : [];
    const combined = [...direct, ...viaBank];
    if (combined.length > 0) result[goal.id] = combined;
  }
  return result;
}
