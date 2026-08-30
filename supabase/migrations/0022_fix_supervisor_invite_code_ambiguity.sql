-- ============================================================
-- Fix "column reference \"code\" is ambiguous" in
-- generate_supervisor_invite_code() (introduced in
-- 0021_supervisor_role_and_links.sql).
--
-- The local variable was named `code`, same as
-- supervisor_invite_codes.code. Even though the left side of the
-- uniqueness check was table-qualified, the bare `code` on the right
-- side matched both the table column (in scope via the FROM clause)
-- and the PL/pgSQL variable, which PL/pgSQL rejects as ambiguous
-- rather than silently guessing. Renamed to v_code (and taken to
-- v_taken, matching the v_-prefixed local variables used elsewhere in
-- this migration set, e.g. redeem_supervisor_invite_code()) so no
-- name collides with a column.
-- ============================================================
create or replace function public.generate_supervisor_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- excludes 0/O, 1/I/L
  v_code text;
  v_taken boolean;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
    end loop;
    select exists(
      select 1 from public.supervisor_invite_codes where supervisor_invite_codes.code = v_code
    ) into v_taken;
    exit when not v_taken;
  end loop;
  return v_code;
end;
$$;
