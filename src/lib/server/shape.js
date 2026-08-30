/**
 * Turning database rows into the shapes the browser sees.
 *
 * Pure on purpose: nothing here opens a connection, so these are the parts that
 * can be tested without a database and reasoned about without one either.
 */

// Columns the browser has no use for. `storage_path` in particular describes
// the private bucket's layout and embeds the owner's id — the client fetches
// sheets through /api/sheets/{id}/file, never by path.
export const SUBMISSION_PRIVATE = ["storage_path"];
export function submissionPayload(row) {
  const { storage_path: _omitted, ...rest } = row;
  return {
    ...rest,
    score: num(rest.score),
    out_of: num(rest.out_of),
  };
}

/** Prisma returns numerics as Decimal; the client expects plain numbers. */
const num = (value) => (value === null ? null : Number(value));
export function questionPayload(question) {
  return { ...question, marks: Number(question.marks) };
}

export function testPayload(test) {
  return {
    ...test,
    max_marks: Number(test.max_marks),
    // The client treats test_date as a plain calendar day, not an instant.
    test_date: test.test_date.toISOString().slice(0, 10),
  };
}

/** Map a percentage onto the classroom's own bands, if it defined any. */
export function gradeFor(percent, scale) {
  if (percent === null || !Array.isArray(scale) || !scale.length) return null;
  for (const band of scale) {
    const min = Number(band?.min);
    if (!Number.isFinite(min)) continue;
    if (percent >= min) return String(band.label);
  }
  return null;
}
export function slugify(value) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "classroom"
  );
}

/** Student codes continue from the highest already issued, never reusing one. */
export function nextStudentCodes(existing, count) {
  let highest = 0;
  for (const student of existing) {
    const match = /(\d+)$/.exec(student.code || "");
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return Array.from(
    {
      length: count,
    },
    (_, index) => `STU-${String(highest + index + 1).padStart(3, "0")}`,
  );
}
