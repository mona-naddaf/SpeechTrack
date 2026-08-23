import crypto from "node:crypto";

/**
 * A small hand-rolled signed cookie for parent sessions — deliberately
 * not a full auth system. The payload (just a student_id + issued-at) is
 * NOT secret, only tamper-proof: a parent can decode their own cookie and
 * see their own student_id, which they already know. What matters is that
 * they can't forge a cookie pointing at a *different* student_id without
 * the signing secret, which never leaves the server.
 */

export const PARENT_COOKIE_NAME = "parent_session";
export const PARENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function getSecret(): string {
  const secret = process.env.PARENT_SESSION_SECRET;
  if (!secret) {
    throw new Error("PARENT_SESSION_SECRET is not set.");
  }
  return secret;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function createParentSessionToken(studentId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ studentId, iat: Date.now() })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyParentSessionToken(
  token: string | undefined | null
): { studentId: string } | null {
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
    return { studentId: data.studentId };
  } catch {
    return null;
  }
}
