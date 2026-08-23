-- ============================================================
-- sessions
-- ============================================================
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  slp_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists sessions_slp_id_idx on public.sessions(slp_id);
create index if not exists sessions_student_id_idx on public.sessions(student_id);

alter table public.sessions enable row level security;

create policy "SLPs can view their own sessions"
  on public.sessions for select
  using (auth.uid() = slp_id);

create policy "SLPs can insert their own sessions"
  on public.sessions for insert
  with check (auth.uid() = slp_id);

create policy "SLPs can update their own sessions"
  on public.sessions for update
  using (auth.uid() = slp_id);

create policy "SLPs can delete their own sessions"
  on public.sessions for delete
  using (auth.uid() = slp_id);


-- ============================================================
-- trials
-- No slp_id column of its own — ownership is via sessions.slp_id,
-- so every policy checks through the parent session.
-- ============================================================
create table if not exists public.trials (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  response_format_type text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists trials_session_id_idx on public.trials(session_id);
create index if not exists trials_goal_id_idx on public.trials(goal_id);

alter table public.trials enable row level security;

create policy "SLPs can view trials in their own sessions"
  on public.trials for select
  using (
    exists (
      select 1 from public.sessions s
      where s.id = trials.session_id and s.slp_id = auth.uid()
    )
  );

create policy "SLPs can insert trials in their own sessions"
  on public.trials for insert
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = trials.session_id and s.slp_id = auth.uid()
    )
  );

create policy "SLPs can update trials in their own sessions"
  on public.trials for update
  using (
    exists (
      select 1 from public.sessions s
      where s.id = trials.session_id and s.slp_id = auth.uid()
    )
  );

create policy "SLPs can delete trials in their own sessions"
  on public.trials for delete
  using (
    exists (
      select 1 from public.sessions s
      where s.id = trials.session_id and s.slp_id = auth.uid()
    )
  );
