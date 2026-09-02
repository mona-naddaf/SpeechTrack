-- ============================================================
-- Schedule/Calendar feature -- step 3: standalone events (meetings, or
-- anything else not tied to a student) shown on the Schedule page
-- alongside scheduled student sessions.
--
-- ONE shared table, not mirrored SLP/Teacher tables -- following the
-- precedent already set by attendance_records
-- (0015_schedule_and_attendance.sql), the one other table in this app
-- that both sides write to. That table picked nullable slp_id/teacher_id
-- columns with a CHECK that exactly one is set, rather than a single
-- owner_id + owner_type discriminator column -- staying with that same
-- shape here (rather than introducing a second, different convention
-- for "one shared table") keeps the two shared tables consistent with
-- each other, and RLS stays the same simple
-- "slp_id = auth.uid() or teacher_id = auth.uid()" shape already used
-- there. schedule_events has even less reason to split than
-- attendance_records did: attendance_records still has a student_id
-- pointing at one of two different per-side tables (students vs.
-- teacher_students), which is the part that actually differs by side;
-- an event has no student at all, so there's nothing left that would
-- motivate two separate tables in the first place.
-- ============================================================
create table if not exists public.schedule_events (
  id uuid primary key default gen_random_uuid(),
  slp_id uuid references auth.users(id) on delete cascade,
  teacher_id uuid references auth.users(id) on delete cascade,
  title text not null,
  date date not null,
  -- "HH:MM" 24h string, same convention (and same format CHECK, below)
  -- as scheduled_days' time field -- src/lib/schedule.ts's timeToMinutes
  -- / formatTime12h already parse this shape, so the Schedule page's
  -- event blocks and student-session blocks share the exact same time
  -- math with no extra conversion.
  start_time text not null,
  duration_minutes integer not null default 30,
  note text,
  -- One of src/lib/colors.ts's COLOR_OPTIONS values (e.g. "blue"),
  -- same free-text-no-DB-enum convention behavior_types.color already
  -- uses -- the fixed palette is enforced client-side, not here.
  color text,
  created_at timestamptz not null default now(),
  constraint schedule_events_owner_check check (
    (slp_id is not null and teacher_id is null) or
    (slp_id is null and teacher_id is not null)
  ),
  constraint schedule_events_title_check check (char_length(trim(title)) > 0),
  constraint schedule_events_start_time_check check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  constraint schedule_events_duration_check check (duration_minutes > 0 and duration_minutes <= 480)
);

create index if not exists schedule_events_slp_id_idx on public.schedule_events(slp_id);
create index if not exists schedule_events_teacher_id_idx on public.schedule_events(teacher_id);
create index if not exists schedule_events_date_idx on public.schedule_events(date);

alter table public.schedule_events enable row level security;

create policy "Owners can view their own schedule events"
  on public.schedule_events for select
  using (slp_id = auth.uid() or teacher_id = auth.uid());

create policy "Owners can insert their own schedule events"
  on public.schedule_events for insert
  with check (slp_id = auth.uid() or teacher_id = auth.uid());

create policy "Owners can update their own schedule events"
  on public.schedule_events for update
  using (slp_id = auth.uid() or teacher_id = auth.uid());

create policy "Owners can delete their own schedule events"
  on public.schedule_events for delete
  using (slp_id = auth.uid() or teacher_id = auth.uid());
