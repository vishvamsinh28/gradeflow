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

/**
 * The <script> that hands the value to the browser.
 *
 * JSON.stringify escapes quotes but not `</script>`, so a value containing one
 * would close the tag and let whatever follows execute. Escaping `<` closes
 * that off — the value is operator-supplied, but "only an operator can set it"
 * is not a reason to emit unescaped markup.
 */
export function apiUrlScript(): string {
  const safe = JSON.stringify(resolveApiUrl()).replace(/</g, "\\u003c");
  return `window.${GLOBAL_KEY}=${safe}`;
}

/** Client-side: whatever the server injected, falling back to build-time config. */
export function apiUrl(): string {
  if (typeof window !== "undefined" && typeof window[GLOBAL_KEY] === "string") {
    return window[GLOBAL_KEY];
  }
  return (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
}
