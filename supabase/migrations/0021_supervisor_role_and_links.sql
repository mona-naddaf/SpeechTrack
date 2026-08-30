-- ============================================================
-- Supervisor role — step 1: the role itself, an invite-code
-- linking mechanism (SLP/Teacher -> Supervisor), and nothing else
-- yet. A Supervisor's caseload-level detail view is a later step.
-- ============================================================

-- ============================================================
-- supervisor_invite_codes
-- Short, unique, human-typeable codes a Supervisor generates and
-- shares out-of-band with an SLP or Teacher, who redeems one to
-- create a link. Same alphabet/length as students.parent_access_code
-- (see 0004_home_practice_and_parent_access.sql) — excludes visually
-- ambiguous characters (0/O, 1/I/L).
-- ============================================================
create table if not exists public.supervisor_invite_codes (
  id uuid primary key default gen_random_uuid(),
  supervisor_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  created_at timestamptz not null default now(),
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz
);

create unique index if not exists supervisor_invite_codes_code_idx
  on public.supervisor_invite_codes (code);
create index if not exists supervisor_invite_codes_supervisor_id_idx
  on public.supervisor_invite_codes (supervisor_id);

-- security definer (unlike generate_parent_access_code/set_parent_access_code,
-- which run with the caller's RLS-restricted privileges): the uniqueness
-- check here must see every supervisor's codes, not just the caller's own
-- RLS-visible rows, or two different supervisors could collide.
create or replace function public.generate_supervisor_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- excludes 0/O, 1/I/L
  code text;
  taken boolean;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
    end loop;
    select exists(
      select 1 from public.supervisor_invite_codes where supervisor_invite_codes.code = code
    ) into taken;
    exit when not taken;
  end loop;
  return code;
end;
$$;

create or replace function public.set_supervisor_invite_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.code is null or new.code = '' then
    new.code := public.generate_supervisor_invite_code();
  end if;
  return new;
end;
$$;

drop trigger if exists set_supervisor_invite_code_trigger on public.supervisor_invite_codes;
create trigger set_supervisor_invite_code_trigger
  before insert on public.supervisor_invite_codes
  for each row execute function public.set_supervisor_invite_code();

alter table public.supervisor_invite_codes enable row level security;

create policy "Supervisors can view their own invite codes"
  on public.supervisor_invite_codes for select
  using (auth.uid() = supervisor_id);

create policy "Supervisors can create their own invite codes"
  on public.supervisor_invite_codes for insert
  with check (auth.uid() = supervisor_id);

-- Deliberately no update/delete policy for the authenticated role: a code
-- is only ever marked used by redeem_supervisor_invite_code() below, which
-- runs as security definer and so bypasses RLS.


-- ============================================================
-- supervisor_links
-- One row per Supervisor <-> SLP/Teacher connection, created only
-- through redeem_supervisor_invite_code(). member_name is a snapshot
-- taken at link time (mirrors the displayName = fullName || email
-- pattern used across the dashboards) so the Supervisor's dashboard
-- can list members without a cross-user auth.users lookup of its own.
-- ============================================================
create table if not exists public.supervisor_links (
  id uuid primary key default gen_random_uuid(),
  supervisor_id uuid not null references auth.users(id) on delete cascade,
  member_id uuid not null references auth.users(id) on delete cascade,
  member_role text not null check (member_role in ('slp', 'teacher')),
  member_name text not null,
  created_at timestamptz not null default now()
);

-- Also the race-condition backstop for the "already linked?" check inside
-- redeem_supervisor_invite_code() below.
create unique index if not exists supervisor_links_supervisor_member_idx
  on public.supervisor_links (supervisor_id, member_id);
create index if not exists supervisor_links_supervisor_id_idx
  on public.supervisor_links (supervisor_id);
create index if not exists supervisor_links_member_id_idx
  on public.supervisor_links (member_id);

alter table public.supervisor_links enable row level security;

create policy "Supervisors and linked members can view their own links"
  on public.supervisor_links for select
  using (auth.uid() = supervisor_id or auth.uid() = member_id);

-- Deliberately no insert/update/delete policy for the authenticated role:
-- links are only ever created by redeem_supervisor_invite_code() below,
-- which runs as security definer and so bypasses RLS.


-- ============================================================
-- redeem_supervisor_invite_code — called by an SLP/Teacher's client
-- (supabase.rpc(...)) to redeem a code they were given. Validates and
-- writes both tables atomically; row-locks the invite code so two
-- concurrent redemptions of the same code can't both succeed. The
-- member's role is read from auth.users rather than trusted from the
-- caller, matching getUserRole()'s own fallback-to-"slp" logic.
-- ============================================================
create or replace function public.redeem_supervisor_invite_code(p_code text)
returns table (supervisor_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid := auth.uid();
  v_role_text text;
  v_full_name text;
  v_email text;
  v_invite record;
begin
  if v_member_id is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(raw_user_meta_data->>'role', 'slp'),
         nullif(trim(raw_user_meta_data->>'full_name'), ''),
         email
    into v_role_text, v_full_name, v_email
    from auth.users
   where id = v_member_id;

  if v_role_text not in ('slp', 'teacher') then
    raise exception 'Only SLP and Teacher accounts can link to a supervisor.';
  end if;

  select * into v_invite
    from public.supervisor_invite_codes
   where code = upper(trim(p_code))
   for update;

  if not found then
    raise exception 'That invite code wasn''t found. Please check it and try again.';
  end if;

  if v_invite.used_by is not null then
    raise exception 'That invite code has already been used.';
  end if;

  if v_invite.supervisor_id = v_member_id then
    raise exception 'You can''t link to your own invite code.';
  end if;

  if exists (
    select 1 from public.supervisor_links sl
     where sl.supervisor_id = v_invite.supervisor_id
       and sl.member_id = v_member_id
  ) then
    raise exception 'You''re already linked to this supervisor.';
  end if;

  update public.supervisor_invite_codes
     set used_by = v_member_id, used_at = now()
   where id = v_invite.id;

  insert into public.supervisor_links (supervisor_id, member_id, member_role, member_name)
  values (v_invite.supervisor_id, v_member_id, v_role_text, coalesce(v_full_name, v_email));

  return query select v_invite.supervisor_id;
end;
$$;

grant execute on function public.redeem_supervisor_invite_code(text) to authenticated;
