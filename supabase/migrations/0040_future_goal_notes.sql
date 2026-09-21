-- ============================================================
-- Future goal notes — a lightweight "jot this down for later" reminder
-- tied to a student, with none of a real goal's structure (no area/
-- subject, target %, or response format). Created from a quick-note
-- input on the session-logging page; a session for that student then
-- shows every unresolved one as a reminder banner until it's promoted
-- into a real goal or dismissed, either of which just sets resolved_at
-- rather than deleting the row.
-- ============================================================

create table if not exists public.future_goal_notes (
  id uuid primary key default gen_random_uuid(),
  slp_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists future_goal_notes_slp_id_idx on public.future_goal_notes(slp_id);
create index if not exists future_goal_notes_student_id_idx on public.future_goal_notes(student_id);

alter table public.future_goal_notes enable row level security;

create policy "SLPs can view their own future goal notes"
  on public.future_goal_notes for select
  using (auth.uid() = slp_id);

create policy "SLPs can insert their own future goal notes"
  on public.future_goal_notes for insert
  with check (auth.uid() = slp_id);

create policy "SLPs can update their own future goal notes"
  on public.future_goal_notes for update
  using (auth.uid() = slp_id);

create policy "SLPs can delete their own future goal notes"
  on public.future_goal_notes for delete
  using (auth.uid() = slp_id);


-- ============================================================
-- teacher_future_goal_notes — the Teacher equivalent.
-- ============================================================
create table if not exists public.teacher_future_goal_notes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.teacher_students(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists teacher_future_goal_notes_teacher_id_idx on public.teacher_future_goal_notes(teacher_id);
create index if not exists teacher_future_goal_notes_student_id_idx on public.teacher_future_goal_notes(student_id);

alter table public.teacher_future_goal_notes enable row level security;

create policy "Teachers can view their own future goal notes"
  on public.teacher_future_goal_notes for select
  using (auth.uid() = teacher_id);

create policy "Teachers can insert their own future goal notes"
  on public.teacher_future_goal_notes for insert
  with check (auth.uid() = teacher_id);

create policy "Teachers can update their own future goal notes"
  on public.teacher_future_goal_notes for update
  using (auth.uid() = teacher_id);

create policy "Teachers can delete their own future goal notes"
  on public.teacher_future_goal_notes for delete
  using (auth.uid() = teacher_id);
