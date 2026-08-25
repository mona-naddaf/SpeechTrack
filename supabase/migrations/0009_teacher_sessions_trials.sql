-- ============================================================
-- teacher_sessions — the Teacher equivalent of `sessions`.
-- ============================================================
create table if not exists public.teacher_sessions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.teacher_students(id) on delete cascade,
  date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists teacher_sessions_teacher_id_idx on public.teacher_sessions(teacher_id);
create index if not exists teacher_sessions_student_id_idx on public.teacher_sessions(student_id);

alter table public.teacher_sessions enable row level security;

create policy "Teachers can view their own sessions"
  on public.teacher_sessions for select
  using (auth.uid() = teacher_id);

create policy "Teachers can insert their own sessions"
  on public.teacher_sessions for insert
  with check (auth.uid() = teacher_id);

create policy "Teachers can update their own sessions"
  on public.teacher_sessions for update
  using (auth.uid() = teacher_id);

create policy "Teachers can delete their own sessions"
  on public.teacher_sessions for delete
  using (auth.uid() = teacher_id);


-- ============================================================
-- teacher_trials — the Teacher equivalent of `trials`.
-- No teacher_id column of its own — ownership is via
-- teacher_sessions.teacher_id, same pattern as trials -> sessions.
-- ============================================================
create table if not exists public.teacher_trials (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.teacher_sessions(id) on delete cascade,
  goal_id uuid not null references public.teacher_goals(id) on delete cascade,
  response_format_type text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists teacher_trials_session_id_idx on public.teacher_trials(session_id);
create index if not exists teacher_trials_goal_id_idx on public.teacher_trials(goal_id);

alter table public.teacher_trials enable row level security;

create policy "Teachers can view trials in their own sessions"
  on public.teacher_trials for select
  using (
    exists (
      select 1 from public.teacher_sessions s
      where s.id = teacher_trials.session_id and s.teacher_id = auth.uid()
    )
  );

create policy "Teachers can insert trials in their own sessions"
  on public.teacher_trials for insert
  with check (
    exists (
      select 1 from public.teacher_sessions s
      where s.id = teacher_trials.session_id and s.teacher_id = auth.uid()
    )
  );

create policy "Teachers can update trials in their own sessions"
  on public.teacher_trials for update
  using (
    exists (
      select 1 from public.teacher_sessions s
      where s.id = teacher_trials.session_id and s.teacher_id = auth.uid()
    )
  );

create policy "Teachers can delete trials in their own sessions"
  on public.teacher_trials for delete
  using (
    exists (
      select 1 from public.teacher_sessions s
      where s.id = teacher_trials.session_id and s.teacher_id = auth.uid()
    )
  );
