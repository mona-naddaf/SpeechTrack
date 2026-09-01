# BloomTrack

Next.js (App Router) + Supabase + Tailwind starter.

## What's here

- **Landing page** (`/`) — app name + "Sign in" button.
- **Auth** (`/login`) — a "Who's signing in today?" chooser (**SLP** / **Teacher** / **Parent**) rather than one generic sign-in. Parent goes straight to `/parent`'s access-code flow. SLP and Teacher both lead to the same email/password sign-in/sign-up form, framed for whichever was picked (icon, subtitle) — sign-up additionally asks "Are you a Speech-Language Pathologist or a Teacher?" as a required field alongside full name/email/password, which sets the account's **role**. After sign-in, routing always follows the account's actual stored role (not just which chooser button was clicked): SLP → `/dashboard`, Teacher → `/teacher/dashboard`.
- **Protected dashboard** (`/dashboard`) — SLP-only: redirects Teacher accounts to `/teacher/dashboard`, and redirects to `/login` if not authenticated (enforced in middleware *and* in the page itself). Greets the signed-in SLP by name ("Welcome, Mona") and lists their students with add/edit/delete. Any account without a name yet (pre-dating the full-name field) gets a one-time-per-login prompt to add it.
- **Teacher dashboard** (`/teacher/dashboard`) — a real student list (add/edit/delete), guarded the same way as the SLP dashboard: redirects SLP accounts to `/dashboard`, redirects to `/login` if not authenticated. Fully mirrors the SLP's students/areas/response-formats/goals feature set, but on completely separate tables (`teacher_students`, `teacher_subjects`, `teacher_response_formats`, `teacher_goals`) — Teachers and SLPs never share students or data, just this same app shell/component patterns/styling.
  - **Teacher student detail** (`/teacher/students/[id]`) — name, class, and a **Goals** section, same shape as the SLP one: subject instead of area, pick from bank or write new, baseline, target %, response format, status.
  - **Teacher subjects & formats** (`/teacher/toolkit/subjects`) — two sections on one page: **Subjects** (add/edit/delete — unlike SLP "areas", which have no CRUD UI at all, subjects are fully manageable) and **Response formats**, which reuses the exact same custom-format editor components as `/toolkit/formats` (Correct/Incorrect, Rating scale, Cueing hierarchy), just pointed at `teacher_response_formats`.
  - **Teacher goal bank** (`/teacher/toolkit/goals`) — add/edit/delete reusable goals grouped by subject, mirrors `/toolkit/goals` exactly. These show up in the "From goal bank" picker when setting a goal on a teacher's student.
  - **Teacher behavior types** (`/teacher/toolkit/behavior-types`) — add/edit/delete her own color-coded behavior tags (picking from the same color palette used elsewhere in the app), same editable-pill pattern as Subjects. Deletion is blocked with a clear message if a type has already been used to log behavior.
  - **Behavior tracking** (on a Teacher student's page) — "Log behavior" opens a quick form: date (defaults to today), behavior type, an optional severity (Mild/Moderate/Significant — click again to clear; deliberately optional rather than type-conditional, since positive behaviors just skip it), optional note. Below it: a small color-coded "Behavior trends" breakdown (count per type, most-logged first) computed from her history, then the full history list (date, type badge, severity if set, note), most recent first. No edit/delete on individual log entries yet — not asked for, easy to add later if wanted.
  - **Teacher session logging** (`/teacher/students/[id]/session/new`, from "Start session" on a Teacher student's page) — mirrors `/students/[id]/session/new` exactly: editable date, one card per active goal rendering the right widget for its response format (Correct/Incorrect toggle, rating-scale row, or cueing-hierarchy level buttons), "Undo last" per card, optional note, auto-saving every tap immediately (same pattern as the SLP side — nothing is lost if she navigates away mid-session). The student page's **Sessions** section lists past sessions (date + note, most recent first).
  - New teacher accounts are seeded on signup with a default **Correct/Incorrect** response format, 7 default subjects (Math, Reading, Writing, Spelling, Science, Social Studies, Behavior/Social-Emotional), and 5 default behavior types (Off-task, Disruptive, Outburst, Great participation, Kind to others) — the same `handle_new_user()` trigger that seeds SLP defaults, now branching on the account's role.
- **Student detail** (`/students/[id]`) — name, class, and a **Goals** section (add/edit/delete, picking an area, optionally a bank goal — which can also prefill its default response format and target % — baseline, target %, response format, status).
- **Response formats** (`/toolkit/formats`) — view the SLP's response formats; full editor for the seeded **Cueing hierarchy** (rename, add/remove levels, change colors, toggle "independent"), plus **Correct/Incorrect** (rename, customize the two labels) and **Rating scale** (rename, set a custom min–max range); "+ New custom format" creates any of those three from scratch, and any format can be renamed or deleted (deletion is blocked with a clear message if a goal still uses it). Placeholder cards remain for the other, not-yet-built format types. Every format — built-in or custom — shows up as a selectable option anywhere a response format is picked (e.g. setting a goal), and session logging renders the right widget for its type (level buttons, a numeric rating row, or a Correct/Incorrect toggle with its custom labels).
- **Goal bank** (`/toolkit/goals`) — add, edit, and delete goals that aren't tied to any student yet (area, goal text, optional default response format, optional target %), grouped by area. These show up as pickable options in the "From goal bank" flow when setting a goal on a student.
- **Behavior types** (`/toolkit/behavior-types`) — the SLP-side mirror of Teacher behavior types (line above `teacher_behavior_types`): add/edit/delete her own color-coded behavior tags, same editable-pill pattern, deletion blocked with a clear message if a type has already been used to log behavior. Seeded on signup with 5 defaults suited to speech therapy: Off-task, Frustrated, Refused task, Great effort, Positive interaction.
- **Behavior tracking** (on the student page) — mirrors the Teacher one exactly, on separate tables (`behavior_types`/`slp_behavior_logs` instead of `teacher_behavior_types`/`behavior_logs`): "Log behavior" quick form (date, type, optional severity, optional note), a color-coded "Behavior trends" breakdown, then the full history list, most recent first. Also where the "Show behavior summary to parent" toggle lives (`students.share_behavior_with_parent`).
- **Session logging** (`/students/[id]/session/new`) — "Start session" on the student page opens a live-tally logging screen: editable date, one card per active goal (colored level buttons for cueing-hierarchy goals, a numeric row for rating-scale goals, a Correct/Incorrect toggle — with custom labels if set — for everything else), an "Undo last" per card, and an optional note. Every tap auto-saves a trial immediately; "Save session" just finalizes the note/date and returns to the student page, which now lists past sessions (date + note, most recent first).
- **Progress & reports** (`/students/[id]/progress`, linked from "View progress" on the student page) — one card per goal (any status): for cueing-hierarchy goals, a level-percentage breakdown bar plus a "% independent over time" line chart; for rating-scale goals, a "% of max rating over time" chart; for everything else, a "% correct over time" chart (one point per session date). Each card shows total trial count, date range, and an auto-generated plain-language summary with a "Copy summary" button. Charts are hand-rolled inline SVG/CSS (no charting library) and render server-side — only the copy button ships client JS. "Export JSON backup" and "Export trials CSV" buttons on the student page download the student's full data client-side, no server round trip beyond the Supabase queries.
- **Home practice** (on the student page) — SLP-managed list of home-practice items (add/edit/delete), plus the student's **parent access code** with a copy button, plus a read-only **practice log** view of everything the parent has logged, where the SLP can leave a short praise note on any entry.
- **Parent view** (`/parent`, no Supabase login) — a parent types their child's 6-character access code to get in. Once in: the current home-practice items, a big-button form to log today's practice (checklist + 😄/🙂/😕 mood + optional note), and their practice history with any praise attached. Everything else is opt-in and off by default: a goal only shows up as a "Progress" card (the exact same card as the SLP/Teacher progress page — charts included) once its `visible_to_parent` is turned on, and a student (SLP or Teacher side) only gets a simple "Behavior" summary card once `share_behavior_with_parent` is on for them — see the `0011_selective_parent_sharing.sql`/`0012_slp_behavior_tracking.sql` bullets below. Still no assessments/sessions/trials/raw logs, and no *other* student, ever. See **Parent access — security approach** below.
- **Assessment builder** (`/toolkit/assessments`) — build reusable assessments from scratch: name + description, then questions (prompt, response type — Correct/Incorrect, Transcription, or Free text — optional expected answer, optional notes), add/edit/delete/reorder (↑/↓). Always private to the owning SLP — no visibility/sharing option at all, unlike goals/response formats. An assessment can be renamed/deleted like the other toolkit resources, blocked with a clear message if it's already been run against a student.
- **Running an assessment** (from a student's page, "Run assessment" → `/students/[id]/assessment/[resultId]`) — pick one of her saved assessments to start a result; every question is answerable in any order (not forced sequential), each with the right input for its type (Correct/Incorrect toggle; a transcription text field plus an optional correct/approx/incorrect tag; a plain text field), auto-saving as she goes (immediately for toggles/tags, on blur for text) — matching the auto-save pattern from session logging. Shows a live "X/Y answered" progress bar. In-progress results are resumable from the student page. "Mark complete" locks it into a **read-only report**: every question with its full recorded answer (not just a score), a summary score (right_wrong + tagged-transcription answers only; free_text listed but unscored), and a "Copy report" button for a plain-text version. The student page lists both in-progress (resume) and completed (score + link to report) results.
- **`students` table** — see `supabase/migrations/0001_students.sql`.
- **`response_formats`, `areas`, `goals` tables** — see `supabase/migrations/0002_response_formats_and_goals.sql`. A Postgres trigger seeds every new account with a default "Cueing hierarchy" format and 10 default areas. Custom response formats and bank goals (`goals.student_id is null`) reuse these same tables/columns as-is — **no migration needed** for either feature.
- **`sessions`, `trials` tables** — see `supabase/migrations/0003_sessions_and_trials.sql`.
- **`students.parent_access_code`, `home_practice_items`, `practice_logs`, `praise` tables** — see `supabase/migrations/0004_home_practice_and_parent_access.sql`.
- **SLP full name** — stored in Supabase Auth's `user_metadata.full_name`, not a table column, so this also needed **no migration**. Set at sign-up (`src/app/login/page.tsx`), updatable via `supabase.auth.updateUser({ data: { full_name } })` (`src/app/dashboard/name-prompt-modal.tsx`), read on the dashboard via `user.user_metadata.full_name`.
- **Account role (SLP/Teacher)** — same pattern again: stored in Supabase Auth's `user_metadata.role`, **no migration needed**. `src/lib/role.ts`'s `getUserRole()` is the single source of truth for reading it — any account without a role set yet (pre-dating this field) defaults to `"slp"`, so no existing account/data breaks. Set at sign-up alongside full name; each protected dashboard route re-derives the role server-side and redirects to the other one if it doesn't match, rather than trusting which chooser button was clicked at `/login`.
- **`assessments`, `assessment_questions`, `assessment_results`, `assessment_answers` tables** — see `supabase/migrations/0005_assessments.sql`. **This one needs a migration** — these are new tables, unlike the three features above.
- **`assessments.kind`/`formality`, `assessment_areas` join table** — see `supabase/migrations/0006_assessment_metadata.sql`. **Also needs a migration.** `kind`/`formality` are nullable at the DB level (existing assessments just show "not set" until edited) even though the create form requires them going forward.
- **`teacher_students`, `teacher_subjects`, `teacher_response_formats`, `teacher_goals` tables** — see `supabase/migrations/0007_teacher_students_subjects_goals.sql`. **Also needs a migration** — four new tables, same `teacher_id`-scoped RLS pattern as the SLP tables. This migration also makes `handle_new_user()` role-aware (seeds SLP defaults or Teacher defaults depending on `raw_user_meta_data->>'role'` at signup) — existing accounts are unaffected, since the trigger only fires on new signups.
- **`teacher_behavior_types`, `behavior_logs` tables** — see `supabase/migrations/0008_teacher_behavior_tracking.sql`. **Also needs a migration** — two new tables, same `teacher_id`-scoped RLS pattern. Extends `handle_new_user()` again to also seed 5 default behavior types for new Teacher accounts, and backfills them for any Teacher account created between 0007 and this migration (skips anyone who already has behavior types, so it's safe to re-run).
- **`teacher_sessions`, `teacher_trials` tables** — see `supabase/migrations/0009_teacher_sessions_trials.sql`. **Also needs a migration** — two new tables, mirroring `sessions`/`trials` exactly: `teacher_sessions` has its own `teacher_id`-scoped RLS, `teacher_trials` has no `teacher_id` column of its own and checks ownership via `teacher_sessions.teacher_id` instead (same pattern as `trials` → `sessions`).
- **`teacher_students.parent_access_code`, `teacher_home_practice_items`, `teacher_practice_logs`, `teacher_praise` tables** — see `supabase/migrations/0010_teacher_home_practice_and_parent_access.sql`. **Also needs a migration** — the Teacher-side mirror of everything in `0004_home_practice_and_parent_access.sql`, same shapes, same `teacher_id`-scoped RLS pattern for the Teacher-managed table, same service-role-only-write pattern for the log/praise tables. `generate_parent_access_code()` (shared by both `students` and `teacher_students`) is widened here to check uniqueness across both tables, so a code always resolves to exactly one student regardless of which side created it. `/parent` and its API routes check both tables and branch by which one matched, but render the identical dashboard UI either way — see "Parent access — security approach" below.
- **`goals.visible_to_parent`, `teacher_goals.visible_to_parent`, `teacher_students.share_behavior_with_parent`** — see `supabase/migrations/0011_selective_parent_sharing.sql`. **Also needs a migration** — three added boolean columns (all default `false`), nothing structurally new: no new tables, no RLS changes, since the existing owner-scoped update policies on `goals`/`teacher_goals`/`teacher_students` already cover any column on those rows, and `/parent` already reads everything through the RLS-bypassing service-role client. The SLP/Teacher toggles these per-goal ("Show progress to parent") and per-student ("Show behavior summary to parent") on the student page, saved immediately on change. `/parent` shows a "Progress" section built from `buildGoalReport()` (`src/lib/progress.ts`) filtered to only `visible_to_parent` goals, rendered with the exact same card component the SLP/Teacher progress page uses (`src/app/students/[id]/progress/goal-progress-card.tsx` — level breakdown, trend chart, written summary, "Copy summary" button, all identical; extracted out of the SLP progress page and cross-imported by both the Teacher progress page and `/parent` so there's only one card to keep in sync). Teacher students additionally get a "Behavior" section (only when `share_behavior_with_parent` is on) — a friendly count-by-type breakdown of `behavior_logs` from the last 30 days, no severity or notes; this one *is* a simplified parent-only view, unlike Progress. Either section is omitted entirely (not shown empty) when nothing's been shared yet, so existing parent dashboards are unaffected until an SLP/Teacher opts something in.
- **`behavior_types`, `slp_behavior_logs` tables, `students.share_behavior_with_parent`** — see `supabase/migrations/0012_slp_behavior_tracking.sql`. **Also needs a migration** — the SLP-side mirror of `0008_teacher_behavior_tracking.sql` (same `slp_id`-scoped RLS pattern, same 5-defaults-on-signup seeding, adjusted for speech therapy: Off-task, Frustrated, Refused task, Great effort, Positive interaction; backfills existing SLP accounts the same "skip anyone who already has rows" way) plus the SLP equivalent of `teacher_students.share_behavior_with_parent`. `/parent`'s Behavior section (`src/app/parent/behavior-section.tsx`, `buildBehaviorBreakdown()` in `src/app/parent/page.tsx`) is unchanged by this migration — it already branched on student type for every other table, so it just gained a second real branch instead of an always-empty one.
- **Celebrations** — two small confetti touches, **no migration needed**, purely UI. (1) Editing a goal's status to "Mastered" (SLP or Teacher student page) fires a confetti burst plus a "🎉 Goal mastered!" toast, once per actual transition into that status — re-saving an already-mastered goal doesn't retrigger it (`goals-section.tsx` on each side compares the pre-edit status to the new one before firing). (2) A parent submitting a practice log on `/parent` gets the same confetti plus a warm message picked at random from a small set, so logging more than once a day doesn't feel repetitive. Both share `src/lib/confetti.ts` (dynamically imports **canvas-confetti** — new dependency, ~lightweight, added only where these two triggers use it — so it doesn't add to every other page's bundle) and `src/components/celebration-toast.tsx` (a brief, auto-dismissing, centered toast; respects `prefers-reduced-motion`).
- **`students.expected_frequency`, `teacher_students.expected_frequency`** — see `supabase/migrations/0013_streak_tracking.sql`. **Also needs a migration** — one added text column per table (`'daily' | 'few_times_week' | 'weekly'`, default `'weekly'`, CHECK-constrained), set from a new field on the add/edit-student modal on both sides. No new tables and no RLS changes — streaks aren't stored anywhere, they're computed fresh on every page load by the one shared `computeCadenceStreak()` in `src/lib/streaks.ts`, from whichever session/practice-log dates are already being fetched for that page. Same function serves three call sites: the SLP student page (`sessions` + the student's own `expected_frequency`), the Teacher student page (`teacher_sessions` + `teacher_students.expected_frequency`), and the parent dashboard (`practice_logs`/`teacher_practice_logs`, always at a fixed `"daily"` cadence — literally the same "daily" branch the other two can also choose). "Daily" counts consecutive calendar days; "weekly"/"few_times_week" count consecutive calendar weeks needing 1 or 2 entries each — either way, the *current* day/week is allowed to still be pending without breaking the streak. `getMilestoneEmoji()`/`isMilestoneStreak()` (same file) hold the shared tier table (5 → ❤️, 10 → ⭐, 15 → 🔥, 20 → 🏆, 25 → 🌈, 30 → 👑, then every +10 → 🎉) reused by both sides. The shared `src/components/streak-badge.tsx` renders the emoji + a caller-supplied label and fires the existing confetti celebration exactly once per newly-reached milestone, remembering the last-celebrated streak per student in `localStorage` (keyed separately per side, e.g. `slp-session-streak:<id>` vs. `parent-practice-streak:<id>`) so a page reload at the same streak count doesn't replay it.
- **Dashboard personalization** — see `supabase/migrations/0014_dashboard_personalization.sql`. **Also needs a migration**: `students.avatar`/`teacher_students.avatar` (nullable text, an optional single emoji from a curated ~28-option set in `src/lib/avatar.ts`, picked via `src/components/avatar-picker.tsx` on the add/edit-student modal), plus `goals.mastered_at`/`teacher_goals.mastered_at` (nullable timestamptz — set/cleared by `goals-section.tsx` on each side at the exact same status-transition point that already fires the mastery confetti, and deliberately **not backfilled** for goals already sitting at "mastered" before this migration, since there's no record of when that happened). No RLS changes either way. Three small dashboard features built on top: (1) **avatar** — `src/components/avatar-badge.tsx` renders the chosen emoji or a neutral placeholder icon, reused on the dashboard list, student page header, and session page on both sides. (2) **Caseload wins** — a light stat-chip card (`src/components/caseload-wins-card.tsx`, renders nothing if there's nothing to show yet) on both dashboards: goals mastered in the last 30 days (`mastered_at` filter), the longest current streak on the caseload, and sessions logged this calendar week — all computed by `src/lib/caseload.ts` from one query each for that dashboard's sessions and mastered-goal count (RLS already scopes both without an explicit owner filter). (3) **Streak-at-risk nudges** — `isStreakAtRisk()` (`src/lib/streaks.ts`) flags a student whose active streak hasn't met its cadence yet and is genuinely close to breaking (today, for "daily"; the last ~2 days of the week, for the weekly cadences — not just "any day nothing's logged yet", which would nag constantly), and `src/components/streak-risk-nudges.tsx` shows at most 2 of them at once (`findAtRiskStreaks()`'s `limit`), each dismissible for the current page view (no persistence — it just reappears next visit if still at risk).
- **Schedule + attendance/absence tracking** — see `supabase/migrations/0015_schedule_and_attendance.sql`. **Also needs a migration**: `students.scheduled_days`/`teacher_students.scheduled_days` (a plain `text[]` of weekday names like `{monday,wednesday,friday}`, set via `src/components/schedule-picker.tsx` — Mon–Sun toggle buttons — on the add/edit-student modal, shown as a small "Scheduled: Mon, Wed, Fri" line on the student page header). Plus a new **`attendance_records`** table — deliberately **one shared table for both sides** (unlike every other feature in this app, which mirrors fully separate tables per role): `slp_id`/`teacher_id` are both nullable, with exactly one set per row (CHECK-constrained), so the same simple `= auth.uid()` RLS pattern used for other owner-column tables still isolates one SLP's/Teacher's rows from another's. `student_id` deliberately has no foreign key — it points at `students.id` or `teacher_students.id` depending on which owner column is set, and a single column can't carry a conditional FK to two tables; the app always sets it from a validated student record, same trust boundary as everywhere else. `src/components/attendance-section.tsx` (shared, takes `ownerField: "slp_id" | "teacher_id"`) renders the "Mark absent" button (opens `src/components/mark-absent-modal.tsx` — date, reason dropdown, optional note) and a small history list, mirroring the Sessions list's styling.
  - **Streak interaction**: `computeCadenceStreak()`/`isStreakAtRisk()` (`src/lib/streaks.ts`) now take an optional 4th `absentDates` argument. An excused date is "protected": it never adds to the streak count (it wasn't an actual session), but it also never breaks the walk backward through dates — only a day/week that's neither logged nor excused does that. For the weekly cadences specifically, a week only *increments* the streak via real sessions alone; if it falls short on real sessions but reaches quota once absences are added in, it's merely "protected" (doesn't break, doesn't count) rather than treated as a genuine completed week — same principle as a single protected day never incrementing on its own. `src/lib/caseload.ts`'s `computeCaseloadStreaks()`/`findAtRiskStreaks()` both gained a matching optional `absentDatesByStudentId` map parameter. Every call site that computes a streak (both student pages, both dashboards) now fetches `attendance_records` alongside sessions and passes the dates through; the parent dashboard's home-practice streak is unaffected (attendance tracks scheduled sessions, not home practice, and the parent side never touches this table). Verified with a throwaway test script covering gap-protected-by-absence, absence-alone-not-faking-a-streak, absences-not-covering-the-quota-on-their-own, and `isStreakAtRisk` cases for both cadence families, plus a regression pass confirming the pre-absence call signature (3 args) still behaves identically — 21/21 checks passed.
- **Collapsible, reorderable student-page sections** — **no migration**: purely a client-side UI preference, persisted to `localStorage` rather than a database column, since it doesn't need to sync across devices. Both the SLP and Teacher student pages had accumulated enough sections (Goals, Assessments\*, Home practice, Practice log, Behavior, Attendance, Sessions — \*SLP-only) to feel cluttered, so each section's header is now a shared `src/components/section-header.tsx`: a clickable chevron + icon + title that toggles that section collapsed/expanded, plus small up/down arrow buttons that reorder it relative to the others (chosen over drag-and-drop for reliability — no new pointer-event/DnD dependency). `src/components/section-preferences.tsx` exports `SectionPreferencesProvider` (rendered once per page, given a `storageKey` and an ordered array of `{key, defaultCollapsed, node}` — `node` is each section's already-rendered JSX, since a Server Component page can pass elements but not functions to a Client Component) and a `useSectionPreferences(key)` hook each section component calls internally to read/toggle its own collapsed state and move itself up/down; order and collapsed-state both live in one localStorage object per side (`bloomtrack:student-page-sections:slp` / `...:teacher`), applied via a mount-time `useEffect` so server-rendered and first-paint markup match before the stored preference takes over. It's a genuinely global (not per-student) setting — reorder or collapse a section on one student's page and every other student's page reflects it too. Goals defaults expanded; every other section defaults collapsed. The Sessions section, previously inline JSX in each page (a Server Component, so it couldn't call the client-only hook), was pulled out into a new shared `src/components/sessions-section.tsx` alongside the already-shared `attendance-section.tsx` so both use the same mechanism as every other section.
- **Material bank** (`/toolkit/materials`, `/teacher/toolkit/materials`) — see `supabase/migrations/0016_materials.sql`. **Also needs a migration**: new `materials` (`slp_id`-scoped: `title`, `url`, optional `description`, `area_id`, `visibility`) and `teacher_materials` (`teacher_id`-scoped, `subject_id` in place of `area_id`) tables, plus `material_goals`/`teacher_material_goals` join tables for an optional many-to-many link to goals (no owner column of their own — RLS checks ownership via the parent material row, same pattern as `assessment_areas` → `assessments`). Materials are always a link — Drive/Dropbox/YouTube/etc., validated client-side as a well-formed `http(s)` URL — never an uploaded file. `visibility` is a `CHECK`-constrained `'private' | 'shared' | 'for_sale'` column, but only `'private'` does anything yet: the add/edit form (`material-form-modal.tsx` each side) always submits `'private'` and shows `'shared'`/`'for_sale'` as disabled radio options tagged "Coming soon", so she can see what's ahead without being able to pick them before they're actually built. The toolkit page (`materials-list.tsx` each side) lists her materials with category/visibility badges and the linked goals as small tags, filterable by category or by linked goal, with the usual add/edit/delete; `src/lib/materials.ts` holds the shared visibility labels/constants, URL check, and the join-flattening helpers for both sides (mirroring `flattenAssessmentAreas()` in `src/lib/assessment.ts`). On the student page, any goal with linked materials shows them as small clickable chips right on its card (`src/components/material-chips.tsx`, shared by both sides) — each student page's server component does one extra `material_goals`/`teacher_material_goals` query (scoped to that student's own goal ids, since the join has no student column of its own) and groups the results by goal id (see the bank-goal bullet below for how that resolution actually works today — it changed from a straight `goal_id` match soon after this).
- **Material tracking in session logging** — see `supabase/migrations/0017_trial_materials.sql`. **Also needs a migration**: one nullable `material_id` column each on `trials` (→ `materials`) and `teacher_trials` (→ `teacher_materials`), `on delete set null` so removing a material from the bank never takes historical trial data down with it. No RLS changes — ownership still flows through the existing `session_id`/`goal_id` columns. On the session-logging page (`/students/[id]/session/new`, `/teacher/students/[id]/session/new`), each active goal's card gets a small "Material" widget (`goal-material-section.tsx` each side): if the goal has linked materials it's a compact `<select>` (plus an inline "+ Add new material…" option that creates a bank entry — tagged with the goal's own area/subject and linked to the goal via `material_goals` — and selects it immediately); if it has none yet, it's just a quiet "+ Add material" text link rather than an empty-looking picker box, per the "stay out of the way until there's something to show" design brief. Picking a material is **session-scoped state only** (`new-session-form.tsx`'s `activeMaterialByGoal`, never written to the DB on its own) — from that point on, every trial logged for that goal is tagged with that `material_id`, until she changes or clears the selection. A small "Open" link next to the picker jumps straight to the material. Once a material is selected, a "Last used: X% ..." note appears if there's prior data for it — computed as **the percent from the most recent session that material was used in for that goal, not an all-time average**: a material introduced months ago (different cueing, different point in therapy) or used once on an off day would otherwise get blended into a number that answers a different question than the one she's actually asking when picking a material — "is this still working for this student, right now?" `computeLastUsedMaterialStats()`/`computeLastUsedStatsByGoalAndMaterial()` (`src/lib/progress.ts`) get there by reusing `buildGoalReport()`'s existing per-session-date trend (filtered down to just that material's trials) rather than re-deriving the cueing/rating/correct percent math a third time — same `metricLabel` wording as the Progress page, so it reads consistently everywhere it shows up.
- **Materials follow the bank goal, not the per-student goal row** — see `supabase/migrations/0018_bank_goal_materials.sql`. **Also needs a migration**: one nullable, self-referential `source_bank_goal_id` column each on `goals` and `teacher_goals` (`on delete set null`), set automatically only when a goal is created by picking "From goal bank" on the student page (`goal-form-modal.tsx` each side passes the picked bank goal's own id through as `sourceBankGoalId`; the goal-add handler in `goals-section.tsx` each side is the only place that ever writes it — editing a goal never touches it). Freehand goals, and every goal that existed before this migration, keep it `null` — there's no reliable way to know a pre-existing goal's bank origin, so this only takes effect going forward. This fixes a real bug: a material linked from `/toolkit/materials` to a bank-template goal (the picker there let you choose either a template row or a specific student's row, both looking like ordinary options) could never show up in any session, because a goal picked "from bank" is a full copy — a separate row with its own id — not a reference to the template, and the session picker only ever looked up materials by that exact per-student row's id. `resolveMaterialChipsByGoal()` (`src/lib/materials.ts`) is the fix: it resolves each goal's materials by checking both a direct link on that goal's own row *and* a link on `source_bank_goal_id` (when set), so a material linked once at the bank-goal level now applies to every student assigned that bank goal. Used by both the session material picker and the student-page goal-card chips — both were fetching materials the same way, so both had the same gap, and both needed the same fix (the session and student-page queries also had to broaden their `material_goals`/`teacher_material_goals` lookups to include each goal's bank id alongside its own). The Toolkit materials page's "link to goals" picker (`page.tsx` each side) now filters to `.is("source_bank_goal_id", null)` — bank templates and freehand goals only — so a bank-sourced per-student row is never offered there in the first place; linking a material inline mid-session (`new-session-form.tsx`'s `handleAddMaterial`) links to `goal.source_bank_goal_id ?? goal.id` for the same reason. Linking happens at the bank-goal level **instead of** the instance level when a bank id is available (not both) — the picker doesn't even offer the instance-level option anymore, and duplicating the link would just leave an orphaned row nothing ever reads. "Last used" stats are deliberately *not* broadened the same way — they stay scoped to one student's own trials for their own goal row, since blending in a different student's results for a shared material would answer a different question than the one that note is for (see the bullet above). One known residual gap, not addressed here: the Toolkit page's goal picker has no status filter (shows goals of any status), while the session page only shows `active` goals — so linking a material to a goal that's currently on hold or mastered still won't show it in any session, simply because that goal has no card there at all.
- **Assessment "Custom choices" response type** — see `supabase/migrations/0019_assessment_custom_choice.sql`. **Also needs a migration**: widens `assessment_questions.response_type`'s CHECK constraint to allow `'custom_choice'` alongside the existing three, and adds a nullable `choices` jsonb column (a plain string array, e.g. `["Present", "Emerging", "Absent"]`) — unused for every other response_type, no shape constraint at the DB level (same light-touch approach as other jsonb columns in this schema). In the question editor (`question-form-modal.tsx`), picking "Custom choices" reveals a small repeatable text-input list (2-4 options, add/remove buttons) that starts as two empty inputs rather than any hardcoded example set. Answers reuse the existing `{text: string}` shape (`AssessmentAnswerValue`) that `free_text` already used — the admin page (`assessment-administer.tsx`) renders a `custom_choice` question as a row of tap-to-select buttons built from that question's own `choices`, storing the selected label as `text` and toggling it off on a second tap, same upsert/delete-when-empty auto-save `persist()` every other type already goes through. `isAssessmentAnswered()`/`formatAssessmentAnswer()`/`computeAssessmentScore()` (`src/lib/assessment.ts`) treat `custom_choice` exactly like `free_text` throughout: answered-when-non-empty-text, rendered as the plain text (or the quoted choice) in the report, and excluded from the numeric score entirely (not inherently right/wrong) — so the report page needed no changes, it already lists every question/answer uniformly regardless of type. The Excel bulk-import (`question-import.ts`) accepts `"Custom Choice"` (plus a few casing variants) as a `Response Type` value, reading a new `"Choices"` column split on commas or semicolons (whichever the row doesn't otherwise use) into 2-4 trimmed labels — a `custom_choice` row missing a valid `Choices` cell is skipped with an explanatory reason, same as any other invalid row; the downloadable template (`assessment-editor.tsx`) documents the column with an example `custom_choice` row.
- **Onboarding tour** — **no migration**: purely `user_metadata.has_seen_tour` (boolean, unset by default), set via `supabase.auth.updateUser({ data: { has_seen_tour: true } })` once the tour finishes or is skipped/closed — same merge-not-replace metadata pattern already used for `full_name`/`role`. New dependency: [react-joyride](https://www.npmjs.com/package/react-joyride) `^3.2.0` — chosen specifically for its v3 rewrite's React 19 peer-dep support (`react-joyride@2.x` caps at React 18 and leans on the since-deprecated `findDOMNode`); v3's `onEvent(data, controls)` callback also hands back `controls.next()`/`controls.skip()` directly, which is what makes graceful step-skipping (below) a one-liner instead of hand-rolled index bookkeeping. Auto-starts the first time `has_seen_tour` isn't `true` when the dashboard loads (that includes any account that existed before this shipped, not just brand-new signups — there's no reliable "was this account created before today" signal without a migration, and the "Take the tour" replay link means seeing it once more is a low-cost surprise either way). Steps are defined per role in `src/lib/onboarding-tour.ts` (`buildSlpDashboardSteps()`/`SLP_STUDENT_TOUR_STEPS`, `buildTeacherDashboardSteps()`/`TEACHER_STUDENT_TOUR_STEPS`) and target real elements via `data-tour="..."` attributes (added to the relevant button/link/section in `students-section.tsx`, the dashboard's Toolkit nav, `goals-section.tsx`, `sessions-section.tsx`'s shared "Start session" link, each student page's "View progress" link, and `home-practice-section.tsx` — always on the section's outer wrapper or a top-level control, never on collapsible content, so a step still finds its target regardless of the section's collapsed state) rather than text/class selectors, so wording or styling changes later don't silently break a step. Per the request, a step whose target genuinely isn't on the page (`EVENTS.TARGET_NOT_FOUND`) calls `controls.next()` to skip it rather than stalling or erroring — real per-account testing (a throwaway signup, clicked through both roles end-to-end, then deleted) confirmed this path along with every other step. The dashboard's 3 steps and each student page's 4 steps are two separate `<Joyride>` runs, not one continuous one, because they span a real Next.js navigation (`/dashboard` → a student's page) that unmounts and remounts the whole component tree — `src/components/dashboard-tour.tsx` and `src/components/student-tour.tsx` hand off between them via one small `sessionStorage` flag (`setPendingStudentTour()`/`consumePendingStudentTour()`, timestamped and consumed on read so an abandoned tour can't unexpectedly resume on some unrelated later visit to a student page). A brand-new account has no students yet, so there's nothing to hand off to: the dashboard's last step's copy grows an extra sentence inviting her to add one, and the tour simply ends there — exactly the "skip gracefully" principle applied to a whole missing page rather than one missing element. `DashboardTour` also renders the "Take the tour" replay link itself (next to the Toolkit nav, both dashboards) since Joyride's overlay portals to `document.body` regardless of where its host component sits in the tree.
- **Extended student info** — see `supabase/migrations/0020_extended_student_info.sql`. **Also needs a migration**: four nullable columns each on `students`/`teacher_students` (`date_of_birth` date, `mother_email`, `father_email`, `homeroom_teacher` text), plus new `student_custom_fields`/`teacher_student_custom_fields` tables (`id`, own `slp_id`/`teacher_id` column, `student_id`, `label`, `value`, `created_at`) for any number of free-form label/value pairs per student (e.g. "Allergy: Peanuts") — same direct-owner-column RLS pattern as `home_practice_items`/`slp_behavior_logs` rather than a join through the parent table. Deliberately kept out of the dashboard's add/edit-student modal entirely (an early version put them there and it grew too tall, plus it meant two separate editors writing the same columns) — instead the student page gets its own **"Student info"** section (`student-info-section.tsx`/`student-info-form-modal.tsx` each side, first in the collapsible-section list so it lands near the top) that's the only place this data is set: computed age (`computeAge()` in `src/lib/date.ts`, derived live from `date_of_birth` against today's date — never stored, so it's always right without a birthday-crossing background job), class, homeroom teacher, parent emails (as `mailto:` links), and the custom fields, shown only once at least one of those is actually set; a student with none of this filled in yet gets no section at all (no header, no empty card), just a small always-visible "+ Add student info" link in its place. `CustomFieldsEditor` (`src/components/custom-fields-editor.tsx`, a pure value/onChange widget like `AvatarPicker`/`SchedulePicker`) renders the repeatable label/value rows in that section's edit modal, and `diffCustomFields()` (`src/lib/custom-fields.ts`, table-agnostic) reconciles the form's current rows against what the student started with into insert/update/delete batches on save — a row with a blank label or value is dropped rather than saved, whether it was blanked out or just removed from the list. One trade-off worth knowing: since none of this lives in the add/edit-student modal, it can't be set while first creating a student — add the student, then open their page and use "+ Add student info". The add/edit-student modal itself (`student-form-modal.tsx` each side) also picked up a `max-h-[85vh]` scrollable-card wrapper as part of this work, fixing a pre-existing bug where a tall modal (avatar picker + schedule picker) could clip its own Name field and Save button unreachably out of view — the same fix was applied to the Student info edit modal for the same reason.
- **Community sharing — step 1: data model** — see `supabase/migrations/0024_community_sharing.sql`. **Needs a migration**: a `visibility` column (`'private' | 'shared'`, CHECK-constrained, default `'private'`) on `response_formats`/`teacher_response_formats` and on `goals`/`teacher_goals`. The goals tables also get a second CHECK — `visibility = 'private' or student_id is null` — so an assigned student goal can never be marked shared at the DB level, not just in the UI: only bank goals (`student_id is null`) expose the field at all, via the goal-bank forms (`bank-goal-form-modal.tsx` each side); the assigned-goal form on a student page (`goal-form-modal.tsx`) never touches it. `materials`/`teacher_materials` already had a `visibility` column supporting `'shared'` since `0016_materials.sql` — this step just makes it functional (`MATERIAL_VISIBILITY_COMING_SOON.shared` flips to `false` in `src/lib/materials.ts`; `'for_sale'` stays "Coming soon", a separate future phase). Nothing is actually browsable by anyone else yet — that's a later step — this one just gets the data model and the ability to correctly mark an item as shared in place.

  The other half is a display name: `user_metadata.display_name` (same storage pattern as `full_name` — Supabase auth metadata, not a DB column, so there's nothing to migrate for it), deliberately never defaulted to her real name since it's the credit a shared item is shown under. Set from a new, single **`/settings`** route (`src/app/settings/`) — unlike almost everything else in this app, this one route is shared across all three roles rather than mirrored, same reasoning as `/login`/`/forgot-password` not being role-specific: it edits the one shared `auth.users` row, not a role-specific table. `src/components/display-name-form.tsx` is the actual input-plus-save form, reused two places: standalone on the settings page (`display-name-section.tsx`, with a brief "Saved." confirmation) and inside `src/components/set-display-name-modal.tsx`, which pops up the moment she tries to mark something "Shared" without a display name set yet — a shared item needs an author credit.

  `src/components/visibility-field.tsx` is the "Private / Shared[ / For sale]" radio group itself, generic over the option-value type so one component drives all three surfaces: the Materials add/edit form (both sides — replacing the old always-disabled "Coming soon" `shared` radio with a real, selectable one), the bank-goal add/edit form (`bank-goal-form-modal.tsx` both sides), and — since response formats have no single unified edit form, just three separate type-specific editor modals plus a creation modal — an inline control added directly to each format's card on the Toolkit formats list (`formats-list.tsx` both sides, persisting immediately on change) as well as the creation modal (`new-format-modal.tsx` both sides). Picking the gated `"shared"` option first checks `user_metadata.display_name` via `supabase.auth.getUser()`; if it's unset, `VisibilityField` opens `SetDisplayNameModal` instead of applying the change, and only applies it once she's saved a name there. Goal-bank cards also picked up a small read-only "Private"/"Shared" badge (matching the Materials list's existing visibility badge) so the current state reads at a glance without opening the edit form.

- **Community sharing — step 2: browse/discovery** — new **`/toolkit/community`** (SLP) and **`/teacher/toolkit/community`** (Teacher) pages, linked from every existing Toolkit nav row both sides. **Needs a migration**: see `supabase/migrations/0025_community_sharing_browse.sql`. A `'shared'` row (goals/teacher_goals, response_formats/teacher_response_formats, materials/teacher_materials — step 1 above) was already marked shareable but wasn't actually readable by anyone but its owner; this migration adds one additional, purely-additive `for select using (visibility = 'shared')` policy per table (goals/teacher_goals also re-assert `student_id is null`, belt-and-braces alongside the step-1 CHECK constraint), same pattern `0023_supervisor_readonly_access.sql` already established — Postgres ORs multiple permissive policies together, so a private row stays exactly as private as before and insert/update/delete stay owner-only everywhere. "Same side" isolation (an SLP never sees Teacher-shared content) falls out for free from the tables already being separate per side. Crediting a browsed item to its author needed one more piece: `auth.users` isn't reachable through PostgREST at all, so a new `security definer` function, `get_shared_item_authors(uuid[])`, is the only way the app reads another account's `user_metadata.display_name` — scoped tightly to only return a name for an id that actually owns at least one `'shared'` row (checked via the same six tables/conditions the new policies already expose), so it's not a general user-lookup, just a name-for-a-row-you-can-already-see.

  The page itself is `src/components/community-browse.tsx` — one client component shared by both sides (table/column names passed as props, same `GoalExcelImport`-style generic pattern), rendering three tabs (Goals/Response formats/Materials, the latter filtered by response-format `type` in place of an area/subject since that table has no category column at all) with a category filter and, per item, an "Add to my bank" button that **copies** the item into her own bank as a fresh row — always `visibility: 'private'` regardless of the source's setting, per spec. A copied goal's linked response format (if that format is itself independently shared — otherwise PostgREST's own RLS on the embedded join silently omits it, so there's nothing to copy) is copied too, never referenced by id, since the two accounts' `response_formats` rows are entirely separate tables; a copied material likewise becomes a fully independent row (title/url/description/area) rather than a cross-account link, so it behaves identically to anything she created herself afterward — usable in sessions, linkable to goals, editable, deletable. Copying either one find-or-creates a matching area/subject by name in her own bank first (same matching `GoalExcelImport` already uses for bulk import), rather than requiring an exact pre-existing category. Her own shared items are excluded from the "browse & add" list (adding her own item to her own bank makes no sense) and shown instead in a separate read-only "Your shared X" section on each tab, for reference only.

  Two follow-up fixes since this shipped, both worth knowing about if you touch this area again:

  **The RLS leak.** `0025`'s new `visibility = 'shared'` SELECT policy is a second *permissive* policy on each of these six tables — Postgres ORs permissive policies together, so any existing query on `goals`/`response_formats`/`materials` (or their `teacher_` equivalents) that relied on RLS alone to scope results to "my own rows," with no explicit `.eq(slp_id/teacher_id, user.id)`, silently started returning other accounts' shared rows too. That hit the regular (non-Community) Toolkit pages and a couple of student-page pickers — 10 files fixed, each with an explicit owner filter added and a comment explaining why. **The lesson for next time**: adding a new permissive policy to a table means auditing every existing unfiltered query on it, not just the query the new policy was added for.

  **Duplicate copies.** "Add to my bank" had no memory of what she'd already copied, so clicking it twice (or on two tabs) made two copies. `supabase/migrations/0026_community_copy_tracking.sql` adds a nullable `copied_from_id` column (self-referencing FK, `on delete set null`) to all six tables — set on every row "Add to my bank" creates, pointing at the original shared item's id. **No RLS changes and deliberately no DB-level uniqueness constraint**: "already has a copy" is checked at the app level in `community-browse.tsx`, both from `copied_from_id` values fetched on page load (drives the disabled "Already in your bank" button state) and freshly right before every insert (covers a copy made from another tab/device since the page loaded). A hard per-account unique constraint on `(owner, copied_from_id)` would've been wrong anyway: copying a goal that references a shared format it already has an independent copy of reuses that existing copy (looked up by `copied_from_id`) instead of making a second one — three different copy paths (direct Formats-tab add, and the cascade from each of two goals referencing the same format) can legitimately all resolve to the same one row.

## Project structure

```
src/
  app/
    page.tsx                        landing page
    login/page.tsx                   SLP/Teacher/Parent chooser + sign in/sign up form (client component)
    dashboard/
      page.tsx                        protected SLP dashboard — student list (server component)
      students-section.tsx             student list UI + add/edit/delete state (client component)
      student-form-modal.tsx           add/edit student modal
      delete-confirm-modal.tsx         delete student confirmation
      sign-out-button.tsx              sign out button
      name-prompt-modal.tsx            one-time-per-login "add your name" prompt (client component)
    teacher/
      dashboard/
        page.tsx                        protected Teacher dashboard — student list (server component)
        students-section.tsx             student list UI + add/edit/delete state (client component)
        student-form-modal.tsx           add/edit student modal
        delete-confirm-modal.tsx         delete student confirmation
        sign-out-button.tsx              sign out button
      students/[id]/
        page.tsx                        Teacher student detail (server component) — Goals, Behavior, Sessions sections
        student-info-section.tsx          "Student info" collapsible section — age/class/homeroom/parent emails/custom fields, hidden entirely if empty (client component)
        student-info-form-modal.tsx       edit modal for just the Student info section's own fields
        goals-section.tsx                 goal list UI + add/edit/delete state (client component)
        goal-form-modal.tsx               add/edit goal modal (subject, bank/write, baseline, target %, format, status)
        delete-goal-confirm-modal.tsx     delete goal confirmation
        behavior-section.tsx              behavior trends breakdown + history list + "Log behavior" state (client component)
        log-behavior-modal.tsx            log-behavior modal (date, type, optional severity, optional note)
        session/new/
          page.tsx                        new-session page (server component) — fetches active goals
          new-session-form.tsx             date/note state, auto-saves session + trials (client component)
          goal-trial-card.tsx              per-goal trial buttons + running tally + undo
      toolkit/
        subjects/
          page.tsx                        subjects + response formats page (server component)
          subjects-section.tsx             subject list UI + add/edit/delete state (client component)
          subject-form-modal.tsx           add/edit subject modal
          delete-subject-confirm-modal.tsx delete subject confirmation (blocked with a message if a goal uses it)
          formats-list.tsx                 renders format cards, create/edit/delete state (client component) — same UI patterns as /toolkit/formats
          new-format-modal.tsx             name + type picker for a brand-new custom format
          correct-incorrect-editor-modal.tsx rename + custom correct/incorrect labels editor
          rating-scale-editor-modal.tsx    rename + custom min/max range editor
          cueing-hierarchy-editor-modal.tsx rename + add/remove/rename/recolor levels editor
          delete-format-confirm-modal.tsx  delete format confirmation
        goals/
          page.tsx                        goal bank page (server component) — all bank goals, grouped by subject
          goal-bank-section.tsx            bank goal list UI + add/edit/delete state (client component)
          bank-goal-form-modal.tsx         add/edit bank goal modal (subject, text, default format, target %)
          delete-bank-goal-confirm-modal.tsx delete bank goal confirmation
        behavior-types/
          page.tsx                        behavior types page (server component)
          behavior-types-section.tsx       behavior type list UI + add/edit/delete state (client component)
          behavior-type-form-modal.tsx     add/edit behavior type modal (name + color swatch picker)
          delete-behavior-type-confirm-modal.tsx delete behavior type confirmation (blocked if used by a log)
    students/[id]/
      page.tsx                        student detail (server component) — goals + past sessions
      student-info-section.tsx          "Student info" collapsible section — age/class/homeroom/parent emails/custom fields, hidden entirely if empty (client component)
      student-info-form-modal.tsx       edit modal for just the Student info section's own fields
      goals-section.tsx                goal list UI + add/edit/delete state (client component)
      goal-form-modal.tsx              add/edit goal modal
      delete-goal-confirm-modal.tsx    delete goal confirmation
      behavior-section.tsx              behavior trends breakdown + history list + "Log behavior" state (client component)
      log-behavior-modal.tsx            log-behavior modal (date, type, optional severity, optional note)
      share-behavior-toggle.tsx         "Show behavior summary to parent" checkbox (client component)
      session/new/
        page.tsx                        new-session page (server component) — fetches active goals
        new-session-form.tsx             date/note state, auto-saves session + trials (client component)
        goal-trial-card.tsx              per-goal trial buttons + running tally + undo
      progress/
        page.tsx                        progress report (server component) — aggregates + renders per-goal cards
        goal-progress-card.tsx            one goal's full report card — status, trials, level breakdown, trend chart, summary (shared by this page, the Teacher progress page, and /parent's Progress section)
        level-breakdown-bars.tsx          cueing-hierarchy level % bars (server component)
        trend-chart.tsx                   hand-rolled inline SVG line chart (server component)
        copy-summary-button.tsx           clipboard button (client component — the only client JS on this page)
      export-buttons.tsx                 JSON backup + trials CSV downloads (client component)
      home-practice-section.tsx           SLP-side items list + add/edit/delete + parent code (client component)
      home-practice-item-form-modal.tsx    add/edit home practice item modal
      delete-home-practice-item-modal.tsx  delete home practice item confirmation
      copy-code-button.tsx                 clipboard button for the parent access code
      practice-log-section.tsx            SLP-side practice log view + leave-praise form (client component)
      assessments-section.tsx             in-progress/past assessment lists + "Run assessment" state (client component)
      run-assessment-modal.tsx            pick a saved assessment, creates an assessment_result
      assessment/[resultId]/
        page.tsx                        administer/report page (server component) — branches on result status
        assessment-administer.tsx         per-question inputs by type, auto-save, progress bar, "Mark complete" (client component)
        assessment-report.tsx             read-only report: every Q&A + summary score (server component)
        copy-report-button.tsx            clipboard button for the plain-text report
    toolkit/
      formats/
        page.tsx                        response formats settings page (server component)
        formats-list.tsx                 renders format cards (real + placeholder), create/edit/delete state (client component)
        new-format-modal.tsx             name + type picker for a brand-new custom format
        cueing-hierarchy-editor-modal.tsx rename + add/remove/rename/recolor levels editor
        correct-incorrect-editor-modal.tsx rename + custom correct/incorrect labels editor
        rating-scale-editor-modal.tsx    rename + custom min/max range editor
        delete-format-confirm-modal.tsx  delete format confirmation
      goals/
        page.tsx                        goal bank page (server component) — all bank goals, grouped by area
        goal-bank-section.tsx            bank goal list UI + add/edit/delete state (client component)
        bank-goal-form-modal.tsx         add/edit bank goal modal (area, text, default format, target %)
        delete-bank-goal-confirm-modal.tsx delete bank goal confirmation
      behavior-types/
        page.tsx                        behavior types page (server component)
        behavior-types-section.tsx       behavior type list UI + add/edit/delete state (client component)
        behavior-type-form-modal.tsx     add/edit behavior type modal (name + color swatch picker)
        delete-behavior-type-confirm-modal.tsx delete behavior type confirmation (blocked if used by a log)
      assessments/
        page.tsx                        assessment list page (server component)
        assessments-list.tsx             saved assessments list + create/delete state (client component)
        new-assessment-modal.tsx         name + description, creates and opens the editor
        delete-assessment-confirm-modal.tsx delete assessment confirmation
        [id]/
          page.tsx                        question editor page (server component)
          assessment-editor.tsx            name/description inline edit + question list + reorder state (client component)
          question-form-modal.tsx          add/edit question modal (prompt, response type, expected answer, notes)
          delete-question-confirm-modal.tsx delete question confirmation
    parent/
      page.tsx                        reads the signed parent cookie server-side; login screen or dashboard
      parent-login-form.tsx             access-code entry (client component) — posts to /api/parent/login
      parent-dashboard.tsx              items + log-practice form + history + Progress/Behavior sections (server component)
      progress-section.tsx              renders GoalProgressCard for each visible_to_parent goal
      behavior-section.tsx              friendly count-by-type breakdown, only when share_behavior_with_parent is on
      log-practice-form.tsx             checklist + mood + note (client component) — posts to /api/parent/practice/log
      logout-button.tsx                 clears the parent cookie (client component)
    api/parent/
      login/route.ts                  validates the code, sets the signed cookie
      logout/route.ts                  clears the cookie
      practice/log/route.ts            writes a practice_logs row scoped to the cookie's student_id
    layout.tsx
    globals.css
  lib/
    types.ts                        shared TypeScript types (Student, Goal, ResponseFormat, Session, Trial, HomePracticeItem, PracticeLog, Assessment, AssessmentQuestion, AssessmentResult, AssessmentAnswer, TeacherStudent, TeacherSubject, TeacherGoal, TeacherBehaviorType, BehaviorLog, BehaviorType, SlpBehaviorLog, ...)
    colors.ts                       named color palette used by the cueing hierarchy editor
    response-format-types.ts         labels/descriptions for all response format types
    goal-status.ts                   labels/badge colors for goal status
    practice.ts                     shared "how it went" labels/emoji (great/okay/tricky) — SLP view and parent form both use it
    date.ts                         today's local date + display formatting for session/chart dates + computeAge()
    custom-fields.ts                diffCustomFields() — reconciles a custom-fields editor's rows into insert/update/delete batches, table-agnostic
    trial-value.ts                   human-readable rendering of a trial's jsonb value (CSV export)
    progress.ts                     per-goal aggregation: level breakdown, trend, trend direction, summary text
    assessment.ts                   response-type labels, answer formatting, scoring, plain-text report builder
    role.ts                         getUserRole() — single source of truth for SLP-vs-Teacher, defaults to "slp"
    behavior.ts                     severity labels/badge colors, shared by SLP and Teacher behavior logs
    confetti.ts                     fireCelebrationConfetti() — dynamically imports canvas-confetti
    streaks.ts                      computeCadenceStreak() + milestone emoji tiers + isStreakAtRisk() — shared by SLP/Teacher session streaks and the parent practice streak
    caseload.ts                     computeCaseloadStreaks()/findAtRiskStreaks() — per-caseload aggregation for both dashboards
    avatar.ts                       AVATAR_EMOJI_OPTIONS — the curated emoji set for the student avatar picker
    schedule.ts                     DAYS_OF_WEEK/DAY_LABELS/formatScheduledDays() for the "Scheduled: Mon, Wed, Fri" line
    attendance.ts                   ATTENDANCE_REASONS/ATTENDANCE_REASON_LABELS for the "Mark absent" form
    parent-session.ts                signs/verifies the parent session cookie (HMAC-SHA256, no library)
    supabase/
      client.ts                     Supabase client for Client Components
      server.ts                     Supabase client for Server Components / Route Handlers
      service.ts                     service-role admin client — server-only, used only by src/app/api/parent/**
      middleware.ts                  session refresh + route protection logic (excludes /parent, /api/parent)
  middleware.ts                     wires middleware.ts into Next's request pipeline
supabase/
  migrations/
    0001_students.sql               students table + RLS policies
    0002_response_formats_and_goals.sql   response_formats, areas, goals tables + RLS + new-account seeding
    0003_sessions_and_trials.sql     sessions, trials tables + RLS
    0004_home_practice_and_parent_access.sql   parent_access_code + home_practice_items, practice_logs, praise + RLS
    0005_assessments.sql             assessments, assessment_questions, assessment_results, assessment_answers + RLS
    0006_assessment_metadata.sql     assessments.kind/formality + assessment_areas join table + RLS
    0007_teacher_students_subjects_goals.sql   teacher_students, teacher_subjects, teacher_response_formats, teacher_goals + RLS + role-aware handle_new_user()
    0008_teacher_behavior_tracking.sql   teacher_behavior_types, behavior_logs + RLS + extends handle_new_user() with default behavior types
    0009_teacher_sessions_trials.sql     teacher_sessions, teacher_trials + RLS (mirrors sessions/trials)
    0010_teacher_home_practice_and_parent_access.sql   teacher_students.parent_access_code, teacher_home_practice_items, teacher_practice_logs, teacher_praise + RLS
    0011_selective_parent_sharing.sql    goals.visible_to_parent, teacher_goals.visible_to_parent, teacher_students.share_behavior_with_parent
    0012_slp_behavior_tracking.sql       behavior_types, slp_behavior_logs + RLS + students.share_behavior_with_parent (mirrors 0008 for the SLP side)
```

As you add features, new pages go under `src/app/...` and shared logic under `src/lib/...`.

### Design system

Warm and friendly rather than clinical, since this is used by SLPs working with kids (and the `/parent` view is used directly by parents):

- **Color** — three custom Tailwind scales in `tailwind.config.ts`: `brand` (coral, primary actions/accents), `accent` (teal, secondary — links, "mastered" status, tags), `cream` (warm page background, `bg-cream-50`). Everything else uses Tailwind's built-in `stone` (warm neutral, replacing the default cool `slate`) for text/borders/surfaces. `red`/`green`/`amber` stay as the universal semantic colors for destructive actions, correct/incorrect, and warnings. The cueing-hierarchy level colors (`src/lib/colors.ts`) are unchanged — they were already soft/pastel Tailwind pairs and read fine alongside the new palette.
- **Type** — `next/font/google` in `src/app/layout.tsx`: **Baloo 2** (rounded, friendly) for all headings via a `@layer base` rule on `h1`-`h6` in `globals.css` (set once there rather than on every heading element), **Inter** for body text as the Tailwind `font-sans` default.
- **Shape & depth** — buttons/inputs `rounded-lg`, cards/modals `rounded-2xl`, pills `rounded-full`; cards carry `shadow-sm` with a `hover:shadow-md` lift, buttons add a subtle `hover:-translate-y-0.5` on top.
- **Icons** — [lucide-react](https://lucide.dev), used at nav links, section headings, empty states, and key action buttons (matched to what each button/section does — no icon components live in `src/lib/`, they're inlined per usage).
- **`src/components/`** — the one exception to "everything colocated under `src/app/...`": genuinely cross-route UI, like `assessment-meta-badges.tsx` (toolkit assessments list + the student-page "Run assessment" picker), `celebration-toast.tsx` (goal-mastery and parent practice-log celebrations — see "Celebrations" above), `streak-badge.tsx` (the SLP/Teacher student-page session streak and the parent dashboard's practice streak — see the `expected_frequency` bullet above), `avatar-badge.tsx`/`avatar-picker.tsx`/`caseload-wins-card.tsx`/`streak-risk-nudges.tsx` (see "Dashboard personalization" above), `schedule-picker.tsx`/`attendance-section.tsx`/`mark-absent-modal.tsx` (see "Schedule + attendance/absence tracking" above — the latter two are the one case in this app where a single component is shared by both the SLP and Teacher student pages rather than mirrored, since `attendance_records` is itself one shared table), `section-header.tsx`/`section-preferences.tsx`/`sessions-section.tsx` (see "Collapsible, reorderable student-page sections" above — `sessions-section.tsx` is likewise shared rather than mirrored), `custom-fields-editor.tsx` (see "Extended student info" above), and `visibility-field.tsx`/`display-name-form.tsx`/`set-display-name-modal.tsx`/`community-browse.tsx` (see "Community sharing" above — all four are shared rather than mirrored, since visibility marking, community browsing, and display names all work identically either side).
- **Parent view extra warmth** — `/parent` leans further into the palette than the SLP-side pages: a soft gradient background, bigger/rounder mood-picker buttons with per-mood colors and a tactile `active:scale-95` press, and praise notes styled as a small celebration (gradient background, 🎉 icon) rather than a plain list item.

Progress & Reports reads only from `sessions`/`trials`/`goals` — no new tables or migration needed, and no new npm dependency (charts are hand-rolled inline SVG/CSS rather than a charting library, to keep the bundle small and avoid another moving part).

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Supabase project credentials

Create a project at [supabase.com](https://supabase.com) (or use an existing one), then:

```bash
cp .env.local.example .env.local
```

Fill in `.env.local` with your project's URL and anon key, found in **Project Settings → API**:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

The parent-facing flow needs two more values (see **Parent access — security approach** below for why):

```
# Project Settings -> API -> service_role (click "reveal"). Server-only —
# never prefix with NEXT_PUBLIC_.
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Not a Supabase credential — generate your own random value, e.g.:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
PARENT_SESSION_SECRET=...
```

### 3. Run the database migrations

In the Supabase dashboard, open **SQL Editor** and run, in order:

1. `supabase/migrations/0001_students.sql`
2. `supabase/migrations/0002_response_formats_and_goals.sql`
3. `supabase/migrations/0003_sessions_and_trials.sql`
4. `supabase/migrations/0004_home_practice_and_parent_access.sql`
5. `supabase/migrations/0005_assessments.sql`
6. `supabase/migrations/0006_assessment_metadata.sql`
7. `supabase/migrations/0007_teacher_students_subjects_goals.sql`
8. `supabase/migrations/0008_teacher_behavior_tracking.sql`
9. `supabase/migrations/0009_teacher_sessions_trials.sql`
10. `supabase/migrations/0010_teacher_home_practice_and_parent_access.sql`
11. `supabase/migrations/0011_selective_parent_sharing.sql`
12. `supabase/migrations/0012_slp_behavior_tracking.sql`
13. `supabase/migrations/0013_streak_tracking.sql`
14. `supabase/migrations/0014_dashboard_personalization.sql`
15. `supabase/migrations/0015_schedule_and_attendance.sql`
16. `supabase/migrations/0016_materials.sql`
17. `supabase/migrations/0017_trial_materials.sql`
18. `supabase/migrations/0018_bank_goal_materials.sql`
19. `supabase/migrations/0019_assessment_custom_choice.sql`

(Or apply them with the Supabase CLI if you use one.)

**`students`**

| column       | type          | notes                              |
|--------------|---------------|-------------------------------------|
| `id`         | `uuid`        | primary key, auto-generated         |
| `slp_id`     | `uuid`        | owner — references `auth.users(id)` |
| `name`       | `text`        | student name                        |
| `class`      | `text`        | optional                            |
| `created_at` | `timestamptz` | auto-set on insert                  |

**`response_formats`**

| column       | type          | notes                                     |
|--------------|---------------|--------------------------------------------|
| `id`         | `uuid`        | primary key                                |
| `slp_id`     | `uuid`        | owner                                       |
| `name`       | `text`        | e.g. "Cueing hierarchy"                    |
| `type`       | `text`        | `cueing_hierarchy`, `correct_incorrect`, `rating_scale`, `pronunciation`, `open_text`, `behaviour_description`, `frequency_tally` |
| `config`     | `jsonb`       | format-specific config: `{levels: [{name, color, is_independent}, ...]}` for `cueing_hierarchy`; `{min, max}` for `rating_scale`; `{correctLabel, incorrectLabel}` (both optional) for `correct_incorrect`; unused for the other, not-yet-built types |
| `created_at` | `timestamptz` | auto-set on insert                         |

**`areas`** — `id`, `slp_id`, `name`.

**`goals`**

| column                | type          | notes                                            |
|-----------------------|---------------|----------------------------------------------------|
| `id`                  | `uuid`        | primary key                                        |
| `slp_id`              | `uuid`        | owner                                              |
| `student_id`          | `uuid`        | nullable — **null means it's a goal-bank template**, not yet assigned |
| `area_id`             | `uuid`        | references `areas`                                 |
| `text`                | `text`        | the goal itself                                    |
| `response_format_id`  | `uuid`        | nullable, references `response_formats`            |
| `baseline`            | `text`        | optional, free-form                                |
| `target_percent`      | `integer`     | optional, 0–100                                    |
| `status`               | `text`        | `active` \| `on_hold` \| `mastered`                |
| `created_at`          | `timestamptz` | auto-set on insert                                 |

**`sessions`**

| column       | type          | notes                                     |
|--------------|---------------|--------------------------------------------|
| `id`         | `uuid`        | primary key                                |
| `slp_id`     | `uuid`        | owner                                      |
| `student_id` | `uuid`        | references `students`                      |
| `date`       | `date`        | defaults to today, editable                |
| `note`       | `text`        | optional                                   |
| `created_at` | `timestamptz` | auto-set on insert                         |

**`trials`** — one row per tap during a session.

| column                 | type          | notes                                                       |
|------------------------|---------------|---------------------------------------------------------------|
| `id`                   | `uuid`        | primary key                                                    |
| `session_id`           | `uuid`        | references `sessions`                                          |
| `goal_id`               | `uuid`        | references `goals`                                             |
| `response_format_type` | `text`        | copied from the goal's response format at the time of the trial |
| `value`                | `jsonb`       | shape depends on the format, e.g. `{"level": "Spontaneous"}` or `{"correct": true}` |
| `created_at`           | `timestamptz` | auto-set on insert                                             |

`trials` has no `slp_id` column of its own — its RLS policies check ownership through the parent `sessions` row (`sessions.slp_id = auth.uid()`) instead.

Row Level Security is enabled on every table, scoped to `slp_id = auth.uid()` (directly, or via the parent session for `trials`) — an SLP only ever sees their own rows, matching the `students` table pattern.

**New-account seeding:** a `handle_new_user()` trigger fires on every new Supabase Auth signup and inserts a default "Cueing hierarchy" response format (5 levels: Spontaneous/green, Visual support/teal, Verbal support/amber, After modeling/clay, No answer/grey) plus the 10 default areas (Speech sounds, Articulation, Phonology, Receptive language, Expressive language, Fluency, Voice, Pragmatics/Social, Literacy, AAC). The migration also backfills these defaults for any account that already existed before it ran.

**`students.parent_access_code`** — a 6-character code (uppercase letters + digits, excluding 0/O/1/I/L to avoid confusion) auto-generated by a trigger on insert, backfilled for existing students, unique.

**`home_practice_items`** — SLP-managed, normal `slp_id` RLS.

| column             | type          | notes                       |
|--------------------|---------------|-------------------------------|
| `id`               | `uuid`        | primary key                    |
| `slp_id`           | `uuid`        | owner                          |
| `student_id`       | `uuid`        | references `students`          |
| `what_to_practice` | `text`        | required                       |
| `how_to_practice`  | `text`        | optional                       |
| `last_worked_date` | `date`        | optional; bumped automatically when a parent logs practice against this item |
| `created_at`       | `timestamptz` | auto-set on insert             |

**`practice_logs`** — written only by parents, through the service-role API route (see below); read by SLPs through normal RLS via a join to `students.slp_id`. No `slp_id` column of its own, and deliberately no insert/update/delete RLS policy for the authenticated role.

| column         | type          | notes                                                      |
|----------------|---------------|---------------------------------------------------------------|
| `id`           | `uuid`        | primary key                                                    |
| `student_id`   | `uuid`        | references `students`                                          |
| `date`         | `date`        | defaults to today                                              |
| `activities`   | `jsonb`       | array of `{id, text}` snapshots of the items practiced — text is captured at log time so history survives an item later being edited/deleted |
| `how_it_went`  | `text`        | `great` \| `okay` \| `tricky`                                  |
| `note`         | `text`        | optional                                                       |
| `created_at`   | `timestamptz` | auto-set on insert                                             |

**`praise`** — SLP notes on a log entry. RLS checks ownership via `practice_logs` → `students.slp_id`.

| column            | type          | notes                          |
|-------------------|---------------|-----------------------------------|
| `id`              | `uuid`        | primary key                        |
| `practice_log_id` | `uuid`        | references `practice_logs`         |
| `message`         | `text`        | required                           |
| `created_at`      | `timestamptz` | auto-set on insert                 |

**`assessments`** — a saved assessment template. Deliberately **no visibility/sharing column at all** — always private to the owning SLP, unlike `goals`/`response_formats`.

| column        | type          | notes               |
|---------------|---------------|-------------------------|
| `id`          | `uuid`        | primary key              |
| `slp_id`      | `uuid`        | owner                    |
| `name`        | `text`        | required                 |
| `description` | `text`        | optional                 |
| `created_at`  | `timestamptz` | auto-set on insert       |

**`assessment_questions`** — one row per question in an assessment. No `slp_id` column of its own — RLS checks ownership via `assessments.slp_id` (same pattern as `trials` → `sessions`).

| column             | type          | notes                                                    |
|--------------------|---------------|--------------------------------------------------------------|
| `id`               | `uuid`        | primary key                                                    |
| `assessment_id`    | `uuid`        | references `assessments`, `on delete cascade`                  |
| `order_index`      | `integer`     | display order; the editor's ↑/↓ swap adjacent values            |
| `prompt`           | `text`        | the question itself                                             |
| `response_type`    | `text`        | `right_wrong` \| `transcription` \| `free_text`                 |
| `expected_answer`  | `text`        | optional                                                         |
| `notes`            | `text`        | optional — admin notes, materials needed, etc.                  |
| `created_at`       | `timestamptz` | auto-set on insert                                               |

**`assessment_results`** — one row per time an assessment is run against a student. `assessment_id` has no `on delete cascade`: deleting an assessment template while results exist against it is blocked at the app layer with a clear message, and the DB reference is the backstop for that.

| column          | type          | notes                                     |
|-----------------|---------------|--------------------------------------------|
| `id`            | `uuid`        | primary key                                 |
| `slp_id`        | `uuid`        | owner                                       |
| `student_id`    | `uuid`        | references `students`, `on delete cascade`  |
| `assessment_id` | `uuid`        | references `assessments` (no cascade)       |
| `date`          | `date`        | defaults to today                           |
| `status`        | `text`        | `in_progress` \| `completed`                |
| `created_at`    | `timestamptz` | auto-set on insert                          |
| `completed_at`  | `timestamptz` | set when marked complete                    |

**`assessment_answers`** — one row per question per result, **upserted** as she answers/changes an answer (not appended like `trials`, which logs one row per tap) — a `unique(result_id, question_id)` constraint backs the upsert. No `slp_id` column of its own — RLS checks ownership via `assessment_results.slp_id`.

| column          | type          | notes                                                                 |
|-----------------|---------------|---------------------------------------------------------------------------|
| `id`            | `uuid`        | primary key                                                                 |
| `result_id`     | `uuid`        | references `assessment_results`, `on delete cascade`                       |
| `question_id`   | `uuid`        | references `assessment_questions`, `on delete cascade`                     |
| `response_type` | `text`        | copied from the question at answer time (same pattern as `trials.response_format_type`) |
| `value`         | `jsonb`       | `{"correct": true}` (right_wrong), `{"text": "...", "tag": "approx"}` (transcription), or `{"text": "..."}` (free_text) |
| `created_at`    | `timestamptz` | auto-set on insert                                                          |

An answer that's cleared back to empty is deleted rather than saved blank, so progress/answered counts stay accurate.

**`teacher_students`, `teacher_subjects`, `teacher_response_formats`, `teacher_goals`** — the Teacher-side mirror of `students`/`areas`/`response_formats`/`goals` above, same shapes, same `teacher_id`-scoped RLS pattern (`teacher_id = auth.uid()` in place of `slp_id`), but completely separate tables — no foreign keys or joins ever cross between the SLP and Teacher sides. `teacher_goals.student_id` nullable means goal-bank template, same as `goals`. `teacher_response_formats` reuses the identical `type`/`config` shape as `response_formats` (`cueing_hierarchy`, `correct_incorrect`, `rating_scale`, ...), so the same app-layer editor components work against either table.

**`teacher_behavior_types`** — `id`, `teacher_id`, `name`, `color` (one of the named values in `src/lib/colors.ts`, same palette the cueing hierarchy editor uses). No `created_at`, same minimalism as `teacher_subjects`.

**`behavior_logs`** — one row per logged behavior incident. Has its own `teacher_id` column (unlike `trials`/`practice_logs`, which derive ownership through a parent row), so RLS is the plain direct-column pattern.

| column             | type          | notes                                              |
|--------------------|---------------|--------------------------------------------------------|
| `id`               | `uuid`        | primary key                                              |
| `teacher_id`       | `uuid`        | owner                                                    |
| `student_id`       | `uuid`        | references `teacher_students`, `on delete cascade`       |
| `date`             | `date`        | defaults to today                                        |
| `behavior_type_id` | `uuid`        | references `teacher_behavior_types`                      |
| `severity`         | `integer`     | optional, 1–3 (Mild/Moderate/Significant) — nullable for positive behaviors |
| `note`             | `text`        | optional                                                 |
| `created_at`       | `timestamptz` | auto-set on insert                                       |

**`behavior_types`, `slp_behavior_logs`** — the SLP-side mirror of the two tables above, added later (`0012_slp_behavior_tracking.sql`) once behavior tracking proved worth having on both sides: same shapes, `slp_id` in place of `teacher_id`, `students`/`behavior_types` in place of `teacher_students`/`teacher_behavior_types` for the two foreign keys, otherwise column-for-column identical.

**`teacher_sessions`, `teacher_trials`** — the Teacher-side mirror of `sessions`/`trials`. `teacher_trials` has no `teacher_id` column of its own — RLS checks ownership via `teacher_sessions.teacher_id`, same pattern as `trials` → `sessions`.

### Parent access — security approach

Parents never get a Supabase Auth account, so RLS (which is keyed entirely on `auth.uid()`) can't scope their access the normal way. Instead:

1. `POST /api/parent/login` checks the typed code against **both** `students.parent_access_code` and `teacher_students.parent_access_code` using a **service-role Supabase client** (`src/lib/supabase/service.ts` — bypasses RLS, server-only, never imported into client code). Whichever table matches determines the session's `studentType` (`"slp"` or `"teacher"`), baked into an **httpOnly cookie** alongside the student's ID, signed with HMAC-SHA256 (`src/lib/parent-session.ts`, no external library) so neither field can be tampered with.
2. Every other parent-facing route/page re-verifies that signed cookie and derives `student_id`/`studentType` **only from it** — never from anything in the request body — before touching the database, then picks the matching table set (`students`/`home_practice_items`/`practice_logs`/`praise` vs. `teacher_students`/`teacher_home_practice_items`/`teacher_practice_logs`/`teacher_praise`). `ParentDashboard` itself takes plain props and has no idea which side the data came from — the two flows render identically.
3. `home_practice_items`/`teacher_home_practice_items` stay under the normal `slp_id`/`teacher_id`-based RLS the rest of the app uses. `practice_logs`/`praise` and `teacher_practice_logs`/`teacher_praise` are readable/writable by the SLP/Teacher through normal RLS too (via a join back to `students`/`teacher_students`), but are only ever *written* by parents through the service-role route.
4. `src/middleware.ts` excludes `/parent` and `/api/parent` entirely — that flow has nothing to do with Supabase Auth sessions and shouldn't touch that code path.
5. Progress/behavior sharing (`0011_selective_parent_sharing.sql`, `0012_slp_behavior_tracking.sql`) is read-only and opt-in per row: `/parent` only ever shows a goal whose `visible_to_parent` is `true`, and only ever shows a student's behavior summary when that student's `share_behavior_with_parent` is `true` (SLP or Teacher side). There's no route for a parent to write either flag — both are only ever set by the SLP/Teacher from their own student page, through the same RLS-protected update path every other goal/student edit already uses.

**Trade-off:** this moves enforcement from the database (safe regardless of application bugs) into that route-handler code (a bug there could leak across students, since the service key ignores RLS). Known limitations, accepted for simplicity: no rate-limiting/lockout on the login endpoint (a 6-character code from a 32-symbol alphabet is ~1 billion combinations, but nothing throttles repeated guesses), and no CSRF token on the log-practice submission (mitigated by `SameSite=Lax`, but not airtight — worst case is a forged log entry, not a data leak, since reading data still requires the code).

### 4. Email confirmation

By default Supabase requires email confirmation before a new user can sign in. For local testing you can turn this off in **Authentication → Providers → Email → Confirm email**, or just confirm via the email link.

### 5. Run it

```bash
npm run dev
```

Visit `http://localhost:3000`.
