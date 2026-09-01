-- ============================================================
-- Community sharing — ratings, the final piece. One shared table for
-- both sides — item_type distinguishes SLP content ('goal',
-- 'response_format', 'material') from Teacher content ('teacher_goal',
-- 'teacher_response_format', 'teacher_material'), so there's no need
-- for a second teacher_community_ratings table: a rating row is fully
-- identified by (item_type, item_id), same "same side" isolation the
-- rest of Community Sharing gets for free from SLP/Teacher tables
-- already being separate — a 'goal' item_id can never collide with a
-- 'teacher_goal' item_id's meaning since the type tag disambiguates.
--
-- item_id is deliberately NOT a foreign key: it points at whichever of
-- six different tables item_type names, and Postgres has no single-
-- column FK that can reference "one of several tables" depending on
-- another column's value. Referential cleanup is handled by the six
-- AFTER DELETE triggers at the bottom instead (belt-and-braces against
-- ratings orphaned by a deleted item lingering forever — harmless
-- either way, since every read is scoped to items that still exist,
-- but worth not leaving around).
-- ============================================================

create table if not exists public.community_ratings (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (
    item_type in (
      'goal', 'response_format', 'material',
      'teacher_goal', 'teacher_response_format', 'teacher_material'
    )
  ),
  item_id uuid not null,
  rater_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  -- One rating per account per item — re-rating is an upsert on this
  -- constraint (see src/components/community-browse.tsx), never a
  -- second row.
  unique (item_type, item_id, rater_id)
);

create index if not exists community_ratings_item_idx
  on public.community_ratings(item_type, item_id);

alter table public.community_ratings enable row level security;


-- ============================================================
-- community_item_is_visible / community_item_is_ratable — the two
-- reusable predicates the three policies below are built from, same
-- "single reusable predicate function" pattern as is_supervisor_of()
-- in 0023_supervisor_readonly_access.sql. Both `security invoker`
-- (the default, stated explicitly for the same reason 0023 does): each
-- branch checks exactly "owns it OR it's shared", which is exactly what
-- that source table's own SELECT policies (0002/0007/0016/0025) already
-- let the caller read directly — so evaluating it as the calling user
-- rather than bypassing RLS discloses nothing extra and stays correct
-- if those policies ever change.
--
-- is_visible: owns the item, OR the item is shared — mirrors "readable
-- by anyone who can see the item itself" from the spec.
-- is_ratable: the item is shared AND NOT owned by the caller — an
-- account can rate anyone else's shared item, never a private item,
-- and never (via this predicate) their own.
-- ============================================================
create or replace function public.community_item_is_visible(p_item_type text, p_item_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select case p_item_type
    when 'goal' then exists (
      select 1 from public.goals g
      where g.id = p_item_id and (g.slp_id = auth.uid() or g.visibility = 'shared')
    )
    when 'response_format' then exists (
      select 1 from public.response_formats r
      where r.id = p_item_id and (r.slp_id = auth.uid() or r.visibility = 'shared')
    )
    when 'material' then exists (
      select 1 from public.materials m
      where m.id = p_item_id and (m.slp_id = auth.uid() or m.visibility = 'shared')
    )
    when 'teacher_goal' then exists (
      select 1 from public.teacher_goals g
      where g.id = p_item_id and (g.teacher_id = auth.uid() or g.visibility = 'shared')
    )
    when 'teacher_response_format' then exists (
      select 1 from public.teacher_response_formats r
      where r.id = p_item_id and (r.teacher_id = auth.uid() or r.visibility = 'shared')
    )
    when 'teacher_material' then exists (
      select 1 from public.teacher_materials m
      where m.id = p_item_id and (m.teacher_id = auth.uid() or m.visibility = 'shared')
    )
    else false
  end;
$$;

grant execute on function public.community_item_is_visible(text, uuid) to authenticated;

create or replace function public.community_item_is_ratable(p_item_type text, p_item_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select case p_item_type
    when 'goal' then exists (
      select 1 from public.goals g
      where g.id = p_item_id and g.visibility = 'shared' and g.slp_id <> auth.uid()
    )
    when 'response_format' then exists (
      select 1 from public.response_formats r
      where r.id = p_item_id and r.visibility = 'shared' and r.slp_id <> auth.uid()
    )
    when 'material' then exists (
      select 1 from public.materials m
      where m.id = p_item_id and m.visibility = 'shared' and m.slp_id <> auth.uid()
    )
    when 'teacher_goal' then exists (
      select 1 from public.teacher_goals g
      where g.id = p_item_id and g.visibility = 'shared' and g.teacher_id <> auth.uid()
    )
    when 'teacher_response_format' then exists (
      select 1 from public.teacher_response_formats r
      where r.id = p_item_id and r.visibility = 'shared' and r.teacher_id <> auth.uid()
    )
    when 'teacher_material' then exists (
      select 1 from public.teacher_materials m
      where m.id = p_item_id and m.visibility = 'shared' and m.teacher_id <> auth.uid()
    )
    else false
  end;
$$;

grant execute on function public.community_item_is_ratable(text, uuid) to authenticated;


-- ============================================================
-- Policies. No delete policy at all — there's no "remove my rating"
-- feature (keeping this simple, per spec), so nothing needs delete
-- access; the cleanup triggers below use security definer specifically
-- to bypass that absence for their own narrow system purpose.
-- ============================================================

create policy "Ratings are visible to anyone who can see the rated item"
  on public.community_ratings for select
  using (public.community_item_is_visible(item_type, item_id));

create policy "Accounts can rate someone else's shared items"
  on public.community_ratings for insert
  with check (
    rater_id = auth.uid()
    and public.community_item_is_ratable(item_type, item_id)
  );

create policy "Accounts can update their own rating"
  on public.community_ratings for update
  using (rater_id = auth.uid())
  with check (
    rater_id = auth.uid()
    and public.community_item_is_ratable(item_type, item_id)
  );


-- ============================================================
-- Cleanup triggers — delete any ratings left behind when the item they
-- rate is deleted. security definer because community_ratings has no
-- delete policy at all (see above): a rating being cleaned up here
-- typically belongs to a *different* account than whoever is deleting
-- the item, so this needs to bypass RLS to actually remove those rows
-- rather than silently affecting zero of them. Narrow and specific to
-- this one cleanup purpose, same tradeoff already made for
-- redeem_supervisor_invite_code() in 0021.
-- ============================================================
create or replace function public.delete_community_ratings_for_deleted_item()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.community_ratings
   where item_type = TG_ARGV[0] and item_id = old.id;
  return old;
end;
$$;

drop trigger if exists goals_delete_community_ratings on public.goals;
create trigger goals_delete_community_ratings
  after delete on public.goals
  for each row execute function public.delete_community_ratings_for_deleted_item('goal');

drop trigger if exists response_formats_delete_community_ratings on public.response_formats;
create trigger response_formats_delete_community_ratings
  after delete on public.response_formats
  for each row execute function public.delete_community_ratings_for_deleted_item('response_format');

drop trigger if exists materials_delete_community_ratings on public.materials;
create trigger materials_delete_community_ratings
  after delete on public.materials
  for each row execute function public.delete_community_ratings_for_deleted_item('material');

drop trigger if exists teacher_goals_delete_community_ratings on public.teacher_goals;
create trigger teacher_goals_delete_community_ratings
  after delete on public.teacher_goals
  for each row execute function public.delete_community_ratings_for_deleted_item('teacher_goal');

drop trigger if exists teacher_response_formats_delete_community_ratings on public.teacher_response_formats;
create trigger teacher_response_formats_delete_community_ratings
  after delete on public.teacher_response_formats
  for each row execute function public.delete_community_ratings_for_deleted_item('teacher_response_format');

drop trigger if exists teacher_materials_delete_community_ratings on public.teacher_materials;
create trigger teacher_materials_delete_community_ratings
  after delete on public.teacher_materials
  for each row execute function public.delete_community_ratings_for_deleted_item('teacher_material');
