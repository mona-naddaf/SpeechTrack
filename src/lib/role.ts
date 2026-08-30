export type Role = "slp" | "teacher" | "supervisor";

/** Reads the account's role from Supabase auth user_metadata. Accounts
 *  created before this field existed (or anything malformed) default to
 *  "slp" — the app's original/only role — so nothing breaks for them. */
export function getUserRole(
  user: { user_metadata?: Record<string, unknown> | null } | null | undefined
): Role {
  const role = user?.user_metadata?.role;
  if (role === "teacher") return "teacher";
  if (role === "supervisor") return "supervisor";
  return "slp";
}
