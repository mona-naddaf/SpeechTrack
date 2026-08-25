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

/** Config shape for a "rating_scale" format: a custom inclusive numeric range. */
export type RatingScaleConfig = {
  min: number;
  max: number;
};

/** Config shape for a "correct_incorrect" format: optionally customized labels. */
export type CorrectIncorrectConfig = {
  correctLabel?: string;
  incorrectLabel?: string;
};

export type ResponseFormat = {
  id: string;
  name: string;
  type: ResponseFormatType;
  config: { levels?: CueingLevel[] } & Partial<RatingScaleConfig> &
    CorrectIncorrectConfig &
    Record<string, unknown>;
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

/** A goal-bank template (student_id is null) — just enough to list/pick from,
 *  plus the optional defaults it can hand off when picked for a student. */
export type BankGoal = {
  id: string;
  area_id: string;
  text: string;
  response_format_id: string | null;
  target_percent: number | null;
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
    config: { levels?: CueingLevel[] } & Partial<RatingScaleConfig> &
      CorrectIncorrectConfig &
      Record<string, unknown>;
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

// ============================================================
// Assessment builder + administering
// ============================================================

export type AssessmentQuestionResponseType =
  | "right_wrong"
  | "transcription"
  | "free_text";

export type AssessmentKind = "screening" | "assessment";
export type AssessmentFormality = "formal" | "informal";

export type Assessment = {
  id: string;
  name: string;
  description: string | null;
  kind: AssessmentKind | null;
  formality: AssessmentFormality | null;
  created_at: string;
};

/** An assessment joined with the areas it covers (via assessment_areas) —
 *  used anywhere the metadata badges are shown (toolkit list, run picker). */
export type AssessmentWithAreas = Assessment & {
  areas: Area[];
};

export type AssessmentQuestion = {
  id: string;
  assessment_id: string;
  order_index: number;
  prompt: string;
  response_type: AssessmentQuestionResponseType;
  expected_answer: string | null;
  notes: string | null;
  created_at: string;
};

export type AssessmentStatus = "in_progress" | "completed";

export type AssessmentResult = {
  id: string;
  student_id: string;
  assessment_id: string;
  date: string;
  status: AssessmentStatus;
  created_at: string;
  completed_at: string | null;
};

/** A result row joined with its assessment's name — for lists on the
 *  student page (in-progress / past assessments). */
export type AssessmentResultWithAssessment = AssessmentResult & {
  assessment: { id: string; name: string } | null;
};

/** Answer value shapes, by response type:
 *  - right_wrong: {correct: boolean}
 *  - transcription: {text: string, tag?: "correct" | "approx" | "incorrect"}
 *  - free_text: {text: string} */
export type AssessmentAnswerValue = {
  correct?: boolean;
  text?: string;
  tag?: "correct" | "approx" | "incorrect";
};

export type AssessmentAnswer = {
  id: string;
  result_id: string;
  question_id: string;
  response_type: AssessmentQuestionResponseType;
  value: AssessmentAnswerValue;
  created_at: string;
};

// ============================================================
// Teacher side — mirrors Student/Area/Goal above, but backed by
// completely separate tables (teacher_students, teacher_subjects,
// teacher_response_formats, teacher_goals). Response formats reuse
// ResponseFormat/ResponseFormatType/ResponseFormatOption as-is since the
// shape (id, name, type, config, created_at) is identical either side.
// ============================================================

export type TeacherStudent = {
  id: string;
  name: string;
  class: string | null;
  created_at: string;
};

export type TeacherSubject = {
  id: string;
  name: string;
};

export type TeacherGoal = {
  id: string;
  student_id: string | null;
  subject_id: string;
  text: string;
  response_format_id: string | null;
  baseline: string | null;
  target_percent: number | null;
  status: GoalStatus;
  created_at: string;
};

/** A teacher goal row joined with its subject and response format for display. */
export type TeacherGoalWithRelations = TeacherGoal & {
  subject: { id: string; name: string } | null;
  response_format: { id: string; name: string } | null;
};

/** A teacher goal-bank template (student_id is null) — just enough to
 *  list/pick from, plus the optional defaults it can hand off when picked
 *  for a student. */
export type TeacherBankGoal = {
  id: string;
  subject_id: string;
  text: string;
  response_format_id: string | null;
  target_percent: number | null;
};

/** A teacher goal as needed on the session-logging page — same shape as
 *  SessionGoal, but "subject" in place of "area". */
export type TeacherSessionGoal = {
  id: string;
  text: string;
  subject: { id: string; name: string } | null;
  response_format: {
    id: string;
    name: string;
    type: ResponseFormatType;
    config: { levels?: CueingLevel[] } & Partial<RatingScaleConfig> &
      CorrectIncorrectConfig &
      Record<string, unknown>;
  } | null;
};

// ============================================================
// Teacher behavior tracking
// ============================================================

export type TeacherBehaviorType = {
  id: string;
  name: string;
  color: string;
};

/** 1 = Mild, 2 = Moderate, 3 = Significant. Nullable since positive
 *  behaviors (e.g. "Great participation") don't need one. */
export type BehaviorSeverity = 1 | 2 | 3;

export type BehaviorLog = {
  id: string;
  student_id: string;
  date: string;
  behavior_type_id: string;
  severity: BehaviorSeverity | null;
  note: string | null;
  created_at: string;
};

/** A behavior log row joined with its behavior type for display. */
export type BehaviorLogWithType = BehaviorLog & {
  behavior_type: { id: string; name: string; color: string } | null;
};
