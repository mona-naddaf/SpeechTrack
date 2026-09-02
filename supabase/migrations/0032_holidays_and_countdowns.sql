-- ============================================================
-- Schedule/Calendar feature -- step 4 (final): holidays and countdowns.
--
-- Both are ONE shared table each, not mirrored SLP/Teacher tables --
-- same nullable slp_id/teacher_id + CHECK-exactly-one-set shape as
-- attendance_records (0015) and schedule_events (0031), for the same
-- reason those two picked it: neither holidays nor countdowns are tied
-- to a per-side table the way students/teacher_students are, so there's
-- nothing that would motivate two separate tables, and staying with the
-- one existing "shared table" shape keeps every such table in this app
-- consistent with the others (same RLS pattern, same insert/update code
-- shape in the client).
-- ============================================================

-- ============================================================
-- holidays -- whole-day markers (no time), shown on the Week/Day
-- calendar and, critically, protecting a student's session-frequency
-- streak on that date exactly the way an excused attendance_records
-- absence already does (wired into src/lib/streaks.ts's callers, not
-- into streaks.ts itself -- computeCadenceStreak()/isStreakAtRisk()
-- already take a generic "protected dates" list, so a holiday is just
-- another date folded into that same list, alongside each student's own
-- attendance_records dates).
-- ============================================================
create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  slp_id uuid references auth.users(id) on delete cascade,
  teacher_id uuid references auth.users(id) on delete cascade,
  title text not null,
  date date not null,
  created_at timestamptz not null default now(),
  constraint holidays_owner_check check (
    (slp_id is not null and teacher_id is null) or
    (slp_id is null and teacher_id is not null)
  ),
  constraint holidays_title_check check (char_length(trim(title)) > 0)
);

create index if not exists holidays_slp_id_idx on public.holidays(slp_id);
create index if not exists holidays_teacher_id_idx on public.holidays(teacher_id);
create index if not exists holidays_date_idx on public.holidays(date);

alter table public.holidays enable row level security;

create policy "Owners can view their own holidays"
  on public.holidays for select
  using (slp_id = auth.uid() or teacher_id = auth.uid());

create policy "Owners can insert their own holidays"
  on public.holidays for insert
  with check (slp_id = auth.uid() or teacher_id = auth.uid());

create policy "Owners can update their own holidays"
  on public.holidays for update
  using (slp_id = auth.uid() or teacher_id = auth.uid());

create policy "Owners can delete their own holidays"
  on public.holidays for delete
  using (slp_id = auth.uid() or teacher_id = auth.uid());

-- A supervisor viewing a linked member's student needs this member's
-- holidays too, to recompute that student's streak with the exact same
-- protection the member's own dashboard applies (src/app/supervisor/
-- members/[id]/students/[studentId]/page.tsx) -- same
-- is_supervisor_of() predicate 0023_supervisor_readonly_access.sql
-- defined, same coalesce(slp_id, teacher_id) shape
-- 0023's attendance_records policy already uses for this same kind of
-- shared table.
create policy "Supervisors can view linked members' holidays"
  on public.holidays for select
  using (
    public.is_supervisor_of(coalesce(holidays.slp_id, holidays.teacher_id))
  );


-- ============================================================
-- countdowns -- "X days until <title>" (e.g. "Winter break", "IEP
-- deadline"), purely a dashboard/Schedule-page display feature, not
-- part of streak math -- no supervisor visibility needed, unlike
-- holidays above.
-- ============================================================
create table if not exists public.countdowns (
  id uuid primary key default gen_random_uuid(),
  slp_id uuid references auth.users(id) on delete cascade,
  teacher_id uuid references auth.users(id) on delete cascade,
  title text not null,
  target_date date not null,
  created_at timestamptz not null default now(),
  constraint countdowns_owner_check check (
    (slp_id is not null and teacher_id is null) or
    (slp_id is null and teacher_id is not null)
  ),
  constraint countdowns_title_check check (char_length(trim(title)) > 0)
);

create index if not exists countdowns_slp_id_idx on public.countdowns(slp_id);
create index if not exists countdowns_teacher_id_idx on public.countdowns(teacher_id);

alter table public.countdowns enable row level security;

create policy "Owners can view their own countdowns"
  on public.countdowns for select
  using (slp_id = auth.uid() or teacher_id = auth.uid());

create policy "Owners can insert their own countdowns"
  on public.countdowns for insert
  with check (slp_id = auth.uid() or teacher_id = auth.uid());

create policy "Owners can update their own countdowns"
  on public.countdowns for update
  using (slp_id = auth.uid() or teacher_id = auth.uid());

create policy "Owners can delete their own countdowns"
  on public.countdowns for delete
  using (slp_id = auth.uid() or teacher_id = auth.uid());
