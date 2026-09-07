-- ============================================================
-- Per-session note sharing with parents — same pattern as
-- 0011_selective_parent_sharing.sql's goals.visible_to_parent: just an
-- added column on an existing owner-scoped table, so no RLS changes are
-- needed (the existing "SLPs/Teachers can update their own sessions"
-- policies already cover it), and the parent-facing /parent route reads
-- through the service-role client exactly as it already does for goals.
-- ============================================================

alter table public.sessions
  add column if not exists visible_to_parent boolean not null default false;

alter table public.teacher_sessions
  add column if not exists visible_to_parent boolean not null default false;
