-- ============================================================
-- Community sharing — prevent duplicate "Add to my bank" copies.
--
-- copied_from_id: set automatically when a row is created via "Add to
-- my bank" on /toolkit/community or /teacher/toolkit/community,
-- pointing at the original shared item's id — always within the SAME
-- table (a goal copy points at a goals.id, a format copy at a
-- response_formats.id, a material copy at a materials.id — never
-- cross-table). Nullable: every pre-existing row, and anything created
-- directly rather than via Community, has no source and stays null
-- forever. `on delete set null`, same treatment as
-- goals.source_bank_goal_id (0018_bank_goal_materials.sql) — deleting
-- the original shared item later shouldn't cascade-delete anyone's
-- copy of it, just orphan the reference.
--
-- Deliberately no uniqueness constraint here. "Already has a copy" is
-- checked at the app level instead (src/components/community-browse.tsx):
-- once from the copied_from_id values fetched on page load, and again
-- right before every insert. A hard per-account unique constraint on
-- (owner, copied_from_id) would also incorrectly conflict across two
-- independent copy paths that can legitimately land on the same source
-- id — e.g. she "Add to my bank"s a shared response format directly on
-- the Formats tab, and separately "Add to my bank"s a shared goal that
-- references that very same format: each is one rightful copy of that
-- original, reached two different ways. The goal-copy path already
-- checks for and reuses her existing copy of the referenced format
-- instead of making a second one, so the real guarantee is app-level
-- dedup logic, not a DB constraint.
-- ============================================================

alter table public.goals
  add column if not exists copied_from_id uuid references public.goals(id) on delete set null;
alter table public.teacher_goals
  add column if not exists copied_from_id uuid references public.teacher_goals(id) on delete set null;

alter table public.response_formats
  add column if not exists copied_from_id uuid references public.response_formats(id) on delete set null;
alter table public.teacher_response_formats
  add column if not exists copied_from_id uuid references public.teacher_response_formats(id) on delete set null;

alter table public.materials
  add column if not exists copied_from_id uuid references public.materials(id) on delete set null;
alter table public.teacher_materials
  add column if not exists copied_from_id uuid references public.teacher_materials(id) on delete set null;

create index if not exists goals_copied_from_id_idx on public.goals(copied_from_id) where copied_from_id is not null;
create index if not exists teacher_goals_copied_from_id_idx on public.teacher_goals(copied_from_id) where copied_from_id is not null;
create index if not exists response_formats_copied_from_id_idx on public.response_formats(copied_from_id) where copied_from_id is not null;
create index if not exists teacher_response_formats_copied_from_id_idx on public.teacher_response_formats(copied_from_id) where copied_from_id is not null;
create index if not exists materials_copied_from_id_idx on public.materials(copied_from_id) where copied_from_id is not null;
create index if not exists teacher_materials_copied_from_id_idx on public.teacher_materials(copied_from_id) where copied_from_id is not null;

-- No RLS changes: copied_from_id is just another column on tables that
-- already have owner + shared SELECT policies (0002/0007/0016/0025) and
-- owner-only insert/update/delete — nothing new is being granted.
