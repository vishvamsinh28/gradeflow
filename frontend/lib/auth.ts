"use client";

import { apiUrl } from "./runtime-config";

/**
 * Accounts.
 *
 * Backed entirely by the API. There is no local fallback: classrooms, marks and
 * answer sheets live on the server, so an account without a server would be an
 * account that cannot do anything.
 */



export type User = {
  id: string;
  email: string;
  fullName: string;
};

export class AuthError extends Error {}

const TOKEN_KEY = "gradeflow.token";

export function apiConfigured(): boolean {
  return Boolean(apiUrl());
}

/* ---------- validation ---------- */

export function validateEmail(value: string): string | null {
  if (!value.trim()) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return "That does not look like an email";
  return null;
}

export function validatePassword(value: string): string | null {
  if (!value) return "Password is required";
  if (value.length < 8) return "Use at least 8 characters";
  if (new TextEncoder().encode(value).length > 72) return "That password is too long";
  return null;
}

export function validateName(value: string): string | null {
  if (value.trim().length < 2) return "Enter your name";
  return null;
}

/* ---------- session ---------- */

/**
 * The http-only cookie is the real session. This mirror exists because a
 * cross-origin cookie cannot be read back, and it lives in localStorage rather
 * than sessionStorage so closing the tab does not sign anyone out.
 */
function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage can be blocked; the cookie still carries the session.
  }
}

export function authHeaders(): Record<string, string> {
  const token = readToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!apiUrl()) {
    throw new AuthError(
      "No API is configured. Set API_URL so accounts and marks can be saved.",
    );
  }

  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  for (const [key, value] of Object.entries(authHeaders())) headers.set(key, value);

  let response: Response;
  try {
    response = await fetch(`${apiUrl()}${path}`, {
      ...init,
      headers,
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    throw new AuthError("Cannot reach the GradeFlow server. Check that it is running.");
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new AuthError(body?.detail ?? "Something went wrong. Please try again.");
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

type ApiUser = { id: string; email: string; full_name: string };

const toUser = (user: ApiUser): User => ({
  id: user.id,
  email: user.email,
  fullName: user.full_name,
});

export async function signUp(input: {
  fullName: string;
  email: string;
  password: string;
}): Promise<User> {
  const result = await call<{ user: ApiUser; access_token: string }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: input.email.trim().toLowerCase(),
      full_name: input.fullName.trim(),
      password: input.password,
    }),
  });
  writeToken(result.access_token);
  return toUser(result.user);
}

export async function signIn(input: { email: string; password: string }): Promise<User> {
  const result = await call<{ user: ApiUser; access_token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: input.email.trim().toLowerCase(), password: input.password }),
  });
  writeToken(result.access_token);
  return toUser(result.user);
}

export async function signOut(): Promise<void> {
  await call<void>("/auth/logout", { method: "POST" }).catch(() => {
    // Signing out locally matters more than the server round trip.
  });
  writeToken(null);
}

export async function currentUser(): Promise<User | null> {
  if (!apiUrl()) return null;
  try {
    return toUser(await call<ApiUser>("/auth/me"));
  } catch {
    return null;
  }
}
