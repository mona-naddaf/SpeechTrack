export type Student = {
  id: string;
  name: string;
  class: string | null;
  created_at: string;
};

export type ResponseFormatType =
  | "cueing_hierarchy"
  | "correct_incorrect"
  | "rating_scale"
  | "pronunciation"
  | "open_text"
  | "behaviour_description"
  | "frequency_tally";

export type CueingLevel = {
  name: string;
  color: string;
  is_independent: boolean;
};

export type ResponseFormat = {
  id: string;
  name: string;
  type: ResponseFormatType;
  config: { levels?: CueingLevel[] } & Record<string, unknown>;
  created_at: string;
};

/** Lightweight shape used for dropdown options (goal form, etc.). */
export type ResponseFormatOption = {
  id: string;
  name: string;
};

export type Area = {
  id: string;
  name: string;
};

export type GoalStatus = "active" | "on_hold" | "mastered";

export type Goal = {
  id: string;
  student_id: string | null;
  area_id: string;
  text: string;
  response_format_id: string | null;
  baseline: string | null;
  target_percent: number | null;
  status: GoalStatus;
  created_at: string;
};

/** A goal row joined with its area and response format for display. */
export type GoalWithRelations = Goal & {
  area: { id: string; name: string } | null;
  response_format: { id: string; name: string } | null;
};

/** A goal-bank template (student_id is null) — just enough to list/pick from. */
export type BankGoal = {
  id: string;
  area_id: string;
  text: string;
};

export type SessionRecord = {
  id: string;
  student_id: string;
  date: string;
  note: string | null;
  created_at: string;
};

export type Trial = {
  id: string;
  goal_id: string;
  value: Record<string, unknown>;
  created_at: string;
};

/** A goal as needed on the session-logging page: just enough to render
 *  its trial-entry widget (cueing levels, or a correct/incorrect fallback). */
export type SessionGoal = {
  id: string;
  text: string;
  area: { id: string; name: string } | null;
  response_format: {
    id: string;
    name: string;
    type: ResponseFormatType;
    config: { levels?: CueingLevel[] } & Record<string, unknown>;
  } | null;
};

export type HomePracticeItem = {
  id: string;
  what_to_practice: string;
  how_to_practice: string | null;
  last_worked_date: string | null;
  created_at: string;
};

/** A snapshot of a home practice item at the moment it was logged —
 *  stored directly in practice_logs.activities so history stays readable
 *  even if the item is later edited or deleted. */
export type PracticeActivity = {
  id: string;
  text: string;
};

export type HowItWent = "great" | "okay" | "tricky";

export type PraiseMessage = {
  id: string;
  message: string;
  created_at: string;
};

export type PracticeLog = {
  id: string;
  date: string;
  activities: PracticeActivity[];
  how_it_went: HowItWent;
  note: string | null;
  created_at: string;
};

export type PracticeLogWithPraise = PracticeLog & {
  praise: PraiseMessage[];
};
