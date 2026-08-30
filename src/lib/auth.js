"use client";

/**
 * Accounts.
 *
 * The API is this same app, so the session is just the http-only cookie the
 * server sets — nothing to mirror into localStorage, and nothing readable by
 * script.
 */
export class AuthError extends Error {}

/* ---------- validation ---------- */

export function validateEmail(value) {
  if (!value.trim()) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return "That does not look like an email";
  return null;
}
export function validatePassword(value) {
  if (!value) return "Password is required";
  if (value.length < 8) return "Use at least 8 characters";
  if (new TextEncoder().encode(value).length > 72) return "That password is too long";
  return null;
}
export function validateName(value) {
  if (value.trim().length < 2) return "Enter your name";
  return null;
}
async function call(path, init = {}) {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  let response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch {
    throw new AuthError("Cannot reach GradeFlow. Check your connection.");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new AuthError(body?.detail ?? "Something went wrong. Please try again.");
  }
  if (response.status === 204) return undefined;
  return await response.json();
}
const toUser = (user) => ({
  id: user.id,
  email: user.email,
  fullName: user.full_name,
});
export async function signUp(input) {
  const result = await call("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: input.email.trim().toLowerCase(),
      full_name: input.fullName.trim(),
      password: input.password,
    }),
  });
  return toUser(result.user);
}
export async function signIn(input) {
  const result = await call("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: input.email.trim().toLowerCase(),
      password: input.password,
    }),
  });
  return toUser(result.user);
}
export async function signOut() {
  await call("/auth/logout", {
    method: "POST",
  }).catch(() => {
    // The cookie is cleared server-side; a failed round trip should not trap
    // someone in a session they asked to leave.
  });
}
export async function currentUser() {
  try {
    return toUser(await call("/auth/me"));
  } catch {
    return null;
  }
}
