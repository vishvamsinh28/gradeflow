/**
 * Turning whatever the scanner produced into one sheet per student.
 *
 * The common case is not one file per student — it is the whole class in a
 * single multi-page PDF, which has to be split by reading the name off each
 * page.
 */
import { PDFDocument } from "pdf-lib";
import { ApiError } from "./http";

async function loadPdf(content) {
  try {
    return await PDFDocument.load(content, { ignoreEncryption: true });
  } catch {
    // A truncated download or a mislabeled file is the uploader's problem to
    // hear about, not a server error.
    throw new ApiError(422, "That PDF could not be read. Re-export or re-scan it and try again.");
  }
}
export async function pdfPageCount(content) {
  return (await loadPdf(content)).getPageCount();
}

/** Slice an inclusive, 1-based page range into a standalone PDF. */
export async function extractPdfPages(content, first, last) {
  const source = await loadPdf(content);
  const target = await PDFDocument.create();
  const total = source.getPageCount();
  const indices = [];
  for (let index = first - 1; index < Math.min(last, total); index += 1) indices.push(index);
  const pages = await target.copyPages(source, indices);
  pages.forEach((page) => target.addPage(page));
  return target.save();
}

/**
 * Turn a per-page list of detected names into contiguous per-student ranges.
 *
 * A page with no readable name continues the previous student, which is what a
 * multi-page answer booklet looks like: the name is on the front sheet only.
 * Returns 1-based inclusive ranges.
 */
export function groupPagesByStudent(names) {
  const groups = [];
  names.forEach((raw, index) => {
    const page = index + 1;
    const name = (raw || "").trim() || null;
    const previous = groups[groups.length - 1];
    if (previous && (name === null || name === previous.name)) {
      previous.last = page;
      previous.name = previous.name || name;
    } else {
      groups.push({
        first: page,
        last: page,
        name,
      });
    }
  });
  return groups;
}
/** Best-effort name → student. Exact match first, then first/surname overlap. */
export function matchNameToStudent(name, students) {
  if (!name) return null;
  const target = normalize(name);
  if (!target) return null;
  for (const student of students) {
    if (normalize(student.name) === target) return student.id;
  }
  const wanted = new Set(target.split(" ").filter(Boolean));
  let best = null;
  for (const student of students) {
    const parts = new Set(normalize(student.name).split(" ").filter(Boolean));
    let overlap = 0;
    wanted.forEach((part) => {
      if (parts.has(part)) overlap += 1;
    });
    if (overlap && (!best || overlap > best.overlap))
      best = {
        overlap,
        id: student.id,
      };
  }
  return best?.id ?? null;
}

/**
 * Match one uploaded file to a student by its name alone.
 *
 * Student code first, then every name part appearing in the filename, then a
 * roll number. Anything ambiguous returns null — see the note in the upload
 * route about why a wrong match is worse than no match.
 */
export function matchByFilename(fileName, students, taken) {
  const stem = normalize(fileName.replace(/\.[^.]+$/, ""));
  const free = students.filter((student) => !taken.has(student.id));
  for (const student of free) {
    if (student.code && stem.includes(normalize(student.code))) return student.id;
  }
  for (const student of free) {
    const parts = normalize(student.name)
      .split(" ")
      .filter((part) => part.length > 2);
    if (parts.length && parts.every((part) => stem.includes(part))) return student.id;
  }
  for (const value of stem.match(/\b\d{1,4}\b/g) ?? []) {
    for (const student of free) {
      if (student.roll_no && String(Number(value)) === student.roll_no.trim()) return student.id;
    }
  }
  return null;
}
function normalize(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
