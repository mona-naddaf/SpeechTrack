-- ============================================================
-- Track Templates — reusable, saveable versions of a treatment-plan
-- track (0034_treatment_plan_tracks.sql), so a sequence like "/l/ sound:
-- isolation -> words -> sentences" can be built once and applied to any
-- number of students instead of rebuilt by hand every time.
--
-- Two ways a template gets created (both land in the same tables, so
-- they list/edit/delete identically afterwards):
--   A) "Save as template" on an existing student's track — snapshots its
--      current step sequence (text, response format, target %) into a
--      new template. The original track/goals are untouched.
--   B) Built from scratch in the Track Templates library, with no
--      student attached — name it, pick an area/subject, add ordered
--      steps directly.
--
-- Applying a template creates a brand-new goal_tracks/teacher_goal_tracks
-- row for a student plus one goal per step (first step active, rest
-- queued) — same shape a manually-built track ends up in, so the
-- existing ladder UI and auto-advance trigger (0034) apply unchanged.
-- Templates themselves carry no status/step_order — those only ever
-- exist on real per-student goals.
-- ============================================================


-- ============================================================
-- track_templates — the SLP side.
-- ============================================================
create table if not exists public.track_templates (
  id uuid primary key default gen_random_uuid(),
  slp_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  area_id uuid not null references public.areas(id),
  created_at timestamptz not null default now()
);

create index if not exists track_templates_slp_id_idx on public.track_templates(slp_id);
create index if not exists track_templates_area_id_idx on public.track_templates(area_id);

alter table public.track_templates enable row level security;

create policy "SLPs can view their own track templates"
  on public.track_templates for select
  using (auth.uid() = slp_id);

create policy "SLPs can insert their own track templates"
  on public.track_templates for insert
  with check (auth.uid() = slp_id);

create policy "SLPs can update their own track templates"
  on public.track_templates for update
  using (auth.uid() = slp_id);

create policy "SLPs can delete their own track templates"
  on public.track_templates for delete
  using (auth.uid() = slp_id);


-- ============================================================
-- track_template_steps — no slp_id column of its own; ownership is via
-- track_templates.slp_id (same pattern as assessment_questions ->
-- assessments in 0005_assessments.sql).
-- ============================================================
create table if not exists public.track_template_steps (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.track_templates(id) on delete cascade,
  order_index integer not null,
  goal_text text not null,
  response_format_id uuid references public.response_formats(id) on delete set null,
  target_percent integer,
  created_at timestamptz not null default now(),
  constraint track_template_steps_target_percent_range check (
    target_percent is null or (target_percent >= 0 and target_percent <= 100)
  )
);

create index if not exists track_template_steps_template_id_idx
  on public.track_template_steps(template_id);

alter table public.track_template_steps enable row level security;

create policy "SLPs can view steps in their own track templates"
  on public.track_template_steps for select
  using (
    exists (
      select 1 from public.track_templates t
      where t.id = track_template_steps.template_id and t.slp_id = auth.uid()
    )
  );

create policy "SLPs can insert steps in their own track templates"
  on public.track_template_steps for insert
  with check (
    exists (
      select 1 from public.track_templates t
      where t.id = track_template_steps.template_id and t.slp_id = auth.uid()
    )
  );

create policy "SLPs can update steps in their own track templates"
  on public.track_template_steps for update
  using (
    exists (
      select 1 from public.track_templates t
      where t.id = track_template_steps.template_id and t.slp_id = auth.uid()
    )
  );

create policy "SLPs can delete steps in their own track templates"
  on public.track_template_steps for delete
  using (
    exists (
      select 1 from public.track_templates t
      where t.id = track_template_steps.template_id and t.slp_id = auth.uid()
    )
  );


-- ============================================================
-- teacher_track_templates — the Teacher equivalent of track_templates.
-- ============================================================
create table if not exists public.teacher_track_templates (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  subject_id uuid not null references public.teacher_subjects(id),
  created_at timestamptz not null default now()
);

create index if not exists teacher_track_templates_teacher_id_idx on public.teacher_track_templates(teacher_id);
create index if not exists teacher_track_templates_subject_id_idx on public.teacher_track_templates(subject_id);

alter table public.teacher_track_templates enable row level security;

create policy "Teachers can view their own track templates"
  on public.teacher_track_templates for select
  using (auth.uid() = teacher_id);

create policy "Teachers can insert their own track templates"
  on public.teacher_track_templates for insert
  with check (auth.uid() = teacher_id);

create policy "Teachers can update their own track templates"
  on public.teacher_track_templates for update
  using (auth.uid() = teacher_id);

create policy "Teachers can delete their own track templates"
  on public.teacher_track_templates for delete
  using (auth.uid() = teacher_id);


-- ============================================================
-- teacher_track_template_steps — the Teacher equivalent of
-- track_template_steps.
-- ============================================================
create table if not exists public.teacher_track_template_steps (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.teacher_track_templates(id) on delete cascade,
  order_index integer not null,
  goal_text text not null,
  response_format_id uuid references public.teacher_response_formats(id) on delete set null,
  target_percent integer,
  created_at timestamptz not null default now(),
  constraint teacher_track_template_steps_target_percent_range check (
    target_percent is null or (target_percent >= 0 and target_percent <= 100)
  )
);

create index if not exists teacher_track_template_steps_template_id_idx
  on public.teacher_track_template_steps(template_id);

alter table public.teacher_track_template_steps enable row level security;

create policy "Teachers can view steps in their own track templates"
  on public.teacher_track_template_steps for select
  using (
    exists (
      select 1 from public.teacher_track_templates t
      where t.id = teacher_track_template_steps.template_id and t.teacher_id = auth.uid()
    )
  );

create policy "Teachers can insert steps in their own track templates"
  on public.teacher_track_template_steps for insert
  with check (
    exists (
      select 1 from public.teacher_track_templates t
      where t.id = teacher_track_template_steps.template_id and t.teacher_id = auth.uid()
    )
  );

create policy "Teachers can update steps in their own track templates"
  on public.teacher_track_template_steps for update
  using (
    exists (
      select 1 from public.teacher_track_templates t
      where t.id = teacher_track_template_steps.template_id and t.teacher_id = auth.uid()
    )
  );

create policy "Teachers can delete steps in their own track templates"
  on public.teacher_track_template_steps for delete
  using (
    exists (
      select 1 from public.teacher_track_templates t
      where t.id = teacher_track_template_steps.template_id and t.teacher_id = auth.uid()
    )
  );
