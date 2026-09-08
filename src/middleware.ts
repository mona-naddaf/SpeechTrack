import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - common static asset extensions
     * - parent / api/parent (a completely separate, non-Supabase-auth
     *   trust boundary — see src/lib/parent-session.ts — that this
     *   middleware has no business touching)
     * - classroom / api/classroom-contact (same idea, for the classroom
     *   contact's own separate trust boundary — see
     *   src/lib/classroom-contact-session.ts)
     */
    "/((?!_next/static|_next/image|favicon.ico|parent|api/parent|classroom|api/classroom-contact|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
