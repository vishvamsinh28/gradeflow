/**
 * Answer sheets live in a private Supabase bucket.
 *
 * Prisma owns the database; this is the one thing it cannot do, so supabase-js
 * is here for storage and nothing else.
 */
import { createClient } from "@supabase/supabase-js";
import { env } from "./env";
import { ApiError } from "./http";
const BUCKET = "answer-sheets";
const MAX_BYTES = 25 * 1024 * 1024;
// One class at a time. Without these, a single request can fan out into
// thousands of model calls.
export const MAX_FILES = 120;
export const MAX_PDF_PAGES = 400;
// A register or question paper is a handful of pages. Anything longer is a
// mistake, and every page of it costs a model call's worth of input.
export const MAX_EXTRACT_PAGES = 20;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"]);
function bucket() {
  const client = createClient(env().SUPABASE_URL, env().SUPABASE_SECRET_KEY, {
    auth: {
      persistSession: false,
    },
  });
  return client.storage.from(BUCKET);
}
export async function uploadSheet(ownerId, testId, studentId, sheet) {
  const path = `${ownerId}/${testId}/${studentId}-${safeName(sheet.fileName)}`;
  const { error } = await bucket().upload(path, sheet.content, {
    contentType: sheet.mimeType,
    upsert: true,
  });
  if (error) throw new ApiError(502, `Could not store ${sheet.fileName}`);
  return path;
}
export async function downloadSheet(path) {
  const { data, error } = await bucket().download(path);
  if (error || !data) throw new ApiError(502, "Could not read the stored answer sheet");
  return new Uint8Array(await data.arrayBuffer());
}

/** Best-effort: a sheet left behind is untidy, a failed delete is not worth a 500. */
export async function deleteSheets(paths) {
  const cleaned = paths.filter((path) => Boolean(path));
  if (!cleaned.length) return;
  const { error } = await bucket().remove(cleaned);
  if (error) console.error("Could not remove answer sheets:", error.message);
}
function safeName(name) {
  const normalized = name.normalize("NFKD").replace(/[^\x20-\x7E]/g, "");
  const cleaned = normalized.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return (cleaned || "sheet").slice(0, 80);
}

/** Read one uploaded file, enforcing the size and type limits before anything else. */
export async function readUpload(file) {
  const name = file.name || "file";
  if (file.size === 0) throw new ApiError(400, `${name} is empty`);
  if (file.size > MAX_BYTES) throw new ApiError(413, `${name} is larger than 25MB`);
  const mime = (file.type || "").toLowerCase();
  if (!ALLOWED.has(mime)) {
    throw new ApiError(415, `${name} is a ${mime || "unknown"} file. Upload images or PDFs.`);
  }
  return {
    content: new Uint8Array(await file.arrayBuffer()),
    mime,
  };
}
