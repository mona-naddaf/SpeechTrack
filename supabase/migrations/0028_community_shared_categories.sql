-- ============================================================
-- Community sharing — fixes shared goals/materials showing
-- "Uncategorized" and shared materials not showing their linked goal.
--
-- Root cause (confirmed live before writing this migration): the
-- community pages fetch shared goals/materials with an embedded
-- PostgREST join — e.g. `area:areas(id, name)` — to show the category
-- name. That join is itself a SELECT against `areas`/`teacher_subjects`
-- (and, for a material's linked goal, `material_goals`/
-- `teacher_material_goals` joined to `goals`/`teacher_goals`), and none
-- of those tables have a "shared" policy the way 0025 gave
-- goals/response_formats/materials themselves — only their *owner* can
-- read a row in any of them (0002/0007/0016). So for anyone browsing
-- someone *else's* shared item, the join silently comes back null (the
-- parent row is still visible; the embedded one just isn't), the
-- client's `?? "Uncategorized"` fallback fires, and the linked-goal
-- join returns no row at all rather than null.
--
-- Fix follows the exact same shape as get_shared_item_authors (0025):
-- a narrow security-definer function that only ever discloses a
-- category name or linked-goal title for a row the caller could
-- already see the *existence* of via the "shared" policies that
-- already exist — never a new class of data.
-- ============================================================

-- ============================================================
-- get_shared_item_categories — one category name per (item_type,
-- item_id), for the four item types that actually have a category
-- (goal/material on the SLP side, teacher_goal/teacher_material on the
-- Teacher side; response formats are categorized by `type`, not a
-- lookup table, so they were never affected by this bug).
--
-- Scoped tight: each branch only matches rows that are already
-- `visibility = 'shared'` — the same universe the community pages'
-- own goals/materials queries are already filtered to, and the same
-- universe the "Authenticated users can view shared X" policies
-- (0025) already let the caller read directly. A private item's
-- category is never disclosed here, regardless of whose id is passed.
-- ============================================================
create or replace function public.get_shared_item_categories(p_item_type text, p_item_ids uuid[])
returns table (item_id uuid, category_name text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select g.id, a.name
  from public.goals g
  join public.areas a on a.id = g.area_id
  where p_item_type = 'goal' and g.id = any(p_item_ids) and g.visibility = 'shared'
  union all
  select m.id, a.name
  from public.materials m
  join public.areas a on a.id = m.area_id
  where p_item_type = 'material' and m.id = any(p_item_ids) and m.visibility = 'shared'
  union all
  select g.id, s.name
  from public.teacher_goals g
  join public.teacher_subjects s on s.id = g.subject_id
  where p_item_type = 'teacher_goal' and g.id = any(p_item_ids) and g.visibility = 'shared'
  union all
  select m.id, s.name
  from public.teacher_materials m
  join public.teacher_subjects s on s.id = m.subject_id
  where p_item_type = 'teacher_material' and m.id = any(p_item_ids) and m.visibility = 'shared';
$$;

grant execute on function public.get_shared_item_categories(text, uuid[]) to authenticated;


-- ============================================================
-- get_shared_material_linked_goals — the goal(s) a shared material is
-- linked to, for display on the Community page.
--
-- material_goals/teacher_material_goals can link a material to *any*
-- of the owner's goals, including a real student's private, assigned
-- goal (see 0016_materials.sql) — which may name that child or
-- describe them specifically. That must never leak to another
-- account, so this deliberately requires the linked goal *itself* to
-- also be `visibility = 'shared'`, not merely that the material is
-- shared. A material linked only to private/assigned goals simply
-- shows no linked goal here — narrower than "everything the owner
-- could see," by design, because unlike category names a goal's title
-- can itself be the sensitive part.
-- ============================================================
create or replace function public.get_shared_material_linked_goals(p_material_type text, p_material_ids uuid[])
returns table (material_id uuid, goal_id uuid, goal_text text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select mg.material_id, g.id, g.text
  from public.material_goals mg
  join public.materials m on m.id = mg.material_id
  join public.goals g on g.id = mg.goal_id
  where p_material_type = 'material'
    and mg.material_id = any(p_material_ids)
    and m.visibility = 'shared'
    and g.visibility = 'shared'
  union all
  select tmg.material_id, g.id, g.text
  from public.teacher_material_goals tmg
  join public.teacher_materials m on m.id = tmg.material_id
  join public.teacher_goals g on g.id = tmg.goal_id
  where p_material_type = 'teacher_material'
    and tmg.material_id = any(p_material_ids)
    and m.visibility = 'shared'
    and g.visibility = 'shared';
$$;

grant execute on function public.get_shared_material_linked_goals(text, uuid[]) to authenticated;
