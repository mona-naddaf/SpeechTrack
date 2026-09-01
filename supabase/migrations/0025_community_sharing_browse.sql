-- ============================================================
-- Community sharing — step 2: browse/discovery. Makes "shared" rows
-- (see 0024_community_sharing.sql) actually readable by *other*
-- accounts on the same side, and exposes the sharing account's
-- display name so a browsed item can be credited to someone.
--
-- RLS approach mirrors 0023_supervisor_readonly_access.sql: one
-- additional, purely-additive SELECT policy per table. Postgres
-- combines multiple permissive policies for the same command with OR,
-- so each policy below sits alongside (never replaces) that table's
-- existing "owner can view their own X" policy — a private row is
-- still only visible to its owner, and insert/update/delete stay
-- untouched (still owner-only) everywhere. "Same side" isolation
-- (an SLP never sees Teacher-shared content and vice versa) falls out
-- for free from the tables already being separate per side
-- (goals/response_formats/materials vs. teacher_goals/
-- teacher_response_formats/teacher_materials) — there's no cross-side
-- table for a policy to accidentally expose.
--
-- goals/teacher_goals also re-assert `student_id is null` in the USING
-- clause even though goals_visibility_bank_only_check (0024) already
-- guarantees a 'shared' row can't have a student_id — belt-and-braces
-- for a policy that's granting cross-account access, so it doesn't
-- rely solely on a constraint defined elsewhere for that guarantee.
-- ============================================================

create policy "Authenticated users can view shared response formats"
  on public.response_formats for select
  using (visibility = 'shared');

create policy "Authenticated users can view shared teacher response formats"
  on public.teacher_response_formats for select
  using (visibility = 'shared');

create policy "Authenticated users can view shared goals"
  on public.goals for select
  using (visibility = 'shared' and student_id is null);

create policy "Authenticated users can view shared teacher goals"
  on public.teacher_goals for select
  using (visibility = 'shared' and student_id is null);

create policy "Authenticated users can view shared materials"
  on public.materials for select
  using (visibility = 'shared');

create policy "Authenticated users can view shared teacher materials"
  on public.teacher_materials for select
  using (visibility = 'shared');


-- ============================================================
-- get_shared_item_authors — the only way the app looks up another
-- account's display name. auth.users isn't exposed via PostgREST at
-- all (it's not in the `public` schema), so a security definer
-- function is the only way to read it cross-account; same tradeoff
-- 0021_supervisor_role_and_links.sql already made for
-- redeem_supervisor_invite_code(). That function only ever reads the
-- *caller's own* row, though — this one deliberately reads other
-- people's, so it's scoped tightly: for each requested id, it only
-- returns a name if that id actually owns at least one 'shared' row
-- in one of the six tables above. That's not a privacy hole — every
-- one of those exists checks is a table + condition the caller could
-- already read directly via the policies just added, so this
-- discloses nothing beyond "here's the name to credit the shared rows
-- you can already see" for those exact rows. An id with nothing
-- shared (the common case) gets no row back, full stop — this is not
-- a general user directory.
-- ============================================================
create or replace function public.get_shared_item_authors(p_ids uuid[])
returns table (id uuid, display_name text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.id,
         coalesce(nullif(trim(u.raw_user_meta_data->>'display_name'), ''), 'Anonymous') as display_name
  from auth.users u
  where u.id = any(p_ids)
    and (
      exists (select 1 from public.goals g where g.slp_id = u.id and g.visibility = 'shared')
      or exists (select 1 from public.teacher_goals g where g.teacher_id = u.id and g.visibility = 'shared')
      or exists (select 1 from public.response_formats r where r.slp_id = u.id and r.visibility = 'shared')
      or exists (select 1 from public.teacher_response_formats r where r.teacher_id = u.id and r.visibility = 'shared')
      or exists (select 1 from public.materials m where m.slp_id = u.id and m.visibility = 'shared')
      or exists (select 1 from public.teacher_materials m where m.teacher_id = u.id and m.visibility = 'shared')
    );
$$;

grant execute on function public.get_shared_item_authors(uuid[]) to authenticated;
