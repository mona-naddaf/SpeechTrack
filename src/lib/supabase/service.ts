import { createClient } from "@supabase/supabase-js";

/**
 * Admin client using the Supabase service role key — bypasses Row Level
 * Security entirely. Only ever call this from a server-only context
 * (Route Handlers under src/app/api/parent/**) that has already verified
 * who is asking (via the signed parent session cookie, see
 * src/lib/parent-session.ts) and always scopes queries to that verified
 * student_id. Never import this into client code or any other server
 * code path.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
