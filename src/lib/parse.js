/**
 * Roster parsing.
 *
 * Teachers paste lists, drop CSVs, or hand us a photo of a register. The first
 * two are parsed here; anything unstructured goes through the AI extractor in
 * `lib/ai.ts`. Either way the teacher lands on the same review table.
 */

const HEADER_HINTS =
  /^(name|student|student name|full name|roll|roll no|roll number|sr|sr no|s\.no|no|id)$/i;
function splitRow(line) {
  // Handles quoted CSV cells, plain CSV, and tab-separated pastes.
  if (line.includes("\t")) return line.split("\t").map((cell) => cell.trim());
  const cells = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}
function looksLikeHeader(cells) {
  return cells.some((cell) => HEADER_HINTS.test(cell));
}
function cleanName(value) {
  return value
    .replace(/^[\s\-–—•*.\d)]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parses pasted text or CSV/TSV content into students. Deliberately forgiving:
 * a bare list of names is the most common input and must just work.
 */
export function parseRoster(raw) {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const rows = lines.map(splitRow);
  const firstRow = rows[0];
  if (!firstRow) return [];
  const hasHeader = looksLikeHeader(firstRow);
  const header = hasHeader ? firstRow.map((cell) => cell.toLowerCase()) : null;
  const body = hasHeader ? rows.slice(1) : rows;
  const nameIndex = header ? header.findIndex((cell) => /name|student/.test(cell)) : -1;
  const rollIndex = header ? header.findIndex((cell) => /roll|^sr|s\.no|^no$|^id$/.test(cell)) : -1;
  const seen = new Set();
  const students = [];
  for (const cells of body) {
    let name = "";
    let rollNo;
    if (nameIndex >= 0) {
      name = cleanName(cells[nameIndex] ?? "");
      if (rollIndex >= 0) rollNo = (cells[rollIndex] ?? "").trim() || undefined;
    } else if (cells.length === 1) {
      name = cleanName(cells[0] ?? "");
    } else {
      // No header: assume the longest alphabetic cell is the name, and a short
      // numeric cell alongside it is the roll number.
      const alpha = cells.filter((cell) => /[a-z]/i.test(cell));
      name = cleanName(alpha.sort((a, b) => b.length - a.length)[0] ?? cells[0] ?? "");
      rollNo = cells.find((cell) => /^\d{1,4}$/.test(cell.trim()));
    }
    if (!name || name.length < 2) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    students.push({
      name,
      ...(rollNo
        ? {
            rollNo,
          }
        : {}),
    });
  }
  return students;
}
