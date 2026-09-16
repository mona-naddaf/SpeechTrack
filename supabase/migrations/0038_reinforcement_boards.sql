-- ============================================================
-- Reinforcement Bank — a library of visual reinforcement mini-game
-- "boards" (tap-to-advance animations with a confetti payoff) used to
-- reward a child during live sessions.
--
-- `type` is a key naming which mini-game template a board uses (e.g.
-- "hop_to_goal", "rocket_launch" — see src/lib/reinforcement-games.ts).
-- `step_count` controls how many obstacles/stars the animation renders
-- before the celebration. `config` is unused today but reserved for
-- future per-board customization (colors, messages, etc.) so it doesn't
-- require another migration to add.
--
-- Self-contained for now: no link to students, sessions, or trials.
-- Live-session integration and long-term reinforcement-history tracking
-- are separate future work.
-- ============================================================

create table if not exists public.reinforcement_boards (
  id uuid primary key default gen_random_uuid(),
  slp_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null,
  step_count integer not null default 5,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint reinforcement_boards_step_count_range check (
    step_count >= 1 and step_count <= 12
  )
);

create index if not exists reinforcement_boards_slp_id_idx on public.reinforcement_boards(slp_id);

alter table public.reinforcement_boards enable row level security;

create policy "SLPs can view their own reinforcement boards"
  on public.reinforcement_boards for select
  using (auth.uid() = slp_id);

create policy "SLPs can insert their own reinforcement boards"
  on public.reinforcement_boards for insert
  with check (auth.uid() = slp_id);

create policy "SLPs can update their own reinforcement boards"
  on public.reinforcement_boards for update
  using (auth.uid() = slp_id);

create policy "SLPs can delete their own reinforcement boards"
  on public.reinforcement_boards for delete
  using (auth.uid() = slp_id);


-- ============================================================
-- teacher_reinforcement_boards — the Teacher equivalent.
-- ============================================================
create table if not exists public.teacher_reinforcement_boards (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null,
  step_count integer not null default 5,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint teacher_reinforcement_boards_step_count_range check (
    step_count >= 1 and step_count <= 12
  )
);

create index if not exists teacher_reinforcement_boards_teacher_id_idx on public.teacher_reinforcement_boards(teacher_id);

alter table public.teacher_reinforcement_boards enable row level security;

create policy "Teachers can view their own reinforcement boards"
  on public.teacher_reinforcement_boards for select
  using (auth.uid() = teacher_id);

create policy "Teachers can insert their own reinforcement boards"
  on public.teacher_reinforcement_boards for insert
  with check (auth.uid() = teacher_id);

create policy "Teachers can update their own reinforcement boards"
  on public.teacher_reinforcement_boards for update
  using (auth.uid() = teacher_id);

create policy "Teachers can delete their own reinforcement boards"
  on public.teacher_reinforcement_boards for delete
  using (auth.uid() = teacher_id);
