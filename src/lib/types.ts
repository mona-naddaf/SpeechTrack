/** How often the SLP/Teacher plans to log sessions for a student — drives
 *  the streak cadence in src/lib/streaks.ts. */
export type ExpectedFrequency = "daily" | "few_times_week" | "weekly";

/** Lowercase day names, matching what's stored in each scheduled_days
 *  entry's "day" field. */
export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

/** One scheduled day + time, e.g. {day: "monday", time: "14:30"} — see
 *  0029_scheduled_times_and_end_date.sql. `time` is 24-hour "HH:MM",
 *  matching an <input type="time"> value directly (no am/pm parsing
 *  needed client-side). The DB's is_valid_scheduled_days() check
 *  constraint enforces this same shape, so a row read back from
 *  Supabase is always already valid — this type is never a "maybe
 *  malformed" concern the way it would be without that constraint. */
export type ScheduledDayTime = {
  day: DayOfWeek;
  time: string;
  /** Session length in minutes — defaults to 30, but any positive
   *  number is allowed (the DB CHECK constraint caps it at 480). */
  duration_minutes: number;
};

export type Student = {
  id: string;
  name: string;
  class: string | null;
  expected_frequency: ExpectedFrequency;
  /** A single emoji, picked from src/lib/avatar.ts's curated set — null
   *  means not chosen yet, shown as a neutral placeholder icon instead. */
  avatar: string | null;
  /** Which weekdays (+ times) sessions are scheduled for — empty array
   *  means not set. */
  scheduled_days: ScheduledDayTime[];
  /** "Scheduled through" — end of term/year, e.g. 2026-06-15. Null
   *  means no end date set. */
  schedule_end_date: string | null;
  created_at: string;
};

/** A student's extended info — date of birth, homeroom teacher, parent
 *  emails, plus any custom label/value pairs. Deliberately not part of
 *  `Student` above: the dashboard list/add/edit-student modal never
 *  fetches or edits any of this, only the student page's own "Student
 *  info" section/edit modal does (see student-info-section.tsx), so its
 *  query types this data on its own rather than through the `Student`
 *  shape the dashboard uses. */
export type StudentCustomField = {
  id: string;
  student_id: string;
  label: string;
  value: string;
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

/** "shared" doesn't mean browsable by anyone yet (that's a later step) —
 *  right now it's just a flag that marks an item ready for when that
 *  ships, same as MaterialVisibility's "shared" below. */
export type ShareVisibility = "private" | "shared";

export type ResponseFormat = {
  id: string;
  name: string;
  type: ResponseFormatType;
  config: { levels?: CueingLevel[] } & Partial<RatingScaleConfig> &
    CorrectIncorrectConfig &
    Record<string, unknown>;
  visibility: ShareVisibility;
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
  /** SLP-controlled: shows this goal's progress on the parent dashboard. */
  visible_to_parent: boolean;
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

export type MaterialVisibility = ShareVisibility | "for_sale";

export type Material = {
  id: string;
  title: string;
  url: string;
  description: string | null;
  area_id: string;
  visibility: MaterialVisibility;
  created_at: string;
};

/** A material row joined with its area and the ids of any goals it's
 *  linked to (via material_goals) — for the materials toolkit page and
 *  the goal-card link chips on a student page. */
export type MaterialWithRelations = Material & {
  area: { id: string; name: string } | null;
  goal_ids: string[];
};

/** A goal option for the materials page's "link to goals" picker —
 *  labeled by student (or left unset for a goal-bank template) plus
 *  area, so goals with the same text across students stay distinct. */
export type MaterialGoalOption = {
  id: string;
  text: string;
  area: { id: string; name: string } | null;
  student: { id: string; name: string } | null;
};

/** The minimal shape a goal card needs to render its linked-material
 *  chips — see MaterialChips. */
export type MaterialChip = {
  id: string;
  title: string;
  url: string;
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
  /** Set when this goal was created by picking "From goal bank" —
   *  points at the bank template it came from. Null for freehand goals
   *  and for any goal created before this column existed. Lets the
   *  session material picker resolve linked materials through the bank
   *  template, not just this one student's specific goal row. */
  source_bank_goal_id: string | null;
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
  | "free_text"
  | "custom_choice";

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
  /** Custom option labels for a "custom_choice" question (e.g. ["Present",
   *  "Emerging", "Absent"]) — null/unused for every other response_type. */
  choices: string[] | null;
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
 *  - free_text: {text: string}
 *  - custom_choice: {text: string} — the selected label, verbatim from the
 *    question's own `choices` list */
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
  expected_frequency: ExpectedFrequency;
  /** A single emoji, picked from src/lib/avatar.ts's curated set — null
   *  means not chosen yet, shown as a neutral placeholder icon instead. */
  avatar: string | null;
  /** Which weekdays (+ times) sessions are scheduled for — empty array
   *  means not set. */
  scheduled_days: ScheduledDayTime[];
  /** "Scheduled through" — end of term/year, e.g. 2026-06-15. Null
   *  means no end date set. */
  schedule_end_date: string | null;
  created_at: string;
};

/** Teacher-side mirror of StudentCustomField above — same "not part of
 *  TeacherStudent" reasoning applies. */
export type TeacherStudentCustomField = {
  id: string;
  student_id: string;
  label: string;
  value: string;
  created_at: string;
};

// ============================================================
// Attendance — a single shared table (attendance_records) for both the
// SLP and Teacher sides, unlike everything else in this file. Exactly
// one of slp_id/teacher_id is set per row at the database level; the
// app-facing shape here doesn't even need to carry those columns since
// every read is already scoped to "my own records" by RLS.
// ============================================================

export type AttendanceReason = "sick" | "vacation" | "school_event" | "other";

export type AttendanceRecord = {
  id: string;
  student_id: string;
  date: string;
  reason: AttendanceReason | null;
  reason_note: string | null;
  created_at: string;
};

// ============================================================
// Schedule events -- standalone calendar entries (a meeting, or
// anything else not tied to a student) shown on the Schedule page
// alongside scheduled student sessions. Same shared-table shape as
// AttendanceRecord above (schedule_events, from
// 0031_schedule_events.sql): exactly one of slp_id/teacher_id is set at
// the DB level, and every read is already scoped to "my own events" by
// RLS, so neither column needs to appear in this app-facing shape.
// ============================================================

export type ScheduleEvent = {
  id: string;
  title: string;
  /** YYYY-MM-DD -- a single occurrence, not a recurring pattern like
   *  scheduled_days. */
  date: string;
  /** "HH:MM", 24h -- same convention as ScheduledDayTime.time. */
  start_time: string;
  duration_minutes: number;
  note: string | null;
  /** One of src/lib/colors.ts's COLOR_OPTIONS values, or null for the
   *  default. */
  color: string | null;
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
  /** Teacher-controlled: shows this goal's progress on the parent dashboard. */
  visible_to_parent: boolean;
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

/** The Teacher equivalent of Material/MaterialWithRelations/MaterialGoalOption
 *  above — subject_id/subject in place of area_id/area, teacher_students in
 *  place of students. */
export type TeacherMaterial = {
  id: string;
  title: string;
  url: string;
  description: string | null;
  subject_id: string;
  visibility: MaterialVisibility;
  created_at: string;
};

export type TeacherMaterialWithRelations = TeacherMaterial & {
  subject: { id: string; name: string } | null;
  goal_ids: string[];
};

export type TeacherMaterialGoalOption = {
  id: string;
  text: string;
  subject: { id: string; name: string } | null;
  student: { id: string; name: string } | null;
};

/** A teacher goal as needed on the session-logging page — same shape as
 *  SessionGoal, but "subject" in place of "area". */
export type TeacherSessionGoal = {
  id: string;
  text: string;
  subject: { id: string; name: string } | null;
  /** Set when this goal was created by picking "From goal bank" —
   *  points at the bank template it came from. Null for freehand goals
   *  and for any goal created before this column existed. Lets the
   *  session material picker resolve linked materials through the bank
   *  template, not just this one student's specific goal row. */
  source_bank_goal_id: string | null;
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

// ============================================================
// SLP behavior tracking — mirrors Teacher behavior tracking above, but
// backed by behavior_types/slp_behavior_logs (separate tables; BehaviorSeverity
// is shared since the 1–3 scale means the same thing either side).
// ============================================================

export type BehaviorType = {
  id: string;
  name: string;
  color: string;
};

export type SlpBehaviorLog = {
  id: string;
  student_id: string;
  date: string;
  behavior_type_id: string;
  severity: BehaviorSeverity | null;
  note: string | null;
  created_at: string;
};

/** An SLP behavior log row joined with its behavior type for display. */
export type SlpBehaviorLogWithType = SlpBehaviorLog & {
  behavior_type: { id: string; name: string; color: string } | null;
};

// ============================================================
// Supervisor role — step 1: invite codes + links only. A Supervisor's
// read-only caseload view of a linked SLP/Teacher is a later step.
// ============================================================

export type SupervisorInviteCode = {
  id: string;
  supervisor_id: string;
  code: string;
  created_at: string;
  used_by: string | null;
  used_at: string | null;
};

export type SupervisorMemberRole = "slp" | "teacher";

export type SupervisorLink = {
  id: string;
  supervisor_id: string;
  member_id: string;
  member_role: SupervisorMemberRole;
  /** Snapshot of the member's display name taken when the link was
   *  created (see redeem_supervisor_invite_code() in
   *  0021_supervisor_role_and_links.sql) — not kept in sync with later
   *  name changes. */
  member_name: string;
  created_at: string;
};

// ============================================================
// Community sharing — step 2: browse/discovery of every 'shared' row
// across accounts on the same side. Each shape below adds an owner id
// (slp_id/teacher_id) and drops fields a browse card never needs
// (baseline, status, visible_to_parent, ...) from the equivalent
// bank-goal/format/material shape elsewhere in this file. `author`
// is populated separately via get_shared_item_authors() — see
// src/components/community-browse.tsx.
// ============================================================

export type CommunityAuthor = { id: string; display_name: string };

/** The response-format side of a browsed goal, joined in *only* if that
 *  format is itself visibility: 'shared' — response_formats/
 *  teacher_response_formats carry their own RLS policy, so a goal that
 *  references a still-private format simply embeds null here for
 *  everyone but its owner. type/config (not just id/name) are included
 *  because "Add to my bank" needs the full format to copy, not just
 *  display it. */
type SharedGoalResponseFormat = {
  id: string;
  name: string;
  type: ResponseFormatType;
  config: ResponseFormat["config"];
};

export type SharedGoalRow = {
  id: string;
  slp_id: string;
  area_id: string;
  text: string;
  response_format_id: string | null;
  target_percent: number | null;
  created_at: string;
  area: { id: string; name: string } | null;
  response_format: SharedGoalResponseFormat | null;
};

export type TeacherSharedGoalRow = {
  id: string;
  teacher_id: string;
  subject_id: string;
  text: string;
  response_format_id: string | null;
  target_percent: number | null;
  created_at: string;
  subject: { id: string; name: string } | null;
  response_format: SharedGoalResponseFormat | null;
};

export type SharedResponseFormatRow = {
  id: string;
  slp_id: string;
  name: string;
  type: ResponseFormatType;
  config: ResponseFormat["config"];
  created_at: string;
};

export type TeacherSharedResponseFormatRow = Omit<
  SharedResponseFormatRow,
  "slp_id"
> & {
  teacher_id: string;
};

export type SharedMaterialRow = {
  id: string;
  slp_id: string;
  title: string;
  url: string;
  description: string | null;
  area_id: string;
  created_at: string;
  area: { id: string; name: string } | null;
};

export type TeacherSharedMaterialRow = {
  id: string;
  teacher_id: string;
  title: string;
  url: string;
  description: string | null;
  subject_id: string;
  created_at: string;
  subject: { id: string; name: string } | null;
};

/** The six item_type values a community_ratings row can carry — see
 *  0027_community_ratings.sql. One shared table for both sides:
 *  item_type itself disambiguates SLP content from Teacher content,
 *  so a 'goal' item_id and a 'teacher_goal' item_id never collide in
 *  meaning even though both are plain uuids. */
export type CommunityItemType =
  | "goal"
  | "response_format"
  | "material"
  | "teacher_goal"
  | "teacher_response_format"
  | "teacher_material";

/** One rating row, camelCased for the client — see
 *  src/components/community-browse.tsx, which fetches one array of
 *  these per tab (all sharing the same item_type within an array, so
 *  it isn't repeated per row) and derives each item's average/count/
 *  "my rating" from it. */
export type CommunityRatingRow = {
  itemId: string;
  raterId: string;
  rating: number;
};

/** One row from get_shared_item_categories() (0028_community_shared_categories.sql)
 *  — the real Area/Subject name for a shared goal or material, looked
 *  up server-side because the area/teacher_subjects tables themselves
 *  are still owner-only (see the two page.tsx callers). Covers
 *  "goal"/"material"/"teacher_goal"/"teacher_material" item types only
 *  — response formats are categorized by `type`, not a lookup table. */
export type CommunityCategoryRow = { itemId: string; categoryName: string };

/** One row from get_shared_material_linked_goals()
 *  (0028_community_shared_categories.sql) — a shared material's linked
 *  goal, included only when that goal is *also* shared (see the
 *  migration for why: an unshared linked goal can be a real student's
 *  private, assigned goal, which must never leak). A material can link
 *  to more than one goal, so this is a flat list rather than
 *  one-per-material. */
export type CommunityLinkedGoalRow = { materialId: string; goalId: string; goalText: string };
