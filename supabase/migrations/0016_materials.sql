-- ============================================================
-- materials — the SLP's material bank. Always a link (Drive/Dropbox/
-- YouTube/etc.), never an uploaded file. `visibility` anticipates
-- sharing/selling materials with other SLPs later, but only "private"
-- is functional right now — the app only ever writes/reads "private"
-- today; "shared"/"for_sale" exist here so the column doesn't need a
-- follow-up migration once that ships.
-- ============================================================
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  slp_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  url text not null,
  description text,
  area_id uuid not null references public.areas(id),
  visibility text not null default 'private',
  created_at timestamptz not null default now(),
  constraint materials_visibility_check check (visibility in ('private', 'shared', 'for_sale'))
);

create index if not exists materials_slp_id_idx on public.materials(slp_id);
create index if not exists materials_area_id_idx on public.materials(area_id);

alter table public.materials enable row level security;

create policy "SLPs can view their own materials"
  on public.materials for select
  using (auth.uid() = slp_id);

create policy "SLPs can insert their own materials"
  on public.materials for insert
  with check (auth.uid() = slp_id);

create policy "SLPs can update their own materials"
  on public.materials for update
  using (auth.uid() = slp_id);

create policy "SLPs can delete their own materials"
  on public.materials for delete
  using (auth.uid() = slp_id);


-- ============================================================
-- material_goals — many-to-many, optional link from a material to any
-- of the SLP's goals (bank templates or student-assigned). No slp_id
-- column of its own — ownership is via materials.slp_id, same pattern
-- as assessment_areas -> assessments.
-- ============================================================
create table if not exists public.material_goals (
  material_id uuid not null references public.materials(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  primary key (material_id, goal_id)
);

create index if not exists material_goals_material_id_idx on public.material_goals(material_id);
create index if not exists material_goals_goal_id_idx on public.material_goals(goal_id);

alter table public.material_goals enable row level security;

create policy "SLPs can view goal links on their own materials"
  on public.material_goals for select
  using (
    exists (
      select 1 from public.materials m
      where m.id = material_goals.material_id and m.slp_id = auth.uid()
    )
  );

create policy "SLPs can insert goal links on their own materials"
  on public.material_goals for insert
  with check (
    exists (
      select 1 from public.materials m
      where m.id = material_goals.material_id and m.slp_id = auth.uid()
    )
  );

create policy "SLPs can delete goal links on their own materials"
  on public.material_goals for delete
  using (
    exists (
      select 1 from public.materials m
      where m.id = material_goals.material_id and m.slp_id = auth.uid()
    )
  );


-- ============================================================
-- teacher_materials — the Teacher equivalent of `materials`
-- (subject_id in place of area_id, teacher_id in place of slp_id).
-- ============================================================
create table if not exists public.teacher_materials (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  url text not null,
  description text,
  subject_id uuid not null references public.teacher_subjects(id),
  visibility text not null default 'private',
  created_at timestamptz not null default now(),
  constraint teacher_materials_visibility_check check (visibility in ('private', 'shared', 'for_sale'))
);

create index if not exists teacher_materials_teacher_id_idx on public.teacher_materials(teacher_id);
create index if not exists teacher_materials_subject_id_idx on public.teacher_materials(subject_id);

alter table public.teacher_materials enable row level security;

create policy "Teachers can view their own materials"
  on public.teacher_materials for select
  using (auth.uid() = teacher_id);

create policy "Teachers can insert their own materials"
  on public.teacher_materials for insert
  with check (auth.uid() = teacher_id);

create policy "Teachers can update their own materials"
  on public.teacher_materials for update
  using (auth.uid() = teacher_id);

create policy "Teachers can delete their own materials"
  on public.teacher_materials for delete
  using (auth.uid() = teacher_id);


-- ============================================================
-- teacher_material_goals — the Teacher equivalent of `material_goals`.
-- ============================================================
create table if not exists public.teacher_material_goals (
  material_id uuid not null references public.teacher_materials(id) on delete cascade,
  goal_id uuid not null references public.teacher_goals(id) on delete cascade,
  primary key (material_id, goal_id)
);

create index if not exists teacher_material_goals_material_id_idx on public.teacher_material_goals(material_id);
create index if not exists teacher_material_goals_goal_id_idx on public.teacher_material_goals(goal_id);

alter table public.teacher_material_goals enable row level security;

create policy "Teachers can view goal links on their own materials"
  on public.teacher_material_goals for select
  using (
    exists (
      select 1 from public.teacher_materials m
      where m.id = teacher_material_goals.material_id and m.teacher_id = auth.uid()
    )
  );

create policy "Teachers can insert goal links on their own materials"
  on public.teacher_material_goals for insert
  with check (
    exists (
      select 1 from public.teacher_materials m
      where m.id = teacher_material_goals.material_id and m.teacher_id = auth.uid()
    )
  );

create policy "Teachers can delete goal links on their own materials"
  on public.teacher_material_goals for delete
  using (
    exists (
      select 1 from public.teacher_materials m
      where m.id = teacher_material_goals.material_id and m.teacher_id = auth.uid()
    )
  );
