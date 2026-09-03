-- ============================================================
-- Holidays: support a date range (e.g. "Winter Break: Dec 20 - Jan 5"),
-- not just a single day off. Replaces the single `date` column with
-- `start_date`/`end_date` (both inclusive; end_date = start_date for a
-- single-day holiday -- exactly what every existing row already is,
-- which is what the backfill below encodes, so this is a pure shape
-- change: no existing holiday's meaning changes).
-- ============================================================

alter table public.holidays
  add column start_date date,
  add column end_date date;

-- Backfill: every existing holiday was a single day, so both ends of
-- its new range are just that same day -- no data loss.
update public.holidays set start_date = date, end_date = date;

alter table public.holidays
  alter column start_date set not null,
  alter column end_date set not null;

alter table public.holidays
  add constraint holidays_range_check check (end_date >= start_date);

-- A generous but finite cap -- roughly a school year -- so a
-- fat-fingered end date (e.g. the wrong year) can't silently create a
-- holiday spanning years, which eachDateInRange() (src/lib/date.ts)
-- would otherwise expand into a very large per-day list everywhere a
-- holiday feeds the calendar tint or streak protection.
alter table public.holidays
  add constraint holidays_range_span_check check (end_date <= start_date + 366);

drop index if exists public.holidays_date_idx;
create index if not exists holidays_start_date_idx on public.holidays(start_date);
create index if not exists holidays_end_date_idx on public.holidays(end_date);

alter table public.holidays drop column date;
