-- ============================================================
-- students.avatar / teacher_students.avatar — an optional single-emoji
-- avatar, picked from a small curated set (src/lib/avatar.ts), shown next
-- to the student's name wherever it appears. Null means "not chosen yet" —
-- the UI falls back to a neutral placeholder icon, so no default value or
-- backfill is needed.
-- ============================================================

alter table public.students
  add column if not exists avatar text;

alter table public.teacher_students
  add column if not exists avatar text;


-- ============================================================
-- goals.mastered_at / teacher_goals.mastered_at — when a goal's status
-- last transitioned to "mastered". Needed because status changes aren't
-- otherwise logged anywhere (no updated_at, no history table), and the
-- "Caseload wins" dashboard card needs to count goals mastered in the
-- last 30 days specifically, not just goals that currently sit at
-- "mastered" (which could have gotten there months ago).
--
-- Set/cleared by the app, not a trigger: goals-section.tsx (both sides)
-- already computes "did this edit just transition the status into
-- mastered" for the confetti celebration, so it sets mastered_at = now()
-- at that same point, and clears it back to null if a goal is ever
-- edited back out of "mastered" (so an un-mastered goal can't keep
-- counting as a recent win).
--
-- Deliberately NOT backfilled for goals already sitting at "mastered"
-- before this migration — we have no record of when that happened, and
-- treating "unknown" as "not recent" (null, so it's excluded from the
-- last-30-days count) is the safer default over guessing a date.
-- ============================================================

alter table public.goals
  add column if not exists mastered_at timestamptz;

alter table public.teacher_goals
  add column if not exists mastered_at timestamptz;
