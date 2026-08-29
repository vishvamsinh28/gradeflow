"use client";

/**
 * Accounts.
 *
 * Two backends behind one interface:
 *
 *   api    NEXT_PUBLIC_API_URL is set — real accounts against the FastAPI
 *          service (bcrypt + JWT in an http-only cookie, Bearer fallback).
 *   local  no API configured — accounts live in this browser so the product
 *          is usable end to end without a server. Passwords are PBKDF2-hashed
 *          rather than stored, but this is NOT a security boundary: anything
 *          in the browser is reachable from the browser. It exists so the app
 *          can be run and demonstrated, not to protect data.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export const AUTH_MODE: "api" | "local" = API_URL ? "api" : "local";

export type User = {
  id: string;
  email: string;
  fullName: string;
};

export class AuthError extends Error {}

const TOKEN_KEY = "gradeflow.token";
const ACCOUNTS_KEY = "gradeflow.accounts.v1";
const SESSION_KEY = "gradeflow.session.v1";

/* ---------- Shared validation ---------- */

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

/* ---------- API mode ---------- */

/**
 * The http-only cookie is the primary session. This mirror exists because a
 * cookie cannot be read back when the API is on another origin and the browser
 * declines to send it — keeping it in localStorage rather than sessionStorage
 * is what makes a session survive closing the tab. It is the same XSS exposure
 * either way; only the lifetime differs.
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
    // Clear the older per-tab location so a stale token cannot shadow this one.
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage can be blocked; the http-only cookie still carries the session.
  }
}

async function apiCall<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  const token = readToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    // A refused connection is the common case in development; say so plainly
    // instead of blaming the credentials.
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

function fromApi(user: ApiUser): User {
  return { id: user.id, email: user.email, fullName: user.full_name };
}

/* ---------- Local mode ---------- */

type LocalAccount = {
  id: string;
  email: string;
  fullName: string;
  salt: string;
  hash: string;
};

function readAccounts(): LocalAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    return raw ? (JSON.parse(raw) as LocalAccount[]) : [];
  } catch {
    return [];
  }
}

function writeAccounts(accounts: LocalAccount[]) {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    throw new AuthError("This browser is not allowing local storage, so accounts cannot be saved.");
  }
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function derive(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: encoder.encode(salt), iterations: 120_000, hash: "SHA-256" },
    key,
    256,
  );
  return toHex(bits);
}

function randomHex(bytes: number): string {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)).buffer);
}

function readLocalSession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function writeLocalSession(id: string | null) {
  try {
    if (id) localStorage.setItem(SESSION_KEY, id);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Nothing to do; the session simply will not survive a reload.
  }
}

/* ---------- Public interface ---------- */

export async function signUp(input: {
  fullName: string;
  email: string;
  password: string;
}): Promise<User> {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();

  if (AUTH_MODE === "api") {
    const result = await apiCall<{ user: ApiUser; access_token: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, full_name: fullName, password: input.password }),
    });
    writeToken(result.access_token);
    return fromApi(result.user);
  }

  const accounts = readAccounts();
  if (accounts.some((account) => account.email === email)) {
    throw new AuthError("An account with this email already exists");
  }
  const salt = randomHex(16);
  const account: LocalAccount = {
    id: `usr_${randomHex(8)}`,
    email,
    fullName,
    salt,
    hash: await derive(input.password, salt),
  };
  writeAccounts([...accounts, account]);
  writeLocalSession(account.id);
  return { id: account.id, email: account.email, fullName: account.fullName };
}

export async function signIn(input: { email: string; password: string }): Promise<User> {
  const email = input.email.trim().toLowerCase();

  if (AUTH_MODE === "api") {
    const result = await apiCall<{ user: ApiUser; access_token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password: input.password }),
    });
    writeToken(result.access_token);
    return fromApi(result.user);
  }

  const account = readAccounts().find((item) => item.email === email);
  const hash = account ? await derive(input.password, account.salt) : null;
  if (!account || hash !== account.hash) {
    throw new AuthError("Incorrect email or password");
  }
  writeLocalSession(account.id);
  return { id: account.id, email: account.email, fullName: account.fullName };
}

export async function signOut(): Promise<void> {
  if (AUTH_MODE === "api") {
    await apiCall<void>("/auth/logout", { method: "POST" }).catch(() => {
      // Signing out locally matters more than the server round trip.
    });
    writeToken(null);
    return;
  }
  writeLocalSession(null);
}

export async function currentUser(): Promise<User | null> {
  if (AUTH_MODE === "api") {
    try {
      return fromApi(await apiCall<ApiUser>("/auth/me"));
    } catch {
      return null;
    }
  }

  const id = readLocalSession();
  if (!id) return null;
  const account = readAccounts().find((item) => item.id === id);
  if (!account) return null;
  return { id: account.id, email: account.email, fullName: account.fullName };
}
