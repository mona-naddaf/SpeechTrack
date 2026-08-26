-- ============================================================
-- students.scheduled_days / teacher_students.scheduled_days — which
-- weekdays sessions/lessons are scheduled for, e.g. '{monday,wednesday,friday}'.
-- A plain text[] rather than jsonb: it's always just a small set of day
-- names, no nested structure, so a native array keeps both the schema and
-- the client code (PostgREST returns it as a JS string[] directly) simpler.
-- ============================================================

alter table public.students
  add column if not exists scheduled_days text[] not null default '{}'::text[];

alter table public.teacher_students
  add column if not exists scheduled_days text[] not null default '{}'::text[];


-- ============================================================
-- attendance_records — deliberately ONE shared table for both sides
-- (unlike every other feature in this app, which uses fully separate
-- mirrored tables). slp_id/teacher_id are both nullable; exactly one is
-- set per row, enforced by the CHECK constraint below, so ownership
-- still works with the same simple "= auth.uid()" RLS pattern used
-- elsewhere for owner-column tables (e.g. behavior_logs).
--
-- student_id intentionally has NO foreign key: it points at students.id
-- when slp_id is set, or teacher_students.id when teacher_id is set, and
-- a single column can't carry a conditional FK to two different tables.
-- The app always sets it alongside the matching owner id from a
-- validated student record, and RLS scoping by owner id is what actually
-- keeps one SLP/Teacher's rows isolated from another's — same trust
-- boundary this app already relies on for every other owner-column table.
-- ============================================================
create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  slp_id uuid references auth.users(id) on delete cascade,
  teacher_id uuid references auth.users(id) on delete cascade,
  student_id uuid not null,
  date date not null default current_date,
  reason text,
  reason_note text,
  created_at timestamptz not null default now(),
  constraint attendance_records_owner_check check (
    (slp_id is not null and teacher_id is null) or
    (slp_id is null and teacher_id is not null)
  ),
  constraint attendance_records_reason_check check (
    reason is null or reason in ('sick', 'vacation', 'school_event', 'other')
  )
);

create index if not exists attendance_records_slp_id_idx on public.attendance_records(slp_id);
create index if not exists attendance_records_teacher_id_idx on public.attendance_records(teacher_id);
create index if not exists attendance_records_student_id_idx on public.attendance_records(student_id);

alter table public.attendance_records enable row level security;

create policy "Owners can view their own attendance records"
  on public.attendance_records for select
  using (slp_id = auth.uid() or teacher_id = auth.uid());

create policy "Owners can insert their own attendance records"
  on public.attendance_records for insert
  with check (slp_id = auth.uid() or teacher_id = auth.uid());

create policy "Owners can update their own attendance records"
  on public.attendance_records for update
  using (slp_id = auth.uid() or teacher_id = auth.uid());

create policy "Owners can delete their own attendance records"
  on public.attendance_records for delete
  using (slp_id = auth.uid() or teacher_id = auth.uid());
