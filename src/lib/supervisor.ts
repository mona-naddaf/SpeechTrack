import type { SupabaseClient } from "@supabase/supabase-js";
import type { SupervisorLink } from "@/lib/types";

/** Confirms the signed-in supervisor is actually linked to `memberId`,
 *  scoped by RLS (supervisor_links only returns rows where
 *  auth.uid() = supervisor_id or member_id — never trust the `id` route
 *  param on its own). Every /supervisor/members/[id]/... page calls
 *  this first; a null result means "not linked" and the caller should
 *  notFound() rather than reveal whether the id exists at all. */
export async function verifySupervisorLink(
  supabase: SupabaseClient,
  memberId: string
): Promise<SupervisorLink | null> {
  const { data } = await supabase
    .from("supervisor_links")
    .select("id, supervisor_id, member_id, member_role, member_name, created_at")
    .eq("member_id", memberId)
    .maybeSingle();

  return (data as SupervisorLink | null) ?? null;
}
