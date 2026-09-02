-- ============================================================
-- Schedule/Calendar feature — step 2: per-entry session duration.
--
-- scheduled_days entries (jsonb {day, time}[], from 0029) each gain a
-- "duration_minutes" field — real session length varies per student
-- rather than always being the 30-minute block the calendar view
-- (src/components/schedule-view.tsx) previously just assumed for
-- sizing. Same "both students AND teacher_students" mirroring every
-- other scheduled_days change in this app has followed.
--
-- Existing rows are backfilled to 30 (the same default the app has
-- always effectively used) rather than left without the field — the
-- CHECK constraint below requires every element to carry one, and
-- backfilling in place keeps that constraint valid for old data
-- without a "field may be missing" escape hatch the app would then
-- have to special-case forever.
-- ============================================================

update public.students
set scheduled_days = (
  select coalesce(
    jsonb_agg(
      elem || jsonb_build_object(
        'duration_minutes',
        coalesce((elem->>'duration_minutes')::numeric, 30)
      )
      order by ord
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(scheduled_days) with ordinality as t(elem, ord)
)
where scheduled_days <> '[]'::jsonb;

update public.teacher_students
set scheduled_days = (
  select coalesce(
    jsonb_agg(
      elem || jsonb_build_object(
        'duration_minutes',
        coalesce((elem->>'duration_minutes')::numeric, 30)
      )
      order by ord
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(scheduled_days) with ordinality as t(elem, ord)
)
where scheduled_days <> '[]'::jsonb;

-- ============================================================
-- is_valid_scheduled_days — replaced in place (same name/signature as
-- 0029) to also require duration_minutes: a positive number, capped at
-- 480 (8 hours) as a sanity bound against fat-fingered entry rather
-- than any real session-length limit. CREATE OR REPLACE keeps the
-- existing CHECK constraints on both tables pointed at this function
-- without needing to drop and re-add them.
-- ============================================================
create or replace function public.is_valid_scheduled_days(p_value jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(p_value) = 'array'
    and not exists (
      select 1
      from jsonb_array_elements(p_value) as elem
      where not (
        jsonb_typeof(elem) = 'object'
        and elem ? 'day'
        and elem ? 'time'
        and elem ? 'duration_minutes'
        and elem->>'day' in ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
        and elem->>'time' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        and jsonb_typeof(elem->'duration_minutes') = 'number'
        and (elem->>'duration_minutes')::numeric > 0
        and (elem->>'duration_minutes')::numeric <= 480
      )
    );
$$;
