-- ============================================================
-- students.parent_access_code
-- Short, unique, human-typeable code a parent enters at /parent to
-- access their child's home-practice data without a Supabase Auth
-- account. Excludes visually ambiguous characters (0/O, 1/I/L).
-- ============================================================
alter table public.students
  add column if not exists parent_access_code text;

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
    ) into taken;
    exit when not taken;
  end loop;
  return code;
end;
$$;

create or replace function public.set_parent_access_code()
returns trigger
language plpgsql
as $$
begin
  if new.parent_access_code is null then
    new.parent_access_code := public.generate_parent_access_code();
  end if;
  return new;
end;
$$;

drop trigger if exists set_parent_access_code_trigger on public.students;
create trigger set_parent_access_code_trigger
  before insert on public.students
  for each row execute function public.set_parent_access_code();

-- Backfill any students that already existed, then lock the column down.
update public.students
set parent_access_code = public.generate_parent_access_code()
where parent_access_code is null;

alter table public.students
  alter column parent_access_code set not null;

create unique index if not exists students_parent_access_code_idx
  on public.students (parent_access_code);


-- ============================================================
-- home_practice_items — SLP-managed, normal slp_id RLS (same
-- authenticated Supabase client used everywhere else in the app).
-- ============================================================
create table if not exists public.home_practice_items (
  id uuid primary key default gen_random_uuid(),
  slp_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  what_to_practice text not null,
  how_to_practice text,
  last_worked_date date,
  created_at timestamptz not null default now()
);

create index if not exists home_practice_items_slp_id_idx on public.home_practice_items(slp_id);
create index if not exists home_practice_items_student_id_idx on public.home_practice_items(student_id);

alter table public.home_practice_items enable row level security;

create policy "SLPs can view their own home practice items"
  on public.home_practice_items for select
  using (auth.uid() = slp_id);

create policy "SLPs can insert their own home practice items"
  on public.home_practice_items for insert
  with check (auth.uid() = slp_id);

create policy "SLPs can update their own home practice items"
  on public.home_practice_items for update
  using (auth.uid() = slp_id);

create policy "SLPs can delete their own home practice items"
  on public.home_practice_items for delete
  using (auth.uid() = slp_id);


-- ============================================================
-- practice_logs — written by parents through a service-role API
-- route (src/app/api/parent/**), since parents have no Supabase
-- Auth session for RLS to key off. Read by SLPs through normal RLS
-- via a join to students.slp_id. No slp_id column of its own,
-- matching the `trials` pattern from session tracking.
--
-- Deliberately no insert/update/delete policy for the authenticated
-- role: SLPs view and praise log entries but don't write them —
-- only the service-role route (which bypasses RLS) creates them.
-- ============================================================
create table if not exists public.practice_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  date date not null default current_date,
  activities jsonb not null default '[]'::jsonb,
  how_it_went text not null,
  note text,
  created_at timestamptz not null default now(),
  constraint practice_logs_how_it_went_check check (how_it_went in ('great', 'okay', 'tricky'))
);

create index if not exists practice_logs_student_id_idx on public.practice_logs(student_id);

alter table public.practice_logs enable row level security;

create policy "SLPs can view practice logs for their own students"
  on public.practice_logs for select
  using (
    exists (
      select 1 from public.students s
      where s.id = practice_logs.student_id and s.slp_id = auth.uid()
    )
  );


-- ============================================================
-- praise — SLP notes attached to a practice log entry.
-- ============================================================
create table if not exists public.praise (
  id uuid primary key default gen_random_uuid(),
  practice_log_id uuid not null references public.practice_logs(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists praise_practice_log_id_idx on public.praise(practice_log_id);

alter table public.praise enable row level security;

create policy "SLPs can view praise for their own students' logs"
  on public.praise for select
  using (
    exists (
      select 1 from public.practice_logs pl
      join public.students s on s.id = pl.student_id
      where pl.id = praise.practice_log_id and s.slp_id = auth.uid()
    )
  );

create policy "SLPs can insert praise for their own students' logs"
  on public.praise for insert
  with check (
    exists (
      select 1 from public.practice_logs pl
      join public.students s on s.id = pl.student_id
      where pl.id = praise.practice_log_id and s.slp_id = auth.uid()
    )
  );

create policy "SLPs can delete praise for their own students' logs"
  on public.praise for delete
  using (
    exists (
      select 1 from public.practice_logs pl
      join public.students s on s.id = pl.student_id
      where pl.id = praise.practice_log_id and s.slp_id = auth.uid()
    )
  );
