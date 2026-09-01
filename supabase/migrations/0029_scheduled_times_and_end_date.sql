-- ============================================================
-- Schedule/Calendar feature — step 1: richer scheduling data.
--
-- scheduled_days goes from a plain text[] of day names (0015) to a
-- jsonb array of {"day": ..., "time": "HH:MM"} objects, so each
-- scheduled day can carry its own time. schedule_end_date is new:
-- a nullable date meant to represent "scheduled through end of
-- term/year." Both changes land on students AND teacher_students,
-- same as every other mirrored SLP/Teacher feature in this app.
--
-- This is a DATA-SHAPE migration, not a purely additive one — existing
-- scheduled_days rows must convert in place, not just get a new empty
-- column alongside old data. `alter column ... type jsonb using (...)`
-- does this atomically as part of the column change itself (the USING
-- expression runs once per existing row, in the same transaction as
-- the type change), which is safer than a separate
-- "add new column, backfill, drop old column" dance for this: there is
-- no window where both the old and new column exist and could drift,
-- and a conversion error aborts the whole migration rather than
-- leaving some rows converted and others not.
--
-- Placeholder time: the spec calls for defaulting existing entries to
-- "09:00" since no time was ever captured before this migration. That
-- placeholder is only ever applied to rows that already had a day in
-- scheduled_days pre-migration -- an empty scheduled_days stays an
-- empty array, not a made-up entry.
-- ============================================================

-- ============================================================
-- migrate_scheduled_days_to_jsonb — the actual text[] -> jsonb
-- conversion, factored into its own function specifically because
-- `alter column ... type ... using <expr>` evaluates <expr> in a
-- restricted "transform expression" context that Postgres's parser
-- rejects a subquery in outright (error 0A000: "cannot use subquery in
-- transform expression"), even though the identical query is completely
-- ordinary on its own -- e.g. `select jsonb_agg(...) from unnest(...)`
-- needs a FROM clause to drive the aggregate, and that's exactly what
-- trips the restriction when it's written inline. A plain function
-- *call*, though, is just a scalar expression to the USING clause --
-- what happens inside the function body is invisible to that
-- restriction, so moving the conversion in here and calling
-- `migrate_scheduled_days_to_jsonb(scheduled_days)` from USING sides
-- around it entirely. Dropped again once both tables are converted;
-- it has no reason to exist after this migration finishes.
--
-- `with ordinality` preserves each row's original array element order
-- rather than re-sorting (e.g. alphabetically, which would wrongly
-- place "friday" before "monday") -- in practice the app has only ever
-- written scheduled_days in Mon-Sun order already (see
-- src/components/schedule-picker.tsx's toggle()), so this is a no-op
-- for real data, but it's the safer choice regardless of that
-- invariant holding for every historical row. coalesce(..., '[]') is
-- what keeps an already-empty scheduled_days an empty array rather
-- than jsonb_agg turning "no rows to aggregate" into a null.
-- ============================================================
create or replace function public.migrate_scheduled_days_to_jsonb(p_days text[])
returns jsonb
language sql
immutable
as $$
  select coalesce(
    jsonb_agg(jsonb_build_object('day', d, 'time', '09:00') order by ord),
    '[]'::jsonb
  )
  from unnest(p_days) with ordinality as t(d, ord);
$$;

-- Each column's existing default ('{}'::text[], from 0015) has to go
-- *before* the type change: ALTER COLUMN ... TYPE also tries to carry
-- the current default forward by casting it to the new type, and
-- text[] -> jsonb isn't a cast Postgres will do automatically for a
-- DEFAULT expression (error 42804). Dropping the old default first,
-- then setting the real '[]'::jsonb default after the type change,
-- sidesteps that entirely rather than relying on an implicit cast.
alter table public.students
  alter column scheduled_days drop default;

alter table public.students
  alter column scheduled_days type jsonb
  using public.migrate_scheduled_days_to_jsonb(scheduled_days);

alter table public.students
  alter column scheduled_days set default '[]'::jsonb;

alter table public.teacher_students
  alter column scheduled_days drop default;

alter table public.teacher_students
  alter column scheduled_days type jsonb
  using public.migrate_scheduled_days_to_jsonb(scheduled_days);

alter table public.teacher_students
  alter column scheduled_days set default '[]'::jsonb;

drop function public.migrate_scheduled_days_to_jsonb(text[]);


-- ============================================================
-- Shape guard for the new jsonb structure -- every element must be a
-- {day, time} object with a recognized day name and an HH:MM (24h)
-- time, so nothing bypassing the app's own form (a hand-rolled API
-- call, a future migration bug) can silently write scheduled_days into
-- a shape the calendar view this is laying groundwork for can't parse.
-- Unlike migrate_scheduled_days_to_jsonb above, this one is used only
-- inside a CHECK constraint (not an ALTER COLUMN ... USING clause), so
-- the "no subquery" restriction never applies to it -- it stays as an
-- ordinary permanent function.
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
        and elem->>'day' in ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
        and elem->>'time' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      )
    );
$$;

alter table public.students
  add constraint students_scheduled_days_shape_check
  check (public.is_valid_scheduled_days(scheduled_days));

alter table public.teacher_students
  add constraint teacher_students_scheduled_days_shape_check
  check (public.is_valid_scheduled_days(scheduled_days));


-- ============================================================
-- schedule_end_date -- "scheduled through end of term/year". Nullable:
-- most students won't have one set until step 2 of this feature makes
-- it easy to manage from an actual calendar view.
-- ============================================================
alter table public.students
  add column if not exists schedule_end_date date;

alter table public.teacher_students
  add column if not exists schedule_end_date date;
