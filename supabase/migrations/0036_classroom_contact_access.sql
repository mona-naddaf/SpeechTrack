-- ============================================================
-- Classroom contact ("Teacher view") access — a second, independent
-- code-entry access path for a student's classroom contact (the SLP's
-- teacher, or the Teacher-account holder's own classroom contact),
-- architecturally identical to parent access (0004/0010) but kept
-- completely separate: its own access-code column, its own signed
-- session cookie (src/lib/classroom-contact-session.ts), its own
-- service-role API routes (src/app/api/classroom-contact/**), and its
-- own tables for what gets logged. Nothing here reuses or touches the
-- parent_access_code / parent_session cookie / home_practice_items
-- machinery — a classroom contact and a parent are two unrelated trust
-- boundaries that happen to share a UI pattern.
--
-- Both SLP-side (students) and Teacher-side (teacher_students) get this
-- in one migration (unlike parent access, which picked up its
-- Teacher-side mirror in a later migration, 0010) since this is being
-- built fresh for both sides at once.
-- ============================================================

alter table public.students
  add column if not exists classroom_contact_access_code text;

alter table public.teacher_students
  add column if not exists classroom_contact_access_code text;

create or replace function public.generate_classroom_contact_access_code()
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
      select 1 from public.students where classroom_contact_access_code = code
      union all
      select 1 from public.teacher_students where classroom_contact_access_code = code
    ) into taken;
    exit when not taken;
  end loop;
  return code;
end;
$$;

create or replace function public.set_classroom_contact_access_code()
returns trigger
language plpgsql
as $$
begin
  if new.classroom_contact_access_code is null then
    new.classroom_contact_access_code := public.generate_classroom_contact_access_code();
  end if;
  return new;
end;
$$;

drop trigger if exists set_classroom_contact_access_code_trigger on public.students;
create trigger set_classroom_contact_access_code_trigger
  before insert on public.students
  for each row execute function public.set_classroom_contact_access_code();

drop trigger if exists set_classroom_contact_access_code_trigger on public.teacher_students;
create trigger set_classroom_contact_access_code_trigger
  before insert on public.teacher_students
  for each row execute function public.set_classroom_contact_access_code();

-- Backfill any students that already existed, then lock both columns down.
update public.students
set classroom_contact_access_code = public.generate_classroom_contact_access_code()
where classroom_contact_access_code is null;

update public.teacher_students
set classroom_contact_access_code = public.generate_classroom_contact_access_code()
where classroom_contact_access_code is null;

alter table public.students
  alter column classroom_contact_access_code set not null;

alter table public.teacher_students
  alter column classroom_contact_access_code set not null;

create unique index if not exists students_classroom_contact_access_code_idx
  on public.students (classroom_contact_access_code);

create unique index if not exists teacher_students_classroom_contact_access_code_idx
  on public.teacher_students (classroom_contact_access_code);


-- ============================================================
-- classroom_strategies — SLP-managed, normal slp_id RLS. Same
-- shape/pattern as home_practice_items (0004), just "what to
-- do"/"how to do it" in place of "what to practice"/"how to practice"
-- since these are classroom strategies the SLP assigns to the
-- classroom contact, not home-practice items for a parent.
-- ============================================================
create table if not exists public.classroom_strategies (
  id uuid primary key default gen_random_uuid(),
  slp_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  what_to_do text not null,
  how_to_do_it text,
  last_used_date date,
  created_at timestamptz not null default now()
);

create index if not exists classroom_strategies_slp_id_idx on public.classroom_strategies(slp_id);
create index if not exists classroom_strategies_student_id_idx on public.classroom_strategies(student_id);

alter table public.classroom_strategies enable row level security;

create policy "SLPs can view their own classroom strategies"
  on public.classroom_strategies for select
  using (auth.uid() = slp_id);

create policy "SLPs can insert their own classroom strategies"
  on public.classroom_strategies for insert
  with check (auth.uid() = slp_id);

create policy "SLPs can update their own classroom strategies"
  on public.classroom_strategies for update
  using (auth.uid() = slp_id);

create policy "SLPs can delete their own classroom strategies"
  on public.classroom_strategies for delete
  using (auth.uid() = slp_id);


-- ============================================================
-- teacher_classroom_strategies — Teacher-managed mirror of
-- classroom_strategies above, teacher_id RLS, pointed at
-- teacher_students. Same shape/pattern as
-- teacher_home_practice_items (0010).
-- ============================================================
create table if not exists public.teacher_classroom_strategies (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.teacher_students(id) on delete cascade,
  what_to_do text not null,
  how_to_do_it text,
  last_used_date date,
  created_at timestamptz not null default now()
);

create index if not exists teacher_classroom_strategies_teacher_id_idx on public.teacher_classroom_strategies(teacher_id);
create index if not exists teacher_classroom_strategies_student_id_idx on public.teacher_classroom_strategies(student_id);

alter table public.teacher_classroom_strategies enable row level security;

create policy "Teachers can view their own classroom strategies"
  on public.teacher_classroom_strategies for select
  using (auth.uid() = teacher_id);

create policy "Teachers can insert their own classroom strategies"
  on public.teacher_classroom_strategies for insert
  with check (auth.uid() = teacher_id);

create policy "Teachers can update their own classroom strategies"
  on public.teacher_classroom_strategies for update
  using (auth.uid() = teacher_id);

create policy "Teachers can delete their own classroom strategies"
  on public.teacher_classroom_strategies for delete
  using (auth.uid() = teacher_id);


-- ============================================================
-- classroom_strategy_logs — written by the classroom contact through a
-- service-role API route (src/app/api/classroom-contact/**), since a
-- classroom contact has no Supabase Auth session for RLS to key off.
-- Read by the SLP through normal RLS via a join to students.slp_id.
-- Same shape/pattern as practice_logs (0004).
--
-- Deliberately no insert/update/delete policy for the authenticated
-- role: the SLP views and praises log entries but doesn't write them —
-- only the service-role route (which bypasses RLS) creates them.
-- ============================================================
create table if not exists public.classroom_strategy_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  date date not null default current_date,
  activities jsonb not null default '[]'::jsonb,
  how_it_went text not null,
  note text,
  created_at timestamptz not null default now(),
  constraint classroom_strategy_logs_how_it_went_check check (how_it_went in ('great', 'okay', 'tricky'))
);

create index if not exists classroom_strategy_logs_student_id_idx on public.classroom_strategy_logs(student_id);

alter table public.classroom_strategy_logs enable row level security;

create policy "SLPs can view classroom strategy logs for their own students"
  on public.classroom_strategy_logs for select
  using (
    exists (
      select 1 from public.students s
      where s.id = classroom_strategy_logs.student_id and s.slp_id = auth.uid()
    )
  );


-- ============================================================
-- teacher_classroom_strategy_logs — Teacher-side mirror of
-- classroom_strategy_logs above. Same "service-role writes only, SLP/
-- Teacher-side RLS reads only" pattern as teacher_practice_logs (0010).
-- ============================================================
create table if not exists public.teacher_classroom_strategy_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.teacher_students(id) on delete cascade,
  date date not null default current_date,
  activities jsonb not null default '[]'::jsonb,
  how_it_went text not null,
  note text,
  created_at timestamptz not null default now(),
  constraint teacher_classroom_strategy_logs_how_it_went_check check (how_it_went in ('great', 'okay', 'tricky'))
);

create index if not exists teacher_classroom_strategy_logs_student_id_idx on public.teacher_classroom_strategy_logs(student_id);

alter table public.teacher_classroom_strategy_logs enable row level security;

create policy "Teachers can view classroom strategy logs for their own students"
  on public.teacher_classroom_strategy_logs for select
  using (
    exists (
      select 1 from public.teacher_students s
      where s.id = teacher_classroom_strategy_logs.student_id and s.teacher_id = auth.uid()
    )
  );


-- ============================================================
-- classroom_strategy_praise — SLP notes attached to a classroom
-- strategy log entry. Same shape/pattern as praise (0004).
-- ============================================================
create table if not exists public.classroom_strategy_praise (
  id uuid primary key default gen_random_uuid(),
  classroom_strategy_log_id uuid not null references public.classroom_strategy_logs(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists classroom_strategy_praise_log_id_idx on public.classroom_strategy_praise(classroom_strategy_log_id);

alter table public.classroom_strategy_praise enable row level security;

create policy "SLPs can view praise for their own students' classroom strategy logs"
  on public.classroom_strategy_praise for select
  using (
    exists (
      select 1 from public.classroom_strategy_logs csl
      join public.students s on s.id = csl.student_id
      where csl.id = classroom_strategy_praise.classroom_strategy_log_id and s.slp_id = auth.uid()
    )
  );

create policy "SLPs can insert praise for their own students' classroom strategy logs"
  on public.classroom_strategy_praise for insert
  with check (
    exists (
      select 1 from public.classroom_strategy_logs csl
      join public.students s on s.id = csl.student_id
      where csl.id = classroom_strategy_praise.classroom_strategy_log_id and s.slp_id = auth.uid()
    )
  );

create policy "SLPs can delete praise for their own students' classroom strategy logs"
  on public.classroom_strategy_praise for delete
  using (
    exists (
      select 1 from public.classroom_strategy_logs csl
      join public.students s on s.id = csl.student_id
      where csl.id = classroom_strategy_praise.classroom_strategy_log_id and s.slp_id = auth.uid()
    )
  );


-- ============================================================
-- teacher_classroom_strategy_praise — Teacher-side mirror of
-- classroom_strategy_praise above. Same shape/pattern as teacher_praise
-- (0010).
-- ============================================================
create table if not exists public.teacher_classroom_strategy_praise (
  id uuid primary key default gen_random_uuid(),
  classroom_strategy_log_id uuid not null references public.teacher_classroom_strategy_logs(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists teacher_classroom_strategy_praise_log_id_idx on public.teacher_classroom_strategy_praise(classroom_strategy_log_id);

alter table public.teacher_classroom_strategy_praise enable row level security;

create policy "Teachers can view praise for their own students' classroom strategy logs"
  on public.teacher_classroom_strategy_praise for select
  using (
    exists (
      select 1 from public.teacher_classroom_strategy_logs csl
      join public.teacher_students s on s.id = csl.student_id
      where csl.id = teacher_classroom_strategy_praise.classroom_strategy_log_id and s.teacher_id = auth.uid()
    )
  );

create policy "Teachers can insert praise for their own students' classroom strategy logs"
  on public.teacher_classroom_strategy_praise for insert
  with check (
    exists (
      select 1 from public.teacher_classroom_strategy_logs csl
      join public.teacher_students s on s.id = csl.student_id
      where csl.id = teacher_classroom_strategy_praise.classroom_strategy_log_id and s.teacher_id = auth.uid()
    )
  );

create policy "Teachers can delete praise for their own students' classroom strategy logs"
  on public.teacher_classroom_strategy_praise for delete
  using (
    exists (
      select 1 from public.teacher_classroom_strategy_logs csl
      join public.teacher_students s on s.id = csl.student_id
      where csl.id = teacher_classroom_strategy_praise.classroom_strategy_log_id and s.teacher_id = auth.uid()
    )
  );
