import { requireUser } from "@/lib/server/auth";
import { ApiError, json, route } from "@/lib/server/http";
import { ownedClassroom } from "@/lib/server/domain";
import { readQuestionPaper } from "@/lib/server/grader";
import { rateLimit } from "@/lib/server/rate-limit";
import { readExtractUpload } from "@/lib/server/uploads";

/**
 * Read a question paper before the test exists.
 *
 * The create-test dialog offers the paper up front, so extraction here is
 * scoped to the classroom rather than to a test id that has not been issued
 * yet. Nothing is written — the teacher reviews the questions in the dialog
 * and they are stored with the test they came in with.
 */
export const POST = route(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  await ownedClassroom(id, user.id);
  // Every call here is a model call billed to the account.
  await rateLimit(`extract:${user.id}`, { limit: 30, windowSeconds: 3600 });

  const { content, mime } = await readExtractUpload(request, "a question paper");
  try {
    return json({ questions: await readQuestionPaper(content, mime) });
  } catch (error) {
    throw new ApiError(
      502,
      `Could not read that question paper: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
});

// Reading a paper is one long model call; keep Vercel from cutting it off.
export const maxDuration = 60;
