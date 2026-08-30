import { requireUser } from "@/lib/server/auth";
import { ApiError, json, route } from "@/lib/server/http";
import { ownedTest } from "@/lib/server/domain";
import { readQuestionPaper } from "@/lib/server/grader";
import { rateLimit } from "@/lib/server/rate-limit";
import { MAX_EXTRACT_PAGES, readUpload } from "@/lib/server/storage";
import { pdfPageCount } from "@/lib/server/sheets";

/**
 * Read a photographed or scanned question paper into a list of questions.
 *
 * Nothing is written here — the teacher reviews and edits before saving, so
 * extraction stays a read and the paper is stored through PUT /questions.
 */
export const POST = route(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  await ownedTest(id, user.id);
  // Every call here is a model call billed to the account.
  await rateLimit(`extract:${user.id}`, { limit: 30, windowSeconds: 3600 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(422, "Attach a question paper to read");

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
    return json({ questions: await readQuestionPaper(content, mime) });
  } catch (error) {
    throw new ApiError(
      502,
      `Could not read that question paper: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
});
