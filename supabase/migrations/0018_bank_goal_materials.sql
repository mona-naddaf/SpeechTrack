-- ============================================================
-- goals.source_bank_goal_id / teacher_goals.source_bank_goal_id — set
-- automatically when a goal is created by picking "From goal bank",
-- pointing at the bank template (student_id is null) it came from.
-- Freehand goals (written from scratch) leave this null, same as every
-- goal created before this migration — there's no reliable way to
-- backfill origin for those, so this only takes effect going forward.
--
-- This is what lets a material linked to a bank goal (from
-- /toolkit/materials) apply to every student who's been assigned that
-- bank goal, instead of only the one specific student-goal row that
-- happened to get checked in the linking picker.
-- ============================================================
alter table public.goals
  add column if not exists source_bank_goal_id uuid references public.goals(id) on delete set null;

create index if not exists goals_source_bank_goal_id_idx on public.goals(source_bank_goal_id);

alter table public.teacher_goals
  add column if not exists source_bank_goal_id uuid references public.teacher_goals(id) on delete set null;

create index if not exists teacher_goals_source_bank_goal_id_idx on public.teacher_goals(source_bank_goal_id);
