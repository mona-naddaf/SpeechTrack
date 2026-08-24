-- ============================================================
-- assessments — a saved assessment template (list of questions),
-- always private to the SLP who created it. Deliberately no
-- visibility/sharing column, unlike goals/response_formats/materials.
-- ============================================================
create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  slp_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists assessments_slp_id_idx on public.assessments(slp_id);

alter table public.assessments enable row level security;

create policy "SLPs can view their own assessments"
  on public.assessments for select
  using (auth.uid() = slp_id);

create policy "SLPs can insert their own assessments"
  on public.assessments for insert
  with check (auth.uid() = slp_id);

create policy "SLPs can update their own assessments"
  on public.assessments for update
  using (auth.uid() = slp_id);

create policy "SLPs can delete their own assessments"
  on public.assessments for delete
  using (auth.uid() = slp_id);


-- ============================================================
-- assessment_questions
-- No slp_id column of its own — ownership is via assessments.slp_id,
-- so every policy checks through the parent assessment (same pattern
-- as trials -> sessions).
-- ============================================================
create table if not exists public.assessment_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  order_index integer not null default 0,
  prompt text not null,
  response_type text not null,
  expected_answer text,
  notes text,
  created_at timestamptz not null default now(),
  constraint assessment_questions_response_type_check check (
    response_type in ('right_wrong', 'transcription', 'free_text')
  )
);

create index if not exists assessment_questions_assessment_id_idx
  on public.assessment_questions(assessment_id);

alter table public.assessment_questions enable row level security;

create policy "SLPs can view questions in their own assessments"
  on public.assessment_questions for select
  using (
    exists (
      select 1 from public.assessments a
      where a.id = assessment_questions.assessment_id and a.slp_id = auth.uid()
    )
  );

create policy "SLPs can insert questions in their own assessments"
  on public.assessment_questions for insert
  with check (
    exists (
      select 1 from public.assessments a
      where a.id = assessment_questions.assessment_id and a.slp_id = auth.uid()
    )
  );

create policy "SLPs can update questions in their own assessments"
  on public.assessment_questions for update
  using (
    exists (
      select 1 from public.assessments a
      where a.id = assessment_questions.assessment_id and a.slp_id = auth.uid()
    )
  );

create policy "SLPs can delete questions in their own assessments"
  on public.assessment_questions for delete
  using (
    exists (
      select 1 from public.assessments a
      where a.id = assessment_questions.assessment_id and a.slp_id = auth.uid()
    )
  );


-- ============================================================
-- assessment_results — one row per time an assessment is run
-- against a student. assessment_id deliberately has no "on delete
-- cascade": deleting an assessment template while results exist
-- against it is blocked at the app layer (clear message instead),
-- and this is the DB-level backstop for that.
-- ============================================================
create table if not exists public.assessment_results (
  id uuid primary key default gen_random_uuid(),
  slp_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  assessment_id uuid not null references public.assessments(id),
  date date not null default current_date,
  status text not null default 'in_progress',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint assessment_results_status_check check (status in ('in_progress', 'completed'))
);

create index if not exists assessment_results_slp_id_idx on public.assessment_results(slp_id);
create index if not exists assessment_results_student_id_idx on public.assessment_results(student_id);
create index if not exists assessment_results_assessment_id_idx on public.assessment_results(assessment_id);

alter table public.assessment_results enable row level security;

create policy "SLPs can view their own assessment results"
  on public.assessment_results for select
  using (auth.uid() = slp_id);

create policy "SLPs can insert their own assessment results"
  on public.assessment_results for insert
  with check (auth.uid() = slp_id);

create policy "SLPs can update their own assessment results"
  on public.assessment_results for update
  using (auth.uid() = slp_id);

create policy "SLPs can delete their own assessment results"
  on public.assessment_results for delete
  using (auth.uid() = slp_id);


-- ============================================================
-- assessment_answers — one row per question per result (upserted
-- as she answers/changes answers, not appended like trials).
-- No slp_id column of its own — ownership is via
-- assessment_results.slp_id (same pattern as trials -> sessions).
-- ============================================================
create table if not exists public.assessment_answers (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.assessment_results(id) on delete cascade,
  question_id uuid not null references public.assessment_questions(id) on delete cascade,
  response_type text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint assessment_answers_result_question_unique unique (result_id, question_id)
);

create index if not exists assessment_answers_result_id_idx on public.assessment_answers(result_id);
create index if not exists assessment_answers_question_id_idx on public.assessment_answers(question_id);

alter table public.assessment_answers enable row level security;

create policy "SLPs can view answers in their own assessment results"
  on public.assessment_answers for select
  using (
    exists (
      select 1 from public.assessment_results r
      where r.id = assessment_answers.result_id and r.slp_id = auth.uid()
    )
  );

create policy "SLPs can insert answers in their own assessment results"
  on public.assessment_answers for insert
  with check (
    exists (
      select 1 from public.assessment_results r
      where r.id = assessment_answers.result_id and r.slp_id = auth.uid()
    )
  );

create policy "SLPs can update answers in their own assessment results"
  on public.assessment_answers for update
  using (
    exists (
      select 1 from public.assessment_results r
      where r.id = assessment_answers.result_id and r.slp_id = auth.uid()
    )
  );

create policy "SLPs can delete answers in their own assessment results"
  on public.assessment_answers for delete
  using (
    exists (
      select 1 from public.assessment_results r
      where r.id = assessment_answers.result_id and r.slp_id = auth.uid()
    )
  );
