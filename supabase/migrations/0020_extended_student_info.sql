-- ============================================================
-- Extended student info — date of birth, parent emails, homeroom
-- teacher, plus free-form custom label/value pairs (e.g. "Allergy:
-- Peanuts"), for both the SLP (`students`) and Teacher
-- (`teacher_students`) sides. All four new columns are nullable/
-- optional — every existing student row is unaffected until someone
-- fills these in on the add/edit form.
-- ============================================================

alter table public.students
  add column if not exists date_of_birth date,
  add column if not exists mother_email text,
  add column if not exists father_email text,
  add column if not exists homeroom_teacher text;

alter table public.teacher_students
  add column if not exists date_of_birth date,
  add column if not exists mother_email text,
  add column if not exists father_email text,
  add column if not exists homeroom_teacher text;


-- ============================================================
-- student_custom_fields — any number of free-form label/value pairs
-- per student (e.g. "IEP status: Yes"). Own `slp_id` column rather
-- than an RLS join through `students`, matching the direct-owner-
-- column pattern most other per-student tables use (home_practice_items,
-- slp_behavior_logs, ...).
-- ============================================================
create table if not exists public.student_custom_fields (
  id uuid primary key default gen_random_uuid(),
  slp_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  label text not null,
  value text not null,
  created_at timestamptz not null default now()
);

create index if not exists student_custom_fields_slp_id_idx on public.student_custom_fields(slp_id);
create index if not exists student_custom_fields_student_id_idx on public.student_custom_fields(student_id);

alter table public.student_custom_fields enable row level security;

create policy "SLPs can view their own students' custom fields"
  on public.student_custom_fields for select
  using (auth.uid() = slp_id);

create policy "SLPs can insert their own students' custom fields"
  on public.student_custom_fields for insert
  with check (auth.uid() = slp_id);

create policy "SLPs can update their own students' custom fields"
  on public.student_custom_fields for update
  using (auth.uid() = slp_id);

create policy "SLPs can delete their own students' custom fields"
  on public.student_custom_fields for delete
  using (auth.uid() = slp_id);


-- ============================================================
-- teacher_student_custom_fields — Teacher-side mirror of the above,
-- own `teacher_id` column, same shape/RLS pattern.
-- ============================================================
create table if not exists public.teacher_student_custom_fields (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.teacher_students(id) on delete cascade,
  label text not null,
  value text not null,
  created_at timestamptz not null default now()
);

create index if not exists teacher_student_custom_fields_teacher_id_idx on public.teacher_student_custom_fields(teacher_id);
create index if not exists teacher_student_custom_fields_student_id_idx on public.teacher_student_custom_fields(student_id);

alter table public.teacher_student_custom_fields enable row level security;

create policy "Teachers can view their own students' custom fields"
  on public.teacher_student_custom_fields for select
  using (auth.uid() = teacher_id);

create policy "Teachers can insert their own students' custom fields"
  on public.teacher_student_custom_fields for insert
  with check (auth.uid() = teacher_id);

create policy "Teachers can update their own students' custom fields"
  on public.teacher_student_custom_fields for update
  using (auth.uid() = teacher_id);

create policy "Teachers can delete their own students' custom fields"
  on public.teacher_student_custom_fields for delete
  using (auth.uid() = teacher_id);
