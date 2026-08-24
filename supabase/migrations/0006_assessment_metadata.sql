-- ============================================================
-- assessments.kind / assessments.formality
-- Both nullable at the DB level — required going forward is an
-- app-layer rule (enforced in the create/edit forms), not a DB
-- constraint, so existing assessments created before this migration
-- keep working and just show as "not set" until edited.
-- ============================================================
alter table public.assessments
  add column if not exists kind text,
  add column if not exists formality text;

alter table public.assessments
  add constraint assessments_kind_check check (kind is null or kind in ('screening', 'assessment'));

alter table public.assessments
  add constraint assessments_formality_check check (formality is null or formality in ('formal', 'informal'));


-- ============================================================
-- assessment_areas — many-to-many between assessments and the
-- SLP's existing areas table (same one goals use). No slp_id column
-- of its own — ownership is via assessments.slp_id, same pattern as
-- assessment_questions -> assessments.
-- ============================================================
create table if not exists public.assessment_areas (
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  area_id uuid not null references public.areas(id) on delete cascade,
  primary key (assessment_id, area_id)
);

create index if not exists assessment_areas_assessment_id_idx on public.assessment_areas(assessment_id);
create index if not exists assessment_areas_area_id_idx on public.assessment_areas(area_id);

alter table public.assessment_areas enable row level security;

create policy "SLPs can view areas on their own assessments"
  on public.assessment_areas for select
  using (
    exists (
      select 1 from public.assessments a
      where a.id = assessment_areas.assessment_id and a.slp_id = auth.uid()
    )
  );

create policy "SLPs can insert areas on their own assessments"
  on public.assessment_areas for insert
  with check (
    exists (
      select 1 from public.assessments a
      where a.id = assessment_areas.assessment_id and a.slp_id = auth.uid()
    )
  );

create policy "SLPs can delete areas on their own assessments"
  on public.assessment_areas for delete
  using (
    exists (
      select 1 from public.assessments a
      where a.id = assessment_areas.assessment_id and a.slp_id = auth.uid()
    )
  );
