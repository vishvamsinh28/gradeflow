import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { ApiError, body, json, noContent, route } from "@/lib/server/http";
import { ownedSubmission, submissionPayload } from "@/lib/server/domain";
import { settleTest } from "@/lib/server/grading";
import { reviewSchema } from "@/lib/server/schemas";
import { deleteSheets } from "@/lib/server/storage";
export const PATCH = route(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  const { submission, test } = await ownedSubmission(id, user.id);
  const input = await body(request, reviewSchema);
  const data = {
    updated_at: new Date(),
  };
  if (input.score != null) {
    const ceiling = Number(submission.out_of ?? test.max_marks);
    if (input.score > ceiling) {
      throw new ApiError(400, `That is more than the paper's ${ceiling} marks`);
    }
    data.score = input.score;
    data.overridden = true;
    data.needs_review = false;
    // Hand-marking a failed or unread sheet completes it. Leaving it non-graded
    // would let the next grading pass silently overwrite the teacher's number,
    // and would hold the whole test out of "graded" forever.
    if (submission.status !== "graded") {
      data.status = "graded";
      data.out_of = submission.out_of ?? test.max_marks;
      data.error_message = null;
      data.graded_at = new Date();
    }
  }
  if (input.accept) data.needs_review = false;
  const updated = await db.test_submissions.update({
    where: {
      id,
    },
    data,
  });
  if (data.status === "graded") await settleTest(updated.test_id);
  return json(submissionPayload(updated));
});
export const DELETE = route(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  const { submission } = await ownedSubmission(id, user.id);
  await db.test_submissions.delete({
    where: {
      id,
    },
  });
  await deleteSheets([submission.storage_path]);
  // A graded test that just lost a sheet is no longer graded.
  await settleTest(submission.test_id);
  return noContent();
});
