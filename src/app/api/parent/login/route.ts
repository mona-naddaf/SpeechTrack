import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  createParentSessionToken,
  PARENT_COOKIE_MAX_AGE,
  PARENT_COOKIE_NAME,
} from "@/lib/parent-session";

export async function POST(request: Request) {
  let body: { code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const code =
    typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!code) {
    return NextResponse.json(
      { error: "Please enter the access code." },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  const { data: student, error } = await supabase
    .from("students")
    .select("id, name")
    .eq("parent_access_code", code)
    .maybeSingle();

  if (error || !student) {
    return NextResponse.json(
      { error: "That code wasn't found. Please check it and try again." },
      { status: 401 }
    );
  }

  const token = createParentSessionToken(student.id);
  const response = NextResponse.json({ studentName: student.name });
  response.cookies.set(PARENT_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PARENT_COOKIE_MAX_AGE,
  });
  return response;
}
