import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/service";
import {
  CLASSROOM_CONTACT_COOKIE_NAME,
  verifyClassroomContactSessionToken,
} from "@/lib/classroom-contact-session";

const VALID_HOW_IT_WENT = new Set(["great", "okay", "tricky"]);

// Which tables to write to, keyed by the classroom-contact session's
// studentType — keeps this route the single place that knows about both
// schemas. This route's only job is inserting one row into a *_logs
// table (plus touching last_used_date on the strategies it references) —
// it has no path to write classroom_strategies, goals, sessions, or
// anything else, no matter what a tampered request body contains.
const TABLES = {
  slp: { items: "classroom_strategies", logs: "classroom_strategy_logs" },
  teacher: {
    items: "teacher_classroom_strategies",
    logs: "teacher_classroom_strategy_logs",
  },
} as const;

type RequestBody = {
  activities?: unknown;
  howItWent?: unknown;
  note?: unknown;
  date?: unknown;
};

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = verifyClassroomContactSessionToken(
    cookieStore.get(CLASSROOM_CONTACT_COOKIE_NAME)?.value
  );
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (typeof body.howItWent !== "string" || !VALID_HOW_IT_WENT.has(body.howItWent)) {
    return NextResponse.json(
      { error: "Please choose how it went." },
      { status: 400 }
    );
  }
  const howItWent = body.howItWent;

  const activities = Array.isArray(body.activities)
    ? body.activities
        .filter(
          (a): a is { id: unknown; text: unknown } =>
            typeof a === "object" && a !== null
        )
        .map((a) => ({
          id: typeof a.id === "string" ? a.id : "",
          text: typeof a.text === "string" ? a.text : "",
        }))
        .filter((a) => a.id && a.text)
    : [];

  const note = typeof body.note === "string" ? body.note.trim() || null : null;
  const date =
    typeof body.date === "string" && body.date
      ? body.date
      : new Date().toISOString().slice(0, 10);

  const supabase = createServiceClient();
  const tables = TABLES[session.studentType];

  // student_id always comes from the verified cookie, never from the
  // request body — this is the one line that keeps a classroom contact
  // scoped to their own assigned student no matter what a tampered
  // request claims.
  const { data, error } = await supabase
    .from(tables.logs)
    .insert({
      student_id: session.studentId,
      date,
      activities,
      how_it_went: howItWent,
      note,
    })
    .select("id, date, activities, how_it_went, note, created_at")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Could not save. Please try again." },
      { status: 500 }
    );
  }

  if (activities.length > 0) {
    await supabase
      .from(tables.items)
      .update({ last_used_date: date })
      .eq("student_id", session.studentId)
      .in(
        "id",
        activities.map((a) => a.id)
      );
  }

  return NextResponse.json({ log: data });
}
