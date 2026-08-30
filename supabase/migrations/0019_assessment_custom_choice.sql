-- ============================================================
-- assessment_questions.choices — the list of custom option labels for a
-- "custom_choice" question (e.g. ["Present", "Emerging", "Absent"]).
-- Nullable/unused for every other response_type. No shape constraint at
-- the DB level (same light-touch approach as other jsonb columns in this
-- schema, e.g. trials.value) — the app layer enforces 2-4 non-empty
-- labels when saving from the question editor.
-- ============================================================
alter table public.assessment_questions
  add column if not exists choices jsonb;

alter table public.assessment_questions
  drop constraint if exists assessment_questions_response_type_check;

alter table public.assessment_questions
  add constraint assessment_questions_response_type_check check (
    response_type in ('right_wrong', 'transcription', 'free_text', 'custom_choice')
  );
