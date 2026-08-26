-- ============================================================
-- teacher_students.parent_access_code — same pattern as
-- students.parent_access_code (0004), reusing the same generator/trigger
-- functions rather than duplicating them.
--
-- generate_parent_access_code() is widened here to check uniqueness
-- against BOTH students and teacher_students, since a parent's code now
-- has to unambiguously resolve to exactly one student across either
-- table (see /api/parent/login). set_parent_access_code() itself needs
-- no change — it just calls the generator and doesn't reference a table
-- name, so the existing trigger on `students` keeps working unchanged.
-- ============================================================
create or replace function public.generate_parent_access_code()
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  taken boolean;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
    end loop;
    select exists(
      select 1 from public.students where parent_access_code = code
      union all
      select 1 from public.teacher_students where parent_access_code = code
    ) into taken;
    exit when not taken;
  end loop;
  return code;
end;
$$;

alter table public.teacher_students
  add column if not exists parent_access_code text;

drop trigger if exists set_parent_access_code_trigger on public.teacher_students;
create trigger set_parent_access_code_trigger
  before insert on public.teacher_students
  for each row execute function public.set_parent_access_code();

-- Backfill any teacher_students that already existed, then lock the
-- column down, same as 0004 did for students.
update public.teacher_students
set parent_access_code = public.generate_parent_access_code()
where parent_access_code is null;

alter table public.teacher_students
  alter column parent_access_code set not null;

create unique index if not exists teacher_students_parent_access_code_idx
  on public.teacher_students (parent_access_code);


-- ============================================================
-- teacher_home_practice_items — Teacher-managed, normal teacher_id RLS.
-- Same shape/pattern as home_practice_items (0004), pointed at
-- teacher_students instead of students.
-- ============================================================
create table if not exists public.teacher_home_practice_items (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.teacher_students(id) on delete cascade,
  what_to_practice text not null,
  how_to_practice text,
  last_worked_date date,
  created_at timestamptz not null default now()
);

create index if not exists teacher_home_practice_items_teacher_id_idx on public.teacher_home_practice_items(teacher_id);
create index if not exists teacher_home_practice_items_student_id_idx on public.teacher_home_practice_items(student_id);

alter table public.teacher_home_practice_items enable row level security;

create policy "Teachers can view their own home practice items"
  on public.teacher_home_practice_items for select
  using (auth.uid() = teacher_id);

create policy "Teachers can insert their own home practice items"
  on public.teacher_home_practice_items for insert
  with check (auth.uid() = teacher_id);

create policy "Teachers can update their own home practice items"
  on public.teacher_home_practice_items for update
  using (auth.uid() = teacher_id);

create policy "Teachers can delete their own home practice items"
  on public.teacher_home_practice_items for delete
  using (auth.uid() = teacher_id);


-- ============================================================
-- teacher_practice_logs — written by parents through a service-role API
-- route (src/app/api/parent/**), same pattern as practice_logs (0004).
-- No teacher_id column of its own; read access is scoped by joining to
-- teacher_students.teacher_id. Deliberately no insert/update/delete
-- policy for the authenticated role — only the service-role route
-- (which bypasses RLS) creates rows here.
-- ============================================================
create table if not exists public.teacher_practice_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.teacher_students(id) on delete cascade,
  date date not null default current_date,
  activities jsonb not null default '[]'::jsonb,
  how_it_went text not null,
  note text,
  created_at timestamptz not null default now(),
  constraint teacher_practice_logs_how_it_went_check check (how_it_went in ('great', 'okay', 'tricky'))
);

create index if not exists teacher_practice_logs_student_id_idx on public.teacher_practice_logs(student_id);

alter table public.teacher_practice_logs enable row level security;

create policy "Teachers can view practice logs for their own students"
  on public.teacher_practice_logs for select
  using (
    exists (
      select 1 from public.teacher_students s
      where s.id = teacher_practice_logs.student_id and s.teacher_id = auth.uid()
    )
  );


-- ============================================================
-- teacher_praise — Teacher notes attached to a teacher_practice_logs
-- entry. Same shape/pattern as praise (0004).
-- ============================================================
create table if not exists public.teacher_praise (
  id uuid primary key default gen_random_uuid(),
  practice_log_id uuid not null references public.teacher_practice_logs(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists teacher_praise_practice_log_id_idx on public.teacher_praise(practice_log_id);

alter table public.teacher_praise enable row level security;

create policy "Teachers can view praise for their own students' logs"
  on public.teacher_praise for select
  using (
    exists (
      select 1 from public.teacher_practice_logs pl
      join public.teacher_students s on s.id = pl.student_id
      where pl.id = teacher_praise.practice_log_id and s.teacher_id = auth.uid()
    )
  );

create policy "Teachers can insert praise for their own students' logs"
  on public.teacher_praise for insert
  with check (
    exists (
      select 1 from public.teacher_practice_logs pl
      join public.teacher_students s on s.id = pl.student_id
      where pl.id = teacher_praise.practice_log_id and s.teacher_id = auth.uid()
    )
  );

create policy "Teachers can delete praise for their own students' logs"
  on public.teacher_praise for delete
  using (
    exists (
      select 1 from public.teacher_practice_logs pl
      join public.teacher_students s on s.id = pl.student_id
      where pl.id = teacher_praise.practice_log_id and s.teacher_id = auth.uid()
    )
  );
