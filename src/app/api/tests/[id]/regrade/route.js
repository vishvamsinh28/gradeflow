import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { ApiError, body, json, route } from "@/lib/server/http";
import { ownedTest } from "@/lib/server/domain";
import { gradeRequested, inngest } from "@/lib/server/inngest/client";
import { claimPendingSheets, gradeOne } from "@/lib/server/grading";
import { regradeSchema } from "@/lib/server/schemas";

/**
 * Re-mark a whole test with a correction.
 *
 * When the model was systematically wrong — too harsh about units, say — the
 * teacher writes one sentence rather than overriding thirty marks by hand. The
 * correction is appended to the test's guidance so it also applies to any
 * sheets uploaded later.
 */
export const POST = route(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  const { test } = await ownedTest(id, user.id);
  const input = await body(request, regradeSchema);
  const targets = await db.test_submissions.findMany({
    where: {
      test_id: id,
      status: "graded",
      ...(input.only_flagged
        ? {
            needs_review: true,
          }
        : {}),
    },
    select: {
      id: true,
    },
  });
  if (!targets.length) throw new ApiError(400, "There is nothing graded to re-mark yet");
  const correction = input.correction.trim();
  const guidance = [(test.instructions || "").trim(), correction].filter(Boolean).join("\n");
  await db.$transaction([
    db.tests.update({
      where: {
        id,
      },
      data: {
        instructions: guidance,
        status: "grading",
        updated_at: new Date(),
      },
    }),
    // A teacher's own override is their decision, so re-marking clears it too —
    // they asked for the whole test to be marked again.
    db.test_submissions.updateMany({
      where: {
        id: {
          in: targets.map((row) => row.id),
        },
      },
      data: {
        status: "queued",
        overridden: false,
        updated_at: new Date(),
      },
    }),
  ]);
  // Small re-marks run right here; only real batches go to the queue — which
  // fails silently when configured-but-unsynced, so it is never trusted with
  // work this request could do itself.
  if (targets.length <= 3) {
    const jobs = await claimPendingSheets(id);
    for (const job of jobs) {
      try {
        await gradeOne({ ...job, correction });
      } catch (inlineError) {
        console.error("Inline re-mark failed for", job.submissionId, inlineError);
      }
    }
  } else {
    try {
      await inngest.send(gradeRequested.create({ testId: id, correction }));
    } catch (error) {
      console.error("Could not reach the grading queue:", error);
      throw new ApiError(
        503,
        `${targets.length} sheets need the grading queue, which is unreachable. ` +
          "Locally, run `npx inngest-cli dev`; in production, sync the Inngest app.",
      );
    }
  }
  return json(
    {
      status: "grading",
      count: targets.length,
    },
    202,
  );
});

// Inline re-marking is up to three model calls back to back.
export const maxDuration = 60;
