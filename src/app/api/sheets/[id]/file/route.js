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
  return new Response(content, {
    headers: {
      "Content-Type": submission.mime_type || "application/octet-stream",
      "Content-Disposition": `inline; filename="${submission.file_name || "sheet"}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
});
