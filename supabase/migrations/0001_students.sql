-- Students table: one row per student, owned by the SLP (speech-language
-- pathologist) who created them.
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  slp_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  class text,
  created_at timestamptz not null default now()
);

create index if not exists students_slp_id_idx on public.students(slp_id);

-- Row Level Security: each SLP can only ever see/manage their own students.
alter table public.students enable row level security;

create policy "SLPs can view their own students"
  on public.students for select
  using (auth.uid() = slp_id);

create policy "SLPs can insert their own students"
  on public.students for insert
  with check (auth.uid() = slp_id);

create policy "SLPs can update their own students"
  on public.students for update
  using (auth.uid() = slp_id);

create policy "SLPs can delete their own students"
  on public.students for delete
  using (auth.uid() = slp_id);
