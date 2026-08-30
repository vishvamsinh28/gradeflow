/**
 * Every environment variable the server needs, read once and validated.
 *
 * A missing secret should fail loudly at the first request rather than surface
 * as a confusing 500 somewhere deeper.
 */
import { z } from "zod";
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  SESSION_DAYS: z.coerce.number().int().positive().default(7),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().default("gemini-3.1-flash-lite"),
  // Authenticates the grading sweeper (an external cron hitting
  // /api/queue/drain). Optional: without it the sweeper endpoint refuses and
  // grading is driven entirely by the browser.
  DRAIN_SECRET: z.string().optional(),
});
let cached = null;
export function env() {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Environment is not configured: ${missing}. See .env.example.`);
  }
  cached = parsed.data;
  return cached;
}

/** Cookies must be Secure to be sent cross-site, and production is always https. */
export const isProduction = process.env.NODE_ENV === "production";
