-- ============================================================
-- behavior_types — the SLP equivalent of teacher_behavior_types, same
-- editable tag-palette pattern (no created_at, just id/slp_id/name/color).
-- ============================================================
create table if not exists public.behavior_types (
  id uuid primary key default gen_random_uuid(),
  slp_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null
);

create index if not exists behavior_types_slp_id_idx on public.behavior_types(slp_id);

alter table public.behavior_types enable row level security;

create policy "SLPs can view their own behavior types"
  on public.behavior_types for select
  using (auth.uid() = slp_id);

create policy "SLPs can insert their own behavior types"
  on public.behavior_types for insert
  with check (auth.uid() = slp_id);

create policy "SLPs can update their own behavior types"
  on public.behavior_types for update
  using (auth.uid() = slp_id);

create policy "SLPs can delete their own behavior types"
  on public.behavior_types for delete
  using (auth.uid() = slp_id);


-- ============================================================
-- slp_behavior_logs — one row per logged behavior incident/note for an
-- SLP's student. Same shape/pattern as behavior_logs: has its own slp_id
-- column (unlike trials/practice_logs, which derive ownership through a
-- parent row), so RLS is the plain direct-column pattern.
-- ============================================================
create table if not exists public.slp_behavior_logs (
  id uuid primary key default gen_random_uuid(),
  slp_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  date date not null default current_date,
  behavior_type_id uuid not null references public.behavior_types(id),
  severity integer,
  note text,
  created_at timestamptz not null default now(),
  constraint slp_behavior_logs_severity_range check (
    severity is null or (severity >= 1 and severity <= 3)
  )
);

create index if not exists slp_behavior_logs_slp_id_idx on public.slp_behavior_logs(slp_id);
create index if not exists slp_behavior_logs_student_id_idx on public.slp_behavior_logs(student_id);
create index if not exists slp_behavior_logs_behavior_type_id_idx on public.slp_behavior_logs(behavior_type_id);

alter table public.slp_behavior_logs enable row level security;

create policy "SLPs can view their own behavior logs"
  on public.slp_behavior_logs for select
  using (auth.uid() = slp_id);

create policy "SLPs can insert their own behavior logs"
  on public.slp_behavior_logs for insert
  with check (auth.uid() = slp_id);

create policy "SLPs can update their own behavior logs"
  on public.slp_behavior_logs for update
  using (auth.uid() = slp_id);

create policy "SLPs can delete their own behavior logs"
  on public.slp_behavior_logs for delete
  using (auth.uid() = slp_id);


-- ============================================================
-- students.share_behavior_with_parent — the SLP equivalent of
-- teacher_students.share_behavior_with_parent (0011_selective_parent_sharing.sql).
-- Same default-false, no-RLS-change column addition.
-- ============================================================
alter table public.students
  add column if not exists share_behavior_with_parent boolean not null default false;


-- ============================================================
-- Extend new-SLP-account seeding with default behavior types, mirroring
-- 0008's Teacher-branch addition. Only the SLP (else) branch changes;
-- Teacher seeding is untouched.
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

    insert into public.teacher_behavior_types (teacher_id, name, color)
    values
      (new.id, 'Off-task', 'amber'),
      (new.id, 'Disruptive', 'clay'),
      (new.id, 'Outburst', 'red'),
      (new.id, 'Great participation', 'green'),
      (new.id, 'Kind to others', 'teal');
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

    insert into public.behavior_types (slp_id, name, color)
    values
      (new.id, 'Off-task', 'amber'),
      (new.id, 'Frustrated', 'clay'),
      (new.id, 'Refused task', 'red'),
      (new.id, 'Great effort', 'green'),
      (new.id, 'Positive interaction', 'teal');
  end if;

  return new;
end;
$$;

-- Backfill default behavior types for any SLP account created before this
-- migration (safe to re-run: skips anyone who already has behavior types).
-- Same approach as 0008's Teacher-side backfill.
insert into public.behavior_types (slp_id, name, color)
select u.id, t.name, t.color
from auth.users u
cross join (
  values
    ('Off-task', 'amber'),
    ('Frustrated', 'clay'),
    ('Refused task', 'red'),
    ('Great effort', 'green'),
    ('Positive interaction', 'teal')
) as t(name, color)
where coalesce(u.raw_user_meta_data->>'role', 'slp') = 'slp'
  and not exists (
    select 1 from public.behavior_types bt where bt.slp_id = u.id
  );
