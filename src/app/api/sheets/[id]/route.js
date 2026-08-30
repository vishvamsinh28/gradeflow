import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { ApiError, body, json, noContent, route } from "@/lib/server/http";
import { ownedSubmission, submissionPayload } from "@/lib/server/domain";
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
  }
  if (input.accept) data.needs_review = false;
  return json(
    submissionPayload(
      await db.test_submissions.update({
        where: {
          id,
        },
        data,
      }),
    ),
  );
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
  return noContent();
});
