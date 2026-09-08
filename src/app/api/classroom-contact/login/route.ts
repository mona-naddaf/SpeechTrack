import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  createClassroomContactSessionToken,
  CLASSROOM_CONTACT_COOKIE_MAX_AGE,
  CLASSROOM_CONTACT_COOKIE_NAME,
} from "@/lib/classroom-contact-session";

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

  // A code is generated unique across both tables' classroom_contact_access_code
  // column (see generate_classroom_contact_access_code() in
  // 0036_classroom_contact_access.sql), so at most one of these two lookups
  // should ever match. This is a completely separate lookup from
  // /api/parent/login's parent_access_code check.
  const [slpResult, teacherResult] = await Promise.all([
    supabase
      .from("students")
      .select("id, name")
      .eq("classroom_contact_access_code", code)
      .maybeSingle(),
    supabase
      .from("teacher_students")
      .select("id, name")
      .eq("classroom_contact_access_code", code)
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

  const token = createClassroomContactSessionToken(match.id, match.studentType);
  const response = NextResponse.json({ studentName: match.name });
  response.cookies.set(CLASSROOM_CONTACT_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CLASSROOM_CONTACT_COOKIE_MAX_AGE,
  });
  return response;
}
