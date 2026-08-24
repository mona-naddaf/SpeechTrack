-- ============================================================
-- teacher_students — one row per student, owned by the Teacher who
-- created them. Same shape/RLS pattern as `students`, but a fully
-- separate table: teachers and SLPs never share students or data.
-- ============================================================
create table if not exists public.teacher_students (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  class text,
  created_at timestamptz not null default now()
);

create index if not exists teacher_students_teacher_id_idx on public.teacher_students(teacher_id);

alter table public.teacher_students enable row level security;

create policy "Teachers can view their own students"
  on public.teacher_students for select
  using (auth.uid() = teacher_id);

create policy "Teachers can insert their own students"
  on public.teacher_students for insert
  with check (auth.uid() = teacher_id);

create policy "Teachers can update their own students"
  on public.teacher_students for update
  using (auth.uid() = teacher_id);

create policy "Teachers can delete their own students"
  on public.teacher_students for delete
  using (auth.uid() = teacher_id);


-- ============================================================
-- teacher_subjects — the Teacher equivalent of `areas`.
-- ============================================================
create table if not exists public.teacher_subjects (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name text not null
);

create index if not exists teacher_subjects_teacher_id_idx on public.teacher_subjects(teacher_id);

alter table public.teacher_subjects enable row level security;

create policy "Teachers can view their own subjects"
  on public.teacher_subjects for select
  using (auth.uid() = teacher_id);

create policy "Teachers can insert their own subjects"
  on public.teacher_subjects for insert
  with check (auth.uid() = teacher_id);

create policy "Teachers can update their own subjects"
  on public.teacher_subjects for update
  using (auth.uid() = teacher_id);

create policy "Teachers can delete their own subjects"
  on public.teacher_subjects for delete
  using (auth.uid() = teacher_id);


-- ============================================================
-- teacher_response_formats — the Teacher equivalent of `response_formats`.
-- Same `type` + jsonb `config` shape (cueing_hierarchy, correct_incorrect,
-- rating_scale, ...), so the SLP-side editor UI patterns apply unchanged,
-- just pointed at this table.
-- ============================================================
create table if not exists public.teacher_response_formats (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists teacher_response_formats_teacher_id_idx on public.teacher_response_formats(teacher_id);

alter table public.teacher_response_formats enable row level security;

create policy "Teachers can view their own response formats"
  on public.teacher_response_formats for select
  using (auth.uid() = teacher_id);

create policy "Teachers can insert their own response formats"
  on public.teacher_response_formats for insert
  with check (auth.uid() = teacher_id);

create policy "Teachers can update their own response formats"
  on public.teacher_response_formats for update
  using (auth.uid() = teacher_id);

create policy "Teachers can delete their own response formats"
  on public.teacher_response_formats for delete
  using (auth.uid() = teacher_id);


-- ============================================================
-- teacher_goals — the Teacher equivalent of `goals`.
-- student_id null = goal bank template, not assigned to a student yet.
-- ============================================================
create table if not exists public.teacher_goals (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid references public.teacher_students(id) on delete cascade,
  subject_id uuid not null references public.teacher_subjects(id),
  text text not null,
  response_format_id uuid references public.teacher_response_formats(id) on delete set null,
  baseline text,
  target_percent integer,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  constraint teacher_goals_target_percent_range check (
    target_percent is null or (target_percent >= 0 and target_percent <= 100)
  ),
  constraint teacher_goals_status_check check (status in ('active', 'on_hold', 'mastered'))
);

create index if not exists teacher_goals_teacher_id_idx on public.teacher_goals(teacher_id);
create index if not exists teacher_goals_student_id_idx on public.teacher_goals(student_id);
create index if not exists teacher_goals_subject_id_idx on public.teacher_goals(subject_id);

alter table public.teacher_goals enable row level security;

create policy "Teachers can view their own goals"
  on public.teacher_goals for select
  using (auth.uid() = teacher_id);

create policy "Teachers can insert their own goals"
  on public.teacher_goals for insert
  with check (auth.uid() = teacher_id);

create policy "Teachers can update their own goals"
  on public.teacher_goals for update
  using (auth.uid() = teacher_id);

create policy "Teachers can delete their own goals"
  on public.teacher_goals for delete
  using (auth.uid() = teacher_id);


-- ============================================================
-- New-account seeding — make handle_new_user() role-aware.
-- SLP signups keep seeding response_formats/areas exactly as before;
-- Teacher signups (new.raw_user_meta_data->>'role' = 'teacher') seed
-- teacher_response_formats/teacher_subjects instead. Existing accounts
-- are untouched either way — this only affects the trigger that fires
-- on new signups going forward, so no backfill is needed here (there
-- are no teacher accounts yet).
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  account_role text := coalesce(new.raw_user_meta_data->>'role', 'slp');
begin
  if account_role = 'teacher' then
    insert into public.teacher_response_formats (teacher_id, name, type, config)
    values (
      new.id,
      'Correct/Incorrect',
      'correct_incorrect',
      jsonb_build_object('correctLabel', 'Correct', 'incorrectLabel', 'Incorrect')
    );

    insert into public.teacher_subjects (teacher_id, name)
    values
      (new.id, 'Math'),
      (new.id, 'Reading'),
      (new.id, 'Writing'),
      (new.id, 'Spelling'),
      (new.id, 'Science'),
      (new.id, 'Social Studies'),
      (new.id, 'Behavior/Social-Emotional');
  else
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
  end if;

  return new;
end;
$$;

-- Trigger already exists (created in 0002_response_formats_and_goals.sql)
-- and points at this function by name, so no need to redrop/recreate it.
