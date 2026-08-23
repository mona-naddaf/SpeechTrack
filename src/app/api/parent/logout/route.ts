import { NextResponse } from "next/server";
import { PARENT_COOKIE_NAME } from "@/lib/parent-session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(PARENT_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return response;
}
