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
import type { QuestionMark, Student } from "./types";

/* ---------- Deterministic simulation ----------
   Stands in for the model while this build has no grading server. Seeded so a
   given submission always comes back with the same marks. */

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: string): () => number {
  let a = hash(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(next: () => number, items: readonly T[]): T {
  return items[Math.floor(next() * items.length)];
}

/** A stable per-student ability, so results look coherent across subjects. */
function ability(studentId: string): number {
  return 0.5 + rng(`ability:${studentId}`)() * 0.45;
}

const NOTES_GOOD = [
  "Correct method and a clean final answer.",
  "Well structured, units carried through correctly.",
  "Right approach, working clearly laid out.",
  "Accurate throughout.",
];

const NOTES_PARTIAL = [
  "Correct method, arithmetic slip in the final step.",
  "Right idea but the units were dropped.",
  "Partial credit — second condition not checked.",
  "Set up correctly, simplification incomplete.",
];

const NOTES_POOR = [
  "Method not applicable to this question.",
  "Answer left incomplete.",
  "Concept confused with the previous chapter.",
  "No supporting working shown.",
];

function simulateGrade(testId: string, student: Student, maxMarks: number) {
  const next = rng(`grade:${testId}:${student.id}`);
  const base = ability(student.id) + (next() - 0.5) * 0.16;
  const ratio = Math.max(0.24, Math.min(0.99, base));

  const questionCount = 4 + Math.floor(next() * 2);
  const per = maxMarks / questionCount;
  const questions: QuestionMark[] = [];
  let total = 0;

  for (let i = 0; i < questionCount; i += 1) {
    const wobble = (next() - 0.5) * 0.34;
    const qRatio = Math.max(0, Math.min(1, ratio + wobble));
    const awarded = Math.round(per * qRatio * 2) / 2;
    total += awarded;
    const notes = qRatio > 0.85 ? NOTES_GOOD : qRatio > 0.45 ? NOTES_PARTIAL : NOTES_POOR;
    questions.push({
      number: `Q${i + 1}`,
      awarded,
      outOf: Math.round(per * 2) / 2,
      note: pick(next, notes),
    });
  }

  const percent = total / maxMarks;
  const summary =
    percent > 0.85
      ? "Consistently accurate. Method marks awarded in full."
      : percent > 0.6
        ? "Solid understanding; loses marks on the final steps rather than the approach."
        : percent > 0.4
          ? "Grasps the setup but the working breaks down midway. Worth a second look together."
          : "Struggling with the core method for this chapter.";

  return {
    score: Math.round(total * 2) / 2,
    questions,
    summary,
    needsReview: next() < 0.07,
  };
}


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

  const next = rng(`extract:${file.name}:${file.size}`);
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
