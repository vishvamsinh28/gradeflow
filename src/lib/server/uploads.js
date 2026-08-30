/**
 * The one way a file headed for the model enters a route.
 *
 * Three endpoints accept a photographed page and hand it to Gemini; every one
 * of them must apply the same guards — a real file, the size and type limits,
 * and the page cap that keeps a 400-page PDF from becoming one giant billed
 * call. Centralised so a fourth endpoint cannot quietly skip a guard.
 */
import { ApiError } from "./http";
import { pdfPageCount } from "./sheets";
import { MAX_EXTRACT_PAGES, readUpload } from "./storage";

export async function readExtractUpload(request, what = "a file") {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(422, `Attach ${what} to read`);

  const { content, mime } = await readUpload(file);
  if (mime === "application/pdf") {
    const pages = await pdfPageCount(content);
    if (pages > MAX_EXTRACT_PAGES) {
      throw new ApiError(413, `That file has ${pages} pages. Upload at most ${MAX_EXTRACT_PAGES}.`);
    }
  }
  return { content, mime };
}
