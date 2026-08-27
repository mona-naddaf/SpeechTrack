-- ============================================================
-- trials.material_id / teacher_trials.material_id — optional link from
-- a logged trial to the material bank entry that was active for that
-- goal at the time, so past performance can be broken down by material
-- ("Last used: X% ..." on the session page). Nullable and defaulting to
-- nothing selected — every trial logged before this migration, and any
-- trial logged without picking a material, behaves exactly as before.
-- `on delete set null` rather than cascade: deleting a material from the
-- bank shouldn't take historical trial data down with it.
-- ============================================================
alter table public.trials
  add column if not exists material_id uuid references public.materials(id) on delete set null;

create index if not exists trials_material_id_idx on public.trials(material_id);

alter table public.teacher_trials
  add column if not exists material_id uuid references public.teacher_materials(id) on delete set null;

create index if not exists teacher_trials_material_id_idx on public.teacher_trials(material_id);
