import crypto from "node:crypto";

/**
 * A small hand-rolled signed cookie for classroom-contact sessions —
 * deliberately not a full auth system, and deliberately NOT the same
 * cookie/secret as src/lib/parent-session.ts even though the shape is
 * identical. A classroom contact and a parent are two separate trust
 * boundaries with their own access code column, their own login route,
 * and their own write path; keeping the cookie name and signing secret
 * distinct means a leaked/forged token from one flow is meaningless in
 * the other. The payload (just a student_id + issued-at) is NOT secret,
 * only tamper-proof: a classroom contact can decode their own cookie and
 * see their own student_id, which they already know. What matters is
 * that they can't forge a cookie pointing at a *different* student_id
 * without the signing secret, which never leaves the server.
 */

export const CLASSROOM_CONTACT_COOKIE_NAME = "classroom_contact_session";
export const CLASSROOM_CONTACT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/** Which set of tables a classroom-contact session's student_id resolves
 *  against — "slp" means students/classroom_strategies/
 *  classroom_strategy_logs/classroom_strategy_praise, "teacher" means
 *  teacher_students/teacher_classroom_strategies/
 *  teacher_classroom_strategy_logs/teacher_classroom_strategy_praise. */
export type ClassroomContactStudentType = "slp" | "teacher";

function getSecret(): string {
  const secret = process.env.CLASSROOM_CONTACT_SESSION_SECRET;
  if (!secret) {
    throw new Error("CLASSROOM_CONTACT_SESSION_SECRET is not set.");
  }
  return secret;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function createClassroomContactSessionToken(
  studentId: string,
  studentType: ClassroomContactStudentType
): string {
  const payload = Buffer.from(
    JSON.stringify({ studentId, studentType, iat: Date.now() })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyClassroomContactSessionToken(
  token: string | undefined | null
): { studentId: string; studentType: ClassroomContactStudentType } | null {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;

  const expected = sign(payload);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof data.studentId !== "string" || !data.studentId) return null;
    const studentType: ClassroomContactStudentType =
      data.studentType === "teacher" ? "teacher" : "slp";
    return { studentId: data.studentId, studentType };
  } catch {
    return null;
  }
}
