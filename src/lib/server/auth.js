/**
 * Sessions.
 *
 * Same bcrypt hashes and same HS256 JWTs the FastAPI service issued, so every
 * existing account and every unexpired token keeps working across the move.
 */
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";
import { env, isProduction } from "./env";
import { ApiError } from "./http";
const COOKIE = "access_token";
const secret = () => new TextEncoder().encode(env().JWT_SECRET);
export async function hashPassword(password) {
  // bcrypt truncates at 72 bytes; max_length in characters would let a short
  // multi-byte password through and then throw.
  if (new TextEncoder().encode(password).length > 72) {
    throw new ApiError(422, "Password is too long — use fewer than 72 bytes of text");
  }
  return bcrypt.hash(password, 12);
}
export function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash).catch(() => false);
}
export async function createToken(userId, email) {
  return new SignJWT({
    email,
  })
    .setProtectedHeader({
      alg: "HS256",
    })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${env().SESSION_DAYS}d`)
    .sign(secret());
}
/** The signed-in teacher, or a 401. Every authenticated route starts here. */
export async function requireUser(request) {
  const token = await readToken(request);
  if (!token) throw new ApiError(401, "Authentication required");
  let sub;
  try {
    sub = (
      await jwtVerify(token, secret(), {
        algorithms: ["HS256"],
      })
    ).payload.sub;
  } catch {
    throw new ApiError(401, "Invalid or expired session");
  }
  if (!sub) throw new ApiError(401, "Invalid session payload");
  const user = await db.users.findUnique({
    where: {
      id: sub,
    },
    select: {
      id: true,
      email: true,
      full_name: true,
      created_at: true,
    },
  });
  if (!user) throw new ApiError(401, "User no longer exists");
  return user;
}

/**
 * The http-only cookie is the real session. The Bearer header is a fallback for
 * preview deployments, where a cross-site cookie cannot be read back.
 */
async function readToken(request) {
  const cookie = (await cookies()).get(COOKIE)?.value;
  if (cookie) return cookie;
  const header = request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) return header.slice(7);
  return null;
}
export async function setSessionCookie(token) {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: env().SESSION_DAYS * 24 * 60 * 60,
  });
}
export async function clearSessionCookie() {
  (await cookies()).delete(COOKIE);
}
