-- ============================================================
-- Session packages — a student can have a prepaid package of N
-- sessions, shown as N circles on their student page. What fills a
-- circle is never stored: it's derived on the fly (src/lib/packages.ts)
-- from three kinds of "counted item" dated on/after the package's
-- start_date:
--   a) logged sessions (sessions / teacher_sessions),
--   b) absences with counts_toward_package = true (attendance_records),
--   c) manual entries (package_manual_entries, below) — sessions that
--      happened but were never logged.
-- So deleting a session, un-ticking an absence or deleting a manual
-- entry un-fills its circle with no bookkeeping to keep in sync.
--
-- Both tables below follow attendance_records' shape exactly (see
-- 0015_schedule_and_attendance.sql): ONE shared table for SLPs and
-- Teachers, nullable slp_id/teacher_id with a CHECK that exactly one is
-- set, and student_id with NO foreign key (it points at students.id or
-- teacher_students.id depending on which owner column is set).
-- ============================================================

-- ------------------------------------------------------------
-- attendance_records.counts_toward_package — an absence the SLP/
-- Teacher still bills against the package (e.g. a late cancellation).
-- Off by default, so every existing absence keeps not counting.
-- ------------------------------------------------------------
alter table public.attendance_records
  add column if not exists counts_toward_package boolean not null default false;


-- ------------------------------------------------------------
-- student_packages
-- ended_at is set when the package is renewed; the one row per student
-- with ended_at IS NULL is the current package (enforced by the partial
-- unique index below). Ended packages are kept rather than deleted —
-- they're what lets the derivation know which items earlier packages
-- already consumed, so extras carry over into the renewed one.
-- ------------------------------------------------------------
create table if not exists public.student_packages (
  id uuid primary key default gen_random_uuid(),
  slp_id uuid references auth.users(id) on delete cascade,
  teacher_id uuid references auth.users(id) on delete cascade,
  student_id uuid not null,
  total_sessions integer not null,
  start_date date not null default current_date,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  constraint student_packages_owner_check check (
    (slp_id is not null and teacher_id is null) or
    (slp_id is null and teacher_id is not null)
  ),
  constraint student_packages_total_sessions_check check (
    total_sessions between 1 and 100
  )
);

create index if not exists student_packages_slp_id_idx on public.student_packages(slp_id);
create index if not exists student_packages_teacher_id_idx on public.student_packages(teacher_id);
create index if not exists student_packages_student_id_idx on public.student_packages(student_id);
create unique index if not exists student_packages_one_active_per_student
  on public.student_packages(student_id) where ended_at is null;

alter table public.student_packages enable row level security;

create policy "Owners can view their own student packages"
  on public.student_packages for select
  using (slp_id = auth.uid() or teacher_id = auth.uid());

create policy "Owners can insert their own student packages"
  on public.student_packages for insert
  with check (slp_id = auth.uid() or teacher_id = auth.uid());

create policy "Owners can update their own student packages"
  on public.student_packages for update
  using (slp_id = auth.uid() or teacher_id = auth.uid());

create policy "Owners can delete their own student packages"
  on public.student_packages for delete
  using (slp_id = auth.uid() or teacher_id = auth.uid());

-- Read-only supervisor access, same coalesce pattern as attendance_records
-- in 0023_supervisor_readonly_access.sql.
create policy "Supervisors can view linked members' student packages"
  on public.student_packages for select
  using (
    public.is_supervisor_of(
      coalesce(student_packages.slp_id, student_packages.teacher_id)
    )
  );


-- ------------------------------------------------------------
-- package_manual_entries — "a session happened but no log was taken".
-- Deliberately not tied to a package_id: like the other two item kinds
-- it's just a dated row, and which package it fills is derived. No
-- parent or community visibility — owner + linked supervisor only.
-- ------------------------------------------------------------
create table if not exists public.package_manual_entries (
  id uuid primary key default gen_random_uuid(),
  slp_id uuid references auth.users(id) on delete cascade,
  teacher_id uuid references auth.users(id) on delete cascade,
  student_id uuid not null,
  date date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  constraint package_manual_entries_owner_check check (
    (slp_id is not null and teacher_id is null) or
    (slp_id is null and teacher_id is not null)
  )
);

create index if not exists package_manual_entries_slp_id_idx on public.package_manual_entries(slp_id);
create index if not exists package_manual_entries_teacher_id_idx on public.package_manual_entries(teacher_id);
create index if not exists package_manual_entries_student_id_idx on public.package_manual_entries(student_id);

alter table public.package_manual_entries enable row level security;

create policy "Owners can view their own package manual entries"
  on public.package_manual_entries for select
  using (slp_id = auth.uid() or teacher_id = auth.uid());

create policy "Owners can insert their own package manual entries"
  on public.package_manual_entries for insert
  with check (slp_id = auth.uid() or teacher_id = auth.uid());

create policy "Owners can update their own package manual entries"
  on public.package_manual_entries for update
  using (slp_id = auth.uid() or teacher_id = auth.uid());

create policy "Owners can delete their own package manual entries"
  on public.package_manual_entries for delete
  using (slp_id = auth.uid() or teacher_id = auth.uid());

create policy "Supervisors can view linked members' package manual entries"
  on public.package_manual_entries for select
  using (
    public.is_supervisor_of(
      coalesce(package_manual_entries.slp_id, package_manual_entries.teacher_id)
    )
  );
