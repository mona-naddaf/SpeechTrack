-- ============================================================
-- expected_frequency — per student, how often the SLP/Teacher plans to
-- log sessions for them. Lives on students/teacher_students rather than
-- goals/teacher_goals: sessions (what streaks are computed from) are
-- logged per student, not per goal, so a per-goal frequency wouldn't
-- have a single well-defined cadence to compare session dates against.
--
-- No RLS changes needed: this is just an added column on tables that
-- already have owner-scoped RLS (slp_id / teacher_id), covering every
-- column on the row automatically. Streaks themselves aren't stored —
-- they're computed on the fly from sessions/teacher_sessions and
-- practice_logs/teacher_practice_logs by src/lib/streaks.ts, so no new
-- tables either.
-- ============================================================

alter table public.students
  add column if not exists expected_frequency text not null default 'weekly'
  check (expected_frequency in ('daily', 'few_times_week', 'weekly'));

alter table public.teacher_students
  add column if not exists expected_frequency text not null default 'weekly'
  check (expected_frequency in ('daily', 'few_times_week', 'weekly'));
