import { after } from "next/server";
import { json } from "@/lib/server/http";
import { env } from "@/lib/server/env";
import { GRADE_BATCH, claimGlobalPending, gradeBatch } from "@/lib/server/grading";

/**
 * The sweeper. An external cron (cron-job.org) calls this every few minutes so
 * sheets uploaded and left behind — tab closed mid-batch, teacher walked away —
 * still get graded. The browser remains the fast path; this is the safety net.
 *
 * It answers immediately and grades after the response: the cron service times
 * requests out at 30 seconds, and a batch of model calls takes longer than
 * that. `after()` keeps the invocation alive to finish the work.
 */
export async function POST(request) {
  const secret = env().DRAIN_SECRET;
  if (!secret) {
    return json({ detail: "Sweeper not configured — set DRAIN_SECRET." }, 503);
  }
  if (request.headers.get("x-drain-secret") !== secret) {
    return json({ detail: "Wrong or missing X-Drain-Secret header." }, 401);
  }

  const jobs = await claimGlobalPending(GRADE_BATCH);
  if (jobs.length) after(() => gradeBatch(jobs));
  return json({ claimed: jobs.length }, 202);
}

export const maxDuration = 60;
