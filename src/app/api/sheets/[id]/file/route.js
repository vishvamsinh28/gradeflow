import { requireUser } from "@/lib/server/auth";
import { ApiError, route } from "@/lib/server/http";
import { ownedSubmission } from "@/lib/server/domain";
import { downloadSheet } from "@/lib/server/storage";

/** Serve the answer sheet so a teacher can check a mark against the paper. */
export const GET = route(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  const { submission } = await ownedSubmission(id, user.id);
  if (!submission.storage_path) {
    throw new ApiError(404, "No answer sheet was stored for this student");
  }
  const content = await downloadSheet(submission.storage_path);
  // The stored name is whatever the browser sent at upload time; quotes or
  // control characters in a header value are how header injection starts.
  const safeName = (submission.file_name || "sheet").replace(/[^\x20-\x7e]|["\\]/g, "_");
  return new Response(content, {
    headers: {
      "Content-Type": submission.mime_type || "application/octet-stream",
      "Content-Disposition": `inline; filename="${safeName}"`,
      // Cached so re-opening a sheet during review is instant, but keyed on the
      // cookie: after a sign-out the next account must not be served this copy.
      "Cache-Control": "private, max-age=300",
      Vary: "Cookie",
    },
  });
});
