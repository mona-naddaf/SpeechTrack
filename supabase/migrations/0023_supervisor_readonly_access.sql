-- ============================================================
-- Supervisor role — step 2: read-only access to a linked SLP/Teacher's
-- full caseload data. Adds one additional, purely-additive SELECT
-- policy to every owner-scoped table — never insert/update/delete.
-- Postgres combines multiple permissive policies for the same command
-- with OR, so these sit alongside (never replace) each table's
-- existing "owner can view their own X" policy.
--
-- is_supervisor_of(owner_id) is the single reusable predicate: true
-- when the signed-in user is a supervisor linked to that owner via
-- supervisor_links. It's `language sql` (not plpgsql) specifically to
-- avoid the local-variable/column-name collision that bit
-- generate_supervisor_invite_code() in 0021/0022 — a SQL function has
-- no local variables to collide with a column name. It's `security
-- invoker` (the default): supervisor_links' own RLS policy already
-- lets a supervisor see their own links, so no privilege escalation
-- is needed here.
-- ============================================================
create or replace function public.is_supervisor_of(p_owner_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.supervisor_links sl
    where sl.supervisor_id = auth.uid() and sl.member_id = p_owner_id
  );
$$;

grant execute on function public.is_supervisor_of(uuid) to authenticated;


-- ============================================================
-- Directly-owned tables (owner column lives on the row itself)
-- ============================================================

create policy "Supervisors can view linked members' students"
  on public.students for select
  using (public.is_supervisor_of(students.slp_id));

create policy "Supervisors can view linked members' response formats"
  on public.response_formats for select
  using (public.is_supervisor_of(response_formats.slp_id));

create policy "Supervisors can view linked members' areas"
  on public.areas for select
  using (public.is_supervisor_of(areas.slp_id));

create policy "Supervisors can view linked members' goals"
  on public.goals for select
  using (public.is_supervisor_of(goals.slp_id));

create policy "Supervisors can view linked members' sessions"
  on public.sessions for select
  using (public.is_supervisor_of(sessions.slp_id));

create policy "Supervisors can view linked members' home practice items"
  on public.home_practice_items for select
  using (public.is_supervisor_of(home_practice_items.slp_id));

create policy "Supervisors can view linked members' assessments"
  on public.assessments for select
  using (public.is_supervisor_of(assessments.slp_id));

create policy "Supervisors can view linked members' assessment results"
  on public.assessment_results for select
  using (public.is_supervisor_of(assessment_results.slp_id));

create policy "Supervisors can view linked members' behavior types"
  on public.behavior_types for select
  using (public.is_supervisor_of(behavior_types.slp_id));

create policy "Supervisors can view linked members' SLP behavior logs"
  on public.slp_behavior_logs for select
  using (public.is_supervisor_of(slp_behavior_logs.slp_id));

create policy "Supervisors can view linked members' materials"
  on public.materials for select
  using (public.is_supervisor_of(materials.slp_id));

create policy "Supervisors can view linked members' student custom fields"
  on public.student_custom_fields for select
  using (public.is_supervisor_of(student_custom_fields.slp_id));

create policy "Supervisors can view linked members' teacher students"
  on public.teacher_students for select
  using (public.is_supervisor_of(teacher_students.teacher_id));

create policy "Supervisors can view linked members' teacher subjects"
  on public.teacher_subjects for select
  using (public.is_supervisor_of(teacher_subjects.teacher_id));

create policy "Supervisors can view linked members' teacher response formats"
  on public.teacher_response_formats for select
  using (public.is_supervisor_of(teacher_response_formats.teacher_id));

create policy "Supervisors can view linked members' teacher goals"
  on public.teacher_goals for select
  using (public.is_supervisor_of(teacher_goals.teacher_id));

create policy "Supervisors can view linked members' teacher behavior types"
  on public.teacher_behavior_types for select
  using (public.is_supervisor_of(teacher_behavior_types.teacher_id));

-- Note: the unprefixed `behavior_logs` table is Teacher-owned (has a
-- teacher_id column) — the SLP equivalent is `slp_behavior_logs`
-- above. See supabase/migrations/0008_teacher_behavior_tracking.sql.
create policy "Supervisors can view linked members' behavior logs"
  on public.behavior_logs for select
  using (public.is_supervisor_of(behavior_logs.teacher_id));

create policy "Supervisors can view linked members' teacher sessions"
  on public.teacher_sessions for select
  using (public.is_supervisor_of(teacher_sessions.teacher_id));

create policy "Supervisors can view linked members' teacher home practice items"
  on public.teacher_home_practice_items for select
  using (public.is_supervisor_of(teacher_home_practice_items.teacher_id));

create policy "Supervisors can view linked members' teacher materials"
  on public.teacher_materials for select
  using (public.is_supervisor_of(teacher_materials.teacher_id));

create policy "Supervisors can view linked members' teacher student custom fields"
  on public.teacher_student_custom_fields for select
  using (public.is_supervisor_of(teacher_student_custom_fields.teacher_id));

-- attendance_records is one shared table with nullable slp_id/teacher_id
-- (exactly one set per row, see 0015_schedule_and_attendance.sql) —
-- coalesce covers whichever side owns a given row in one policy.
create policy "Supervisors can view linked members' attendance records"
  on public.attendance_records for select
  using (
    public.is_supervisor_of(
      coalesce(attendance_records.slp_id, attendance_records.teacher_id)
    )
  );


-- ============================================================
-- Indirectly-owned tables (ownership reached via a join) — same
-- exists(...) join path each table's own owner-scoped policy already
-- uses, just swapping the `= auth.uid()` equality check for
-- is_supervisor_of(...).
-- ============================================================

create policy "Supervisors can view linked members' trials"
  on public.trials for select
  using (
    exists (
      select 1 from public.sessions s
      where s.id = trials.session_id
        and public.is_supervisor_of(s.slp_id)
    )
  );

create policy "Supervisors can view linked members' practice logs"
  on public.practice_logs for select
  using (
    exists (
      select 1 from public.students s
      where s.id = practice_logs.student_id
        and public.is_supervisor_of(s.slp_id)
    )
  );

create policy "Supervisors can view linked members' praise"
  on public.praise for select
  using (
    exists (
      select 1 from public.practice_logs pl
      join public.students s on s.id = pl.student_id
      where pl.id = praise.practice_log_id
        and public.is_supervisor_of(s.slp_id)
    )
  );

create policy "Supervisors can view linked members' assessment questions"
  on public.assessment_questions for select
  using (
    exists (
      select 1 from public.assessments a
      where a.id = assessment_questions.assessment_id
        and public.is_supervisor_of(a.slp_id)
    )
  );

create policy "Supervisors can view linked members' assessment answers"
  on public.assessment_answers for select
  using (
    exists (
      select 1 from public.assessment_results r
      where r.id = assessment_answers.result_id
        and public.is_supervisor_of(r.slp_id)
    )
  );

create policy "Supervisors can view linked members' assessment areas"
  on public.assessment_areas for select
  using (
    exists (
      select 1 from public.assessments a
      where a.id = assessment_areas.assessment_id
        and public.is_supervisor_of(a.slp_id)
    )
  );

create policy "Supervisors can view linked members' material goals"
  on public.material_goals for select
  using (
    exists (
      select 1 from public.materials m
      where m.id = material_goals.material_id
        and public.is_supervisor_of(m.slp_id)
    )
  );

create policy "Supervisors can view linked members' teacher trials"
  on public.teacher_trials for select
  using (
    exists (
      select 1 from public.teacher_sessions s
      where s.id = teacher_trials.session_id
        and public.is_supervisor_of(s.teacher_id)
    )
  );

create policy "Supervisors can view linked members' teacher practice logs"
  on public.teacher_practice_logs for select
  using (
    exists (
      select 1 from public.teacher_students s
      where s.id = teacher_practice_logs.student_id
        and public.is_supervisor_of(s.teacher_id)
    )
  );

create policy "Supervisors can view linked members' teacher praise"
  on public.teacher_praise for select
  using (
    exists (
      select 1 from public.teacher_practice_logs pl
      join public.teacher_students s on s.id = pl.student_id
      where pl.id = teacher_praise.practice_log_id
        and public.is_supervisor_of(s.teacher_id)
    )
  );

create policy "Supervisors can view linked members' teacher material goals"
  on public.teacher_material_goals for select
  using (
    exists (
      select 1 from public.teacher_materials m
      where m.id = teacher_material_goals.material_id
        and public.is_supervisor_of(m.teacher_id)
    )
  );

-- Deliberately no insert/update/delete policy anywhere in this
-- migration — a supervisor's access is read-only, full stop.
