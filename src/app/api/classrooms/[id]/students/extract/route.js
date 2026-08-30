import { requireUser } from "@/lib/server/auth";
import { ApiError, json, route } from "@/lib/server/http";
import { ownedClassroom } from "@/lib/server/domain";
import { readRoster } from "@/lib/server/grader";
import { rateLimit } from "@/lib/server/rate-limit";
import { readExtractUpload } from "@/lib/server/uploads";

/**
 * Read a class register into a student list.
 *
 * Nothing is written here — the teacher reviews and edits the names before they
 * go anywhere, so extraction stays a read and insertion keeps going through the
 * students route.
 */
export const POST = route(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  await ownedClassroom(id, user.id);
  // Every call here is a model call billed to the account.
  await rateLimit(`extract:${user.id}`, {
    limit: 30,
    windowSeconds: 3600,
  });
  const { content, mime } = await readExtractUpload(request, "a register");
  try {
    return json({
      students: await readRoster(content, mime),
    });
  } catch (error) {
    throw new ApiError(
      502,
      `Could not read that register: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
});

// Reading a page is one long model call; keep Vercel from cutting it off.
export const maxDuration = 60;
