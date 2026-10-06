-- ============================================================
-- Student status, archive and "started on" — plain added columns on
-- students / teacher_students, so the existing owner-scoped and
-- supervisor SELECT policies already cover them.
--
-- These are internal caseload-management fields only. The parent and
-- classroom-contact flows select explicit columns (id, name,
-- share_behavior_with_parent) and never filter on any of these, so they
-- neither see them nor stop working for an archived student.
--
--   status       — 'active' | 'trial' | 'stopped'. Every existing
--                  student backfills to 'active' via the default.
--   archived_at  — set when a Stopped student is archived, cleared on
--                  restore. Nothing else changes: all of the student's
--                  sessions, goals, attendance, packages etc. stay put.
--                  The CHECK keeps "only Stopped students are archived"
--                  true at the DB level; restore sets status back to
--                  'active' in the same update.
--   started_on   — optional: when the student started with her, which
--                  isn't necessarily created_at.
-- ============================================================

alter table public.students
  add column if not exists status text not null default 'active',
  add column if not exists archived_at timestamptz,
  add column if not exists started_on date;

alter table public.students
  add constraint students_status_check
    check (status in ('active', 'trial', 'stopped')),
  add constraint students_archived_only_when_stopped
    check (archived_at is null or status = 'stopped');

alter table public.teacher_students
  add column if not exists status text not null default 'active',
  add column if not exists archived_at timestamptz,
  add column if not exists started_on date;

alter table public.teacher_students
  add constraint teacher_students_status_check
    check (status in ('active', 'trial', 'stopped')),
  add constraint teacher_students_archived_only_when_stopped
    check (archived_at is null or status = 'stopped');


-- ============================================================
-- student_tags — each SLP's own tag palette (name + color), same shape
-- as behavior_types (0012). Fully separate from the Teacher side, per
-- this app's per-role table convention.
-- ============================================================
create table if not exists public.student_tags (
  id uuid primary key default gen_random_uuid(),
  slp_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null,
  created_at timestamptz not null default now()
);

create index if not exists student_tags_slp_id_idx on public.student_tags(slp_id);

alter table public.student_tags enable row level security;

create policy "SLPs can view their own student tags"
  on public.student_tags for select
  using (auth.uid() = slp_id);

create policy "SLPs can insert their own student tags"
  on public.student_tags for insert
  with check (auth.uid() = slp_id);

create policy "SLPs can update their own student tags"
  on public.student_tags for update
  using (auth.uid() = slp_id);

create policy "SLPs can delete their own student tags"
  on public.student_tags for delete
  using (auth.uid() = slp_id);

create policy "Supervisors can view linked members' student tags"
  on public.student_tags for select
  using (public.is_supervisor_of(student_tags.slp_id));


-- ============================================================
-- student_tag_links — which tags a student has. No owner column of its
-- own: ownership is reached through the parent student, same as
-- practice_logs/trials. Inserts also require the tag to be the same
-- SLP's, so a link can never pair her student with someone else's tag.
-- Both FKs cascade: deleting a tag removes it from every student, and
-- deleting a student removes its links.
-- ============================================================
create table if not exists public.student_tag_links (
  student_id uuid not null references public.students(id) on delete cascade,
  tag_id uuid not null references public.student_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, tag_id)
);

create index if not exists student_tag_links_tag_id_idx on public.student_tag_links(tag_id);

alter table public.student_tag_links enable row level security;

create policy "SLPs can view tag links on their own students"
  on public.student_tag_links for select
  using (
    exists (
      select 1 from public.students s
      where s.id = student_tag_links.student_id and s.slp_id = auth.uid()
    )
  );

create policy "SLPs can insert tag links on their own students"
  on public.student_tag_links for insert
  with check (
    exists (
      select 1 from public.students s
      where s.id = student_tag_links.student_id and s.slp_id = auth.uid()
    )
    and exists (
      select 1 from public.student_tags t
      where t.id = student_tag_links.tag_id and t.slp_id = auth.uid()
    )
  );

create policy "SLPs can delete tag links on their own students"
  on public.student_tag_links for delete
  using (
    exists (
      select 1 from public.students s
      where s.id = student_tag_links.student_id and s.slp_id = auth.uid()
    )
  );

create policy "Supervisors can view linked members' student tag links"
  on public.student_tag_links for select
  using (
    exists (
      select 1 from public.students s
      where s.id = student_tag_links.student_id
        and public.is_supervisor_of(s.slp_id)
    )
  );


-- ============================================================
-- teacher_student_tags / teacher_student_tag_links — the Teacher mirror.
-- ============================================================
create table if not exists public.teacher_student_tags (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null,
  created_at timestamptz not null default now()
);

create index if not exists teacher_student_tags_teacher_id_idx on public.teacher_student_tags(teacher_id);

alter table public.teacher_student_tags enable row level security;

create policy "Teachers can view their own student tags"
  on public.teacher_student_tags for select
  using (auth.uid() = teacher_id);

create policy "Teachers can insert their own student tags"
  on public.teacher_student_tags for insert
  with check (auth.uid() = teacher_id);

create policy "Teachers can update their own student tags"
  on public.teacher_student_tags for update
  using (auth.uid() = teacher_id);

create policy "Teachers can delete their own student tags"
  on public.teacher_student_tags for delete
  using (auth.uid() = teacher_id);

create policy "Supervisors can view linked members' teacher student tags"
  on public.teacher_student_tags for select
  using (public.is_supervisor_of(teacher_student_tags.teacher_id));

create table if not exists public.teacher_student_tag_links (
  student_id uuid not null references public.teacher_students(id) on delete cascade,
  tag_id uuid not null references public.teacher_student_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, tag_id)
);

create index if not exists teacher_student_tag_links_tag_id_idx on public.teacher_student_tag_links(tag_id);

alter table public.teacher_student_tag_links enable row level security;

create policy "Teachers can view tag links on their own students"
  on public.teacher_student_tag_links for select
  using (
    exists (
      select 1 from public.teacher_students s
      where s.id = teacher_student_tag_links.student_id and s.teacher_id = auth.uid()
    )
  );

create policy "Teachers can insert tag links on their own students"
  on public.teacher_student_tag_links for insert
  with check (
    exists (
      select 1 from public.teacher_students s
      where s.id = teacher_student_tag_links.student_id and s.teacher_id = auth.uid()
    )
    and exists (
      select 1 from public.teacher_student_tags t
      where t.id = teacher_student_tag_links.tag_id and t.teacher_id = auth.uid()
    )
  );

create policy "Teachers can delete tag links on their own students"
  on public.teacher_student_tag_links for delete
  using (
    exists (
      select 1 from public.teacher_students s
      where s.id = teacher_student_tag_links.student_id and s.teacher_id = auth.uid()
    )
  );

create policy "Supervisors can view linked members' teacher student tag links"
  on public.teacher_student_tag_links for select
  using (
    exists (
      select 1 from public.teacher_students s
      where s.id = teacher_student_tag_links.student_id
        and public.is_supervisor_of(s.teacher_id)
    )
  );
