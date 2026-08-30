import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { body, json, route } from "@/lib/server/http";
import { ownedTest } from "@/lib/server/domain";
import { GRADE_BATCH, claimPendingSheets, gradeBatch } from "@/lib/server/grading";

const gradeSchema = z.object({
  // Name specific sheets to grade just those — one student, two, whatever.
  // Omit to grade everything pending on the test.
  submission_ids: z.array(z.string()).max(200).optional(),
});

/**
 * Grades one batch per call and says how much is left.
 *
 * No queue: the browser calls this in a loop until `remaining` hits zero, and
 * the sweeper cron drains anything left behind. Every step is a plain request
 * that either works or fails in plain sight.
 */
export const POST = route(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  await ownedTest(id, user.id);

  const input = request.headers.get("content-type")?.includes("json")
    ? await body(request, gradeSchema)
    : {};
  const scope = input.submission_ids;

  const pending = await claimPendingSheets(id, scope);
  const batch = pending.slice(0, GRADE_BATCH);
  await gradeBatch(batch);

  return json({
    graded: batch.length,
    remaining: pending.length - batch.length,
  });
});

// One batch is up to three model calls back to back.
export const maxDuration = 60;
