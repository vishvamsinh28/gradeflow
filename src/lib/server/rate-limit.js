/**
 * Rate limiting for the endpoints worth guessing at.
 *
 * Backed by Postgres rather than memory: on serverless every invocation is a
 * fresh process, so an in-memory counter would reset constantly and protect
 * nothing.
 *
 * Fixed windows, not a sliding log — a burst on a window boundary can reach
 * double the limit, which is an acceptable trade for one indexed upsert per
 * attempt.
 *
 * Rows are disposable. Expired windows are swept opportunistically rather than
 * on a schedule, because nothing else in this app runs on a timer and a table
 * that only ever grows is its own kind of bug.
 */
import { db } from "./db";
import { ApiError } from "./http";
export async function rateLimit(key, { limit, windowSeconds }) {
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000);
  const [row] = await db.$queryRaw`
    insert into rate_limits (key, window_start, hits)
    values (${key}, ${windowStart}, 1)
    on conflict (key, window_start) do update set hits = rate_limits.hits + 1
    returning hits
  `;
  if (row && row.hits > limit) {
    const retryAfter = Math.ceil((windowStart.getTime() + windowSeconds * 1000 - now) / 1000);
    throw new ApiError(429, `Too many attempts. Try again in ${retryAfter} seconds.`);
  }

  await sweep();
}

// Roughly one attempt in fifty clears out windows nobody can be inside any
// more. Failing here must never fail the request it rode in on.
const SWEEP_ODDS = 0.02;
const KEEP_SECONDS = 24 * 60 * 60;

async function sweep() {
  if (Math.random() > SWEEP_ODDS) return;
  const cutoff = new Date(Date.now() - KEEP_SECONDS * 1000);
  try {
    await db.rate_limits.deleteMany({ where: { window_start: { lt: cutoff } } });
  } catch (error) {
    console.error("Could not sweep expired rate-limit windows:", error);
  }
}

/**
 * Who to count against.
 *
 * The proxy's forwarded address, falling back to a constant so a missing header
 * degrades into one shared bucket rather than into no limit at all.
 */
export function clientKey(request, scope) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `${scope}:${forwarded || request.headers.get("x-real-ip") || "unknown"}`;
}
