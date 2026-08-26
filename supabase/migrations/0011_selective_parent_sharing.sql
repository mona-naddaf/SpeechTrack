-- ============================================================
-- Selective parent sharing — the SLP/Teacher decides exactly what a
-- parent can see beyond home practice. Just three added columns on
-- existing tables; no new ownership pattern, so no RLS changes are
-- needed — the existing owner-scoped update policies on goals/
-- teacher_goals/teacher_students already cover these columns, and the
-- parent-facing /parent routes read through the service-role client
-- (bypasses RLS) exactly as they already do for home practice.
-- ============================================================

alter table public.goals
  add column if not exists visible_to_parent boolean not null default false;

alter table public.teacher_goals
  add column if not exists visible_to_parent boolean not null default false;

alter table public.teacher_students
  add column if not exists share_behavior_with_parent boolean not null default false;
