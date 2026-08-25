-- ============================================================
-- teacher_behavior_types — the Teacher equivalent of a small tag
-- palette, same editable pattern as teacher_subjects (no created_at,
-- just id/teacher_id/name — plus a color for the badge).
-- ============================================================
create table if not exists public.teacher_behavior_types (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null
);

create index if not exists teacher_behavior_types_teacher_id_idx on public.teacher_behavior_types(teacher_id);

alter table public.teacher_behavior_types enable row level security;

create policy "Teachers can view their own behavior types"
  on public.teacher_behavior_types for select
  using (auth.uid() = teacher_id);

create policy "Teachers can insert their own behavior types"
  on public.teacher_behavior_types for insert
  with check (auth.uid() = teacher_id);

create policy "Teachers can update their own behavior types"
  on public.teacher_behavior_types for update
  using (auth.uid() = teacher_id);

create policy "Teachers can delete their own behavior types"
  on public.teacher_behavior_types for delete
  using (auth.uid() = teacher_id);


-- ============================================================
-- behavior_logs — one row per logged behavior incident/note for a
-- Teacher's student. Has its own teacher_id column (unlike trials or
-- practice_logs, which derive ownership through a parent row), so RLS
-- is the plain direct-column pattern used everywhere else in this app.
-- ============================================================
create table if not exists public.behavior_logs (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.teacher_students(id) on delete cascade,
  date date not null default current_date,
  behavior_type_id uuid not null references public.teacher_behavior_types(id),
  severity integer,
  note text,
  created_at timestamptz not null default now(),
  constraint behavior_logs_severity_range check (
    severity is null or (severity >= 1 and severity <= 3)
  )
);

create index if not exists behavior_logs_teacher_id_idx on public.behavior_logs(teacher_id);
create index if not exists behavior_logs_student_id_idx on public.behavior_logs(student_id);
create index if not exists behavior_logs_behavior_type_id_idx on public.behavior_logs(behavior_type_id);

alter table public.behavior_logs enable row level security;

create policy "Teachers can view their own behavior logs"
  on public.behavior_logs for select
  using (auth.uid() = teacher_id);

create policy "Teachers can insert their own behavior logs"
  on public.behavior_logs for insert
  with check (auth.uid() = teacher_id);

create policy "Teachers can update their own behavior logs"
  on public.behavior_logs for update
  using (auth.uid() = teacher_id);

create policy "Teachers can delete their own behavior logs"
  on public.behavior_logs for delete
  using (auth.uid() = teacher_id);


-- ============================================================
-- Extend new-Teacher-account seeding with default behavior types.
-- Only the Teacher branch changes; SLP seeding is untouched.
-- Existing Teacher accounts (there may be some by now) are backfilled
-- below, same "skip anyone who already has rows" approach as the
-- original 0002 migration's SLP backfill.
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
  end if;

  return new;
end;
$$;

-- Backfill default behavior types for any Teacher account created between
-- 0007 and this migration (safe to re-run: skips anyone who already has
-- behavior types).
insert into public.teacher_behavior_types (teacher_id, name, color)
select u.id, t.name, t.color
from auth.users u
cross join (
  values
    ('Off-task', 'amber'),
    ('Disruptive', 'clay'),
    ('Outburst', 'red'),
    ('Great participation', 'green'),
    ('Kind to others', 'teal')
) as t(name, color)
where coalesce(u.raw_user_meta_data->>'role', 'slp') = 'teacher'
  and not exists (
    select 1 from public.teacher_behavior_types bt where bt.teacher_id = u.id
  );
