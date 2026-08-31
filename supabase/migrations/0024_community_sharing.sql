-- ============================================================
-- Community sharing — step 1: data model only. Adds "shared"
-- visibility to response formats and bank goals (Materials already
-- had a visibility column that supports "shared", it just wasn't
-- selectable in the UI yet — see src/lib/materials.ts). Nothing is
-- actually browsable/discoverable by other accounts yet; that's a
-- later step. This migration only gets the columns in place so the
-- app can correctly mark things as shared.
--
-- The "display name" half of this feature (what a shared item is
-- credited to) isn't a DB column at all — same as full_name, it
-- lives in Supabase auth user_metadata (see
-- src/components/display-name-form.tsx), so there's nothing to
-- migrate for it.
-- ============================================================

alter table public.response_formats
  add column if not exists visibility text not null default 'private';

alter table public.response_formats
  add constraint response_formats_visibility_check check (visibility in ('private', 'shared'));

alter table public.teacher_response_formats
  add column if not exists visibility text not null default 'private';

alter table public.teacher_response_formats
  add constraint teacher_response_formats_visibility_check check (visibility in ('private', 'shared'));


-- ============================================================
-- goals.visibility / teacher_goals.visibility — only meaningful for
-- bank goals (student_id is null). An assigned student goal is tied
-- to a real child, so it must never be shareable. The app UI never
-- exposes this field on the assigned-goal form to begin with (only
-- the goal-bank forms do), but the second check constraint on each
-- table below is the actual guarantee, enforced at the DB level
-- regardless of what any client sends.
-- ============================================================
alter table public.goals
  add column if not exists visibility text not null default 'private';

alter table public.goals
  add constraint goals_visibility_check check (visibility in ('private', 'shared'));

alter table public.goals
  add constraint goals_visibility_bank_only_check check (visibility = 'private' or student_id is null);

alter table public.teacher_goals
  add column if not exists visibility text not null default 'private';

alter table public.teacher_goals
  add constraint teacher_goals_visibility_check check (visibility in ('private', 'shared'));

alter table public.teacher_goals
  add constraint teacher_goals_visibility_bank_only_check check (visibility = 'private' or student_id is null);
