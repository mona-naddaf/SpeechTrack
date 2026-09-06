-- ============================================================
-- Treatment Plans, step 1: goal sequencing data model + core logic.
--
-- A "track" groups a student's goals into an ordered sequence (e.g.
-- "/l/ sound": isolation -> words -> sentences). Goals in a track sit at
-- a step_order; only one step is meant to be worked on at a time. A step
-- that hasn't started yet is status 'queued' — invisible to session
-- logging (which already filters .eq("status", "active")) until its
-- turn comes. Mastering a step auto-activates the very next step_order
-- in the same track, if that next step is still queued (see the trigger
-- functions below). Goals outside a track are unaffected: no track_id,
-- no step_order, behave exactly as before.
-- ============================================================


-- ============================================================
-- goal_tracks — the SLP side. Same shared-table-per-side pattern as
-- goals/teacher_goals: fully separate table from teacher_goal_tracks
-- below, no cross-role sharing.
-- ============================================================
create table if not exists public.goal_tracks (
  id uuid primary key default gen_random_uuid(),
  slp_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists goal_tracks_slp_id_idx on public.goal_tracks(slp_id);
create index if not exists goal_tracks_student_id_idx on public.goal_tracks(student_id);

alter table public.goal_tracks enable row level security;

create policy "SLPs can view their own goal tracks"
  on public.goal_tracks for select
  using (auth.uid() = slp_id);

create policy "SLPs can insert their own goal tracks"
  on public.goal_tracks for insert
  with check (auth.uid() = slp_id);

create policy "SLPs can update their own goal tracks"
  on public.goal_tracks for update
  using (auth.uid() = slp_id);

create policy "SLPs can delete their own goal tracks"
  on public.goal_tracks for delete
  using (auth.uid() = slp_id);


-- ============================================================
-- teacher_goal_tracks — the Teacher equivalent of goal_tracks.
-- ============================================================
create table if not exists public.teacher_goal_tracks (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.teacher_students(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists teacher_goal_tracks_teacher_id_idx on public.teacher_goal_tracks(teacher_id);
create index if not exists teacher_goal_tracks_student_id_idx on public.teacher_goal_tracks(student_id);

alter table public.teacher_goal_tracks enable row level security;

create policy "Teachers can view their own goal tracks"
  on public.teacher_goal_tracks for select
  using (auth.uid() = teacher_id);

create policy "Teachers can insert their own goal tracks"
  on public.teacher_goal_tracks for insert
  with check (auth.uid() = teacher_id);

create policy "Teachers can update their own goal tracks"
  on public.teacher_goal_tracks for update
  using (auth.uid() = teacher_id);

create policy "Teachers can delete their own goal tracks"
  on public.teacher_goal_tracks for delete
  using (auth.uid() = teacher_id);


-- ============================================================
-- goals: track_id + step_order, and the new 'queued' status.
-- ============================================================
alter table public.goals
  add column if not exists track_id uuid references public.goal_tracks(id) on delete set null,
  add column if not exists step_order integer;

create index if not exists goals_track_id_idx on public.goals(track_id);

-- A goal is either fully in a track (both set) or fully out of one
-- (both null) — never half-assigned.
alter table public.goals
  add constraint goals_track_step_pairing_check
  check ((track_id is null) = (step_order is null));

alter table public.goals
  drop constraint if exists goals_status_check;
alter table public.goals
  add constraint goals_status_check check (status in ('active', 'on_hold', 'mastered', 'queued'));


-- ============================================================
-- teacher_goals: same two columns, same status value.
-- ============================================================
alter table public.teacher_goals
  add column if not exists track_id uuid references public.teacher_goal_tracks(id) on delete set null,
  add column if not exists step_order integer;

create index if not exists teacher_goals_track_id_idx on public.teacher_goals(track_id);

alter table public.teacher_goals
  add constraint teacher_goals_track_step_pairing_check
  check ((track_id is null) = (step_order is null));

alter table public.teacher_goals
  drop constraint if exists teacher_goals_status_check;
alter table public.teacher_goals
  add constraint teacher_goals_status_check check (status in ('active', 'on_hold', 'mastered', 'queued'));


-- ============================================================
-- Guard rail: a goal's track (if any) must belong to the same student
-- as the goal itself. Checked on insert/update rather than as a plain
-- check constraint, since it needs to look up another table.
-- ============================================================
create or replace function public.validate_goal_track_student()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  track_student_id uuid;
begin
  if new.track_id is null then
    return new;
  end if;

  select student_id into track_student_id
  from public.goal_tracks
  where id = new.track_id;

  if track_student_id is null or track_student_id is distinct from new.student_id then
    raise exception 'goal track % does not belong to student %', new.track_id, new.student_id;
  end if;

  return new;
end;
$$;

drop trigger if exists goals_validate_track_student on public.goals;
create trigger goals_validate_track_student
  before insert or update of track_id, student_id on public.goals
  for each row execute function public.validate_goal_track_student();

create or replace function public.validate_teacher_goal_track_student()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  track_student_id uuid;
begin
  if new.track_id is null then
    return new;
  end if;

  select student_id into track_student_id
  from public.teacher_goal_tracks
  where id = new.track_id;

  if track_student_id is null or track_student_id is distinct from new.student_id then
    raise exception 'teacher goal track % does not belong to student %', new.track_id, new.student_id;
  end if;

  return new;
end;
$$;

drop trigger if exists teacher_goals_validate_track_student on public.teacher_goals;
create trigger teacher_goals_validate_track_student
  before insert or update of track_id, student_id on public.teacher_goals
  for each row execute function public.validate_teacher_goal_track_student();


-- ============================================================
-- Core auto-progression logic: mastering a track step activates the
-- very next step_order in that track, but only if that next step is
-- still 'queued' (a step already manually activated, put on hold, or
-- otherwise not queued is left alone — no skipping ahead over it).
-- Fires only on an actual transition into 'mastered', so reordering
-- step_order (with status unchanged) never triggers this, and it never
-- looks backwards, so already-passed steps are never revisited.
-- ============================================================
create or replace function public.advance_goal_track()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  next_id uuid;
  next_status text;
begin
  select id, status
    into next_id, next_status
  from public.goals
  where track_id = new.track_id
    and step_order is not null
    and step_order > new.step_order
  order by step_order asc
  limit 1;

  if next_id is not null and next_status = 'queued' then
    update public.goals set status = 'active' where id = next_id;
  end if;

  return new;
end;
$$;

drop trigger if exists goals_advance_track_on_mastery on public.goals;
create trigger goals_advance_track_on_mastery
  after update on public.goals
  for each row
  when (
    new.status = 'mastered'
    and old.status is distinct from new.status
    and new.track_id is not null
    and new.step_order is not null
  )
  execute function public.advance_goal_track();

create or replace function public.advance_teacher_goal_track()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  next_id uuid;
  next_status text;
begin
  select id, status
    into next_id, next_status
  from public.teacher_goals
  where track_id = new.track_id
    and step_order is not null
    and step_order > new.step_order
  order by step_order asc
  limit 1;

  if next_id is not null and next_status = 'queued' then
    update public.teacher_goals set status = 'active' where id = next_id;
  end if;

  return new;
end;
$$;

drop trigger if exists teacher_goals_advance_track_on_mastery on public.teacher_goals;
create trigger teacher_goals_advance_track_on_mastery
  after update on public.teacher_goals
  for each row
  when (
    new.status = 'mastered'
    and old.status is distinct from new.status
    and new.track_id is not null
    and new.step_order is not null
  )
  execute function public.advance_teacher_goal_track();
