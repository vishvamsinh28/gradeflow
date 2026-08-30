import { requireUser } from "@/lib/server/auth";
import { ApiError, json, route } from "@/lib/server/http";
import { ownedTest } from "@/lib/server/domain";
import { claimPendingSheets, gradeOne } from "@/lib/server/grading";
import { gradeRequested, inngest } from "@/lib/server/inngest/client";

/**
 * A few sheets are graded right here, in this request. The queue only exists
 * for batches too big for one invocation — and crucially, a queue that accepts
 * events but never runs them (keys set, app not synced; dev server not
 * running) fails silently, so small batches must never depend on it.
 */
const INLINE_LIMIT = 3;

export const POST = route(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  await ownedTest(id, user.id);

  const jobs = await claimPendingSheets(id);
  if (jobs.length === 0) return json({ status: "grading" }, 202);

  if (jobs.length <= INLINE_LIMIT) {
    for (const job of jobs) {
      try {
        await gradeOne(job);
      } catch (error) {
        console.error("Inline grading failed for", job.submissionId, error);
      }
    }
    return json({ status: "grading" }, 202);
  }

  try {
    // Claimed rows are `queued`; the queue's own claim picks them up.
    await inngest.send(gradeRequested.create({ testId: id }));
  } catch (error) {
    console.error("Could not reach the grading queue:", error);
    throw new ApiError(
      503,
      `${jobs.length} sheets need the grading queue, which is unreachable. ` +
        "Locally, run `npx inngest-cli dev`; in production, sync the Inngest app.",
    );
  }
  return json({ status: "grading" }, 202);
});

// Inline grading is up to three model calls back to back.
export const maxDuration = 60;
