/** Table/column names for one side's goal bank — the only thing that
 *  differs between the SLP (/toolkit/goals) and Teacher
 *  (/teacher/toolkit/goals) banks, which share GoalBankSection. */
export type GoalBankConfig = {
  categoryLabel: "Area" | "Subject";
  goalsTable: "goals" | "teacher_goals";
  categoryTable: "areas" | "teacher_subjects";
  categoryIdColumn: "area_id" | "subject_id";
  formatsTable: "response_formats" | "teacher_response_formats";
  materialGoalsTable: "material_goals" | "teacher_material_goals";
  ownerColumn: "slp_id" | "teacher_id";
};

export const SLP_GOAL_BANK: GoalBankConfig = {
  categoryLabel: "Area",
  goalsTable: "goals",
  categoryTable: "areas",
  categoryIdColumn: "area_id",
  formatsTable: "response_formats",
  materialGoalsTable: "material_goals",
  ownerColumn: "slp_id",
};

export const TEACHER_GOAL_BANK: GoalBankConfig = {
  categoryLabel: "Subject",
  goalsTable: "teacher_goals",
  categoryTable: "teacher_subjects",
  categoryIdColumn: "subject_id",
  formatsTable: "teacher_response_formats",
  materialGoalsTable: "teacher_material_goals",
  ownerColumn: "teacher_id",
};
