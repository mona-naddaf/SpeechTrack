-- ============================================================
-- response_formats
-- ============================================================
create table if not exists public.response_formats (
  id uuid primary key default gen_random_uuid(),
  slp_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists response_formats_slp_id_idx on public.response_formats(slp_id);

alter table public.response_formats enable row level security;

create policy "SLPs can view their own response formats"
  on public.response_formats for select
  using (auth.uid() = slp_id);

create policy "SLPs can insert their own response formats"
  on public.response_formats for insert
  with check (auth.uid() = slp_id);

create policy "SLPs can update their own response formats"
  on public.response_formats for update
  using (auth.uid() = slp_id);

create policy "SLPs can delete their own response formats"
  on public.response_formats for delete
  using (auth.uid() = slp_id);


-- ============================================================
-- areas
-- ============================================================
create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  slp_id uuid not null references auth.users(id) on delete cascade,
  name text not null
);

create index if not exists areas_slp_id_idx on public.areas(slp_id);

alter table public.areas enable row level security;

create policy "SLPs can view their own areas"
  on public.areas for select
  using (auth.uid() = slp_id);

create policy "SLPs can insert their own areas"
  on public.areas for insert
  with check (auth.uid() = slp_id);

create policy "SLPs can update their own areas"
  on public.areas for update
  using (auth.uid() = slp_id);

create policy "SLPs can delete their own areas"
  on public.areas for delete
  using (auth.uid() = slp_id);


-- ============================================================
-- goals
-- student_id null = goal bank template, not assigned to a student yet.
-- ============================================================
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  slp_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  area_id uuid not null references public.areas(id),
  text text not null,
  response_format_id uuid references public.response_formats(id) on delete set null,
  baseline text,
  target_percent integer,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  constraint goals_target_percent_range check (
    target_percent is null or (target_percent >= 0 and target_percent <= 100)
  ),
  constraint goals_status_check check (status in ('active', 'on_hold', 'mastered'))
);

create index if not exists goals_slp_id_idx on public.goals(slp_id);
create index if not exists goals_student_id_idx on public.goals(student_id);
create index if not exists goals_area_id_idx on public.goals(area_id);

alter table public.goals enable row level security;

create policy "SLPs can view their own goals"
  on public.goals for select
  using (auth.uid() = slp_id);

create policy "SLPs can insert their own goals"
  on public.goals for insert
  with check (auth.uid() = slp_id);

create policy "SLPs can update their own goals"
  on public.goals for update
  using (auth.uid() = slp_id);

create policy "SLPs can delete their own goals"
  on public.goals for delete
  using (auth.uid() = slp_id);


-- ============================================================
-- Seed defaults for every new account (response format + areas)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.response_formats (slp_id, name, type, config)
  values (
    new.id,
    'Cueing hierarchy',
    'cueing_hierarchy',
    jsonb_build_object(
      'levels', jsonb_build_array(
        jsonb_build_object('name', 'Spontaneous', 'color', 'green', 'is_independent', true),
        jsonb_build_object('name', 'Visual support', 'color', 'teal', 'is_independent', false),
        jsonb_build_object('name', 'Verbal support', 'color', 'amber', 'is_independent', false),
        jsonb_build_object('name', 'After modeling', 'color', 'clay', 'is_independent', false),
        jsonb_build_object('name', 'No answer', 'color', 'grey', 'is_independent', false)
      )
    )
  );

  insert into public.areas (slp_id, name)
  values
    (new.id, 'Speech sounds'),
    (new.id, 'Articulation'),
    (new.id, 'Phonology'),
    (new.id, 'Receptive language'),
    (new.id, 'Expressive language'),
    (new.id, 'Fluency'),
    (new.id, 'Voice'),
    (new.id, 'Pragmatics/Social'),
    (new.id, 'Literacy'),
    (new.id, 'AAC');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================
-- Backfill defaults for accounts created before this migration
-- (safe to re-run: skips anyone who already has the rows)
-- ============================================================
insert into public.response_formats (slp_id, name, type, config)
select
  u.id,
  'Cueing hierarchy',
  'cueing_hierarchy',
  jsonb_build_object(
    'levels', jsonb_build_array(
      jsonb_build_object('name', 'Spontaneous', 'color', 'green', 'is_independent', true),
      jsonb_build_object('name', 'Visual support', 'color', 'teal', 'is_independent', false),
      jsonb_build_object('name', 'Verbal support', 'color', 'amber', 'is_independent', false),
      jsonb_build_object('name', 'After modeling', 'color', 'clay', 'is_independent', false),
      jsonb_build_object('name', 'No answer', 'color', 'grey', 'is_independent', false)
    )
  )
from auth.users u
where not exists (
  select 1 from public.response_formats rf
  where rf.slp_id = u.id and rf.type = 'cueing_hierarchy'
);

insert into public.areas (slp_id, name)
select u.id, a.name
from auth.users u
cross join (
  values
    ('Speech sounds'), ('Articulation'), ('Phonology'), ('Receptive language'),
    ('Expressive language'), ('Fluency'), ('Voice'), ('Pragmatics/Social'),
    ('Literacy'), ('AAC')
) as a(name)
where not exists (
  select 1 from public.areas ar where ar.slp_id = u.id
);
