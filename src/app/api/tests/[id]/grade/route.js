import { requireUser } from "@/lib/server/auth";
import { ApiError, json, route } from "@/lib/server/http";
import { ownedTest } from "@/lib/server/domain";
import { gradeRequested, inngest } from "@/lib/server/inngest/client";
export const POST = route(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  await ownedTest(id, user.id);
  // Inngest claims and fans out the sheets; the browser polls the test for
  // progress, exactly as before.
  try {
    await inngest.send(gradeRequested.create({ testId: id }));
  } catch (error) {
    console.error("Could not reach the grading queue:", error);
    throw new ApiError(503, "The grading queue is unreachable right now. Try again shortly.");
  }
  return json(
    {
      status: "grading",
    },
    202,
  );
});
