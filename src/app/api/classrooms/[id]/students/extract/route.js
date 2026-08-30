import { requireUser } from "@/lib/server/auth";
import { ApiError, json, route } from "@/lib/server/http";
import { ownedClassroom } from "@/lib/server/domain";
import { readRoster } from "@/lib/server/grader";
import { MAX_EXTRACT_PAGES, readUpload } from "@/lib/server/storage";
import { pdfPageCount } from "@/lib/server/sheets";
import { rateLimit } from "@/lib/server/rate-limit";

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
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(422, "Attach a file to read");
  const { content, mime } = await readUpload(file);
  // readUpload caps the bytes, but 25MB of PDF can still be hundreds of pages —
  // all of which would be sent to the model in one billed call.
  if (mime === "application/pdf") {
    const pages = await pdfPageCount(content);
    if (pages > MAX_EXTRACT_PAGES) {
      throw new ApiError(413, `That file has ${pages} pages. Upload at most ${MAX_EXTRACT_PAGES}.`);
    }
  }
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
