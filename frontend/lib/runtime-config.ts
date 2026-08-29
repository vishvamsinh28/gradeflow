/**
 * Where the API lives.
 *
 * Read at runtime, not baked into the bundle. Next.js only inlines env vars
 * prefixed `NEXT_PUBLIC_`, and anything inlined is fixed at build time — change
 * it and you need a rebuild, not a restart. So the server reads `API_URL` and
 * hands it to the page, and the browser picks it up from there.
 */

const GLOBAL_KEY = "__GRADEFLOW_API_URL__";

declare global {
  interface Window {
    __GRADEFLOW_API_URL__?: string;
  }
}

/** Server-side: the configured value. `NEXT_PUBLIC_API_URL` still works. */
export function resolveApiUrl(): string {
  return (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
}

/** The <script> that hands the value to the browser. */
export function apiUrlScript(): string {
  return `window.${GLOBAL_KEY}=${JSON.stringify(resolveApiUrl())}`;
}

/** Client-side: whatever the server injected, falling back to build-time config. */
export function apiUrl(): string {
  if (typeof window !== "undefined" && typeof window[GLOBAL_KEY] === "string") {
    return window[GLOBAL_KEY];
  }
  return (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
}
