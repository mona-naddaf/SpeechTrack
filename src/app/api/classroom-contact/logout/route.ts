import { NextResponse } from "next/server";
import { CLASSROOM_CONTACT_COOKIE_NAME } from "@/lib/classroom-contact-session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(CLASSROOM_CONTACT_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return response;
}
