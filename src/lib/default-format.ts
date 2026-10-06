/** Account-wide default response format.
 *
 *  Stored in Supabase Auth user_metadata (like full_name / has_seen_tour)
 *  rather than a table column: it's one value per account, it's already
 *  loaded with the user on both the server (auth.getUser()) and the
 *  client, and it needs no migration or RLS. The trade-off is no foreign
 *  key, so two rules stand in for one: deleting the default format clears
 *  it (formats list), and a stored id that isn't among her formats is
 *  treated as "no default" (resolveDefaultFormatId below).
 *
 *  It only ever pre-fills NEW items. Precedence when creating from a bank
 *  goal or template step: that item's own format, then this default, then
 *  none. */
export const DEFAULT_FORMAT_METADATA_KEY = "default_response_format_id";

export function resolveDefaultFormatId(
  user: { user_metadata?: Record<string, unknown> | null } | null | undefined,
  formats: { id: string }[]
): string | null {
  const raw = user?.user_metadata?.[DEFAULT_FORMAT_METADATA_KEY];
  if (typeof raw !== "string" || !raw) return null;
  return formats.some((f) => f.id === raw) ? raw : null;
}

/** Own format → account default → none. */
export function pickFormat(own: string | null | undefined, accountDefault: string | null): string | null {
  return own || accountDefault || null;
}
