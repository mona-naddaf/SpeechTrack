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

  // A code is generated unique across both tables (see
  // generate_parent_access_code() in 0010_teacher_home_practice_and_parent_access.sql),
  // so at most one of these two lookups should ever match.
  const [slpResult, teacherResult] = await Promise.all([
    supabase
      .from("students")
      .select("id, name")
      .eq("parent_access_code", code)
      .maybeSingle(),
    supabase
      .from("teacher_students")
      .select("id, name")
      .eq("parent_access_code", code)
      .maybeSingle(),
  ]);

  const match = slpResult.data
    ? { ...slpResult.data, studentType: "slp" as const }
    : teacherResult.data
      ? { ...teacherResult.data, studentType: "teacher" as const }
      : null;

  if (!match) {
    return NextResponse.json(
      { error: "That code wasn't found. Please check it and try again." },
      { status: 401 }
    );
  }

  const token = createParentSessionToken(match.id, match.studentType);
  const response = NextResponse.json({ studentName: match.name });
  response.cookies.set(PARENT_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PARENT_COOKIE_MAX_AGE,
  });
  return response;
}
