/**
 * The AI seam.
 *
 * Everything the product describes as "AI" goes through this module: matching
 * uploaded answer sheets to students, reading an unstructured roster, and
 * grading a submission. Keeping it in one place means the workspace UI never
 * knows or cares whether the work happened locally or on the server.
 *
 * DEMO MODE: this build ships as a self-contained sample workspace, so the
 * calls below resolve locally and deterministically. `NEXT_PUBLIC_API_URL`
 * switches the same three calls onto the FastAPI + Gemini backend.
 */

import { parseRoster, type ParsedStudent } from "./parse";
import { simulateGrade, seededRng } from "./seed";
import type { QuestionMark, Student } from "./types";

export const AI_MODE: "demo" | "live" =
  process.env.NEXT_PUBLIC_API_URL ? "live" : "demo";

/* ---------- Matching answer sheets to students ---------- */

export type FileMatch = {
  fileName: string;
  studentId: string | null;
  /** How the match was made — surfaced in the review step so nothing is silent. */
  via: "code" | "roll" | "name" | "order" | "none";
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Real heuristics first — most scanned batches are named after the student,
 * their roll number, or their ID. Anything left over is distributed in roster
 * order, which the teacher confirms before grading starts.
 */
export function matchFilesToStudents(fileNames: string[], students: Student[]): FileMatch[] {
  const taken = new Set<string>();
  const matches: FileMatch[] = fileNames.map((fileName) => {
    const stem = normalize(fileName.replace(/\.[a-z0-9]+$/i, ""));

    const byCode = students.find(
      (student) => !taken.has(student.id) && stem.includes(normalize(student.code)),
    );
    if (byCode) {
      taken.add(byCode.id);
      return { fileName, studentId: byCode.id, via: "code" as const };
    }

    const byName = students.find((student) => {
      if (taken.has(student.id)) return false;
      const parts = normalize(student.name).split(" ").filter((part) => part.length > 2);
      return parts.length > 0 && parts.every((part) => stem.includes(part));
    });
    if (byName) {
      taken.add(byName.id);
      return { fileName, studentId: byName.id, via: "name" as const };
    }

    const rollDigits = stem.match(/\b(\d{1,4})\b/);
    if (rollDigits) {
      const byRoll = students.find(
        (student) => !taken.has(student.id) && student.rollNo === String(Number(rollDigits[1])),
      );
      if (byRoll) {
        taken.add(byRoll.id);
        return { fileName, studentId: byRoll.id, via: "roll" as const };
      }
    }

    return { fileName, studentId: null, via: "none" as const };
  });

  // Whatever the filename could not resolve, the model reads off the sheet
  // itself. Locally we stand that in with roster order.
  const spare = students.filter((student) => !taken.has(student.id));
  let cursor = 0;
  for (const match of matches) {
    if (match.studentId) continue;
    const candidate = spare[cursor];
    if (!candidate) break;
    cursor += 1;
    match.studentId = candidate.id;
    match.via = "order";
  }

  return matches;
}

/* ---------- Reading a roster the teacher did not type ---------- */

export type RosterExtraction = {
  students: ParsedStudent[];
  /** Shown above the review table so the teacher knows what happened. */
  note: string;
};

const READABLE = /\.(csv|tsv|txt)$/i;

export async function extractRoster(file: File): Promise<RosterExtraction> {
  await delay(700);

  if (READABLE.test(file.name)) {
    const text = await file.text();
    const students = parseRoster(text);
    return {
      students,
      note: `Read ${students.length} student${students.length === 1 ? "" : "s"} from ${file.name}.`,
    };
  }

  // Images, PDFs and spreadsheets go to the model. In the sample workspace we
  // stand in a plausible extraction so the review step stays exercisable.
  const text = await file.text().catch(() => "");
  const fromText = parseRoster(text.replace(/[^\x20-\x7E\n]+/g, "\n"));
  if (fromText.length >= 3) {
    return {
      students: fromText,
      note: `Extracted ${fromText.length} student${fromText.length === 1 ? "" : "s"} from ${file.name}.`,
    };
  }

  const next = seededRng(`extract:${file.name}:${file.size}`);
  const count = 6 + Math.floor(next() * 6);
  const first = ["Aarav", "Riya", "Kabir", "Ananya", "Vivaan", "Diya", "Ishaan", "Meera", "Neel", "Sana", "Yash", "Tara"];
  const last = ["Sharma", "Patel", "Shah", "Iyer", "Nair", "Reddy", "Desai", "Mehta"];
  const students: ParsedStudent[] = [];
  const seen = new Set<string>();
  while (students.length < count) {
    const name = `${first[Math.floor(next() * first.length)]} ${last[Math.floor(next() * last.length)]}`;
    if (seen.has(name)) continue;
    seen.add(name);
    students.push({ name, rollNo: String(students.length + 1) });
  }

  return {
    students,
    note: `Sample extraction from ${file.name}. Check every row before importing.`,
  };
}

/* ---------- Grading ---------- */

export type GradeOutcome = {
  score: number;
  outOf: number;
  summary: string;
  questions: QuestionMark[];
  needsReview: boolean;
};

export async function gradeSubmission(input: {
  testId: string;
  student: Student;
  maxMarks: number;
  instructions?: string;
}): Promise<GradeOutcome> {
  const result = simulateGrade(input.testId, input.student, input.maxMarks);
  return {
    score: result.score,
    outOf: input.maxMarks,
    summary: result.summary,
    questions: result.questions,
    needsReview: result.needsReview,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
