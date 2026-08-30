/**
 * Grading.
 *
 * Three calls to the model: read whose sheet each page belongs to when a whole
 * class arrives as one PDF, read a class register into a student list, and mark
 * one student's paper. There is no answer key and no rubric — the teacher's
 * guidance is a sentence.
 */
import { GoogleGenAI } from "@google/genai";
import { env } from "./env";
// The API carries inline files in the request body, which tops out around
// 20MB after base64. Past that the call fails opaquely, so refuse it with a
// reason while it is still cheap to do so.
const MODEL_MAX_BYTES = 15 * 1024 * 1024;

function client() {
  return new GoogleGenAI({
    apiKey: env().GEMINI_API_KEY,
  });
}
async function askForJson(prompt, file) {
  const parts = [
    {
      text: prompt,
    },
  ];
  if (file) {
    if (file.content.length > MODEL_MAX_BYTES) {
      throw new Error("That file is too large to read in one go — compress it or split it up.");
    }
    parts.push({
      inlineData: {
        mimeType: file.mimeType,
        data: Buffer.from(file.content).toString("base64"),
      },
    });
  }
  const response = await client().models.generateContent({
    model: env().GEMINI_MODEL,
    contents: [
      {
        role: "user",
        parts,
      },
    ],
    config: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });
  const text = response.text;
  if (!text) throw new Error("The model returned an empty response");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("The model returned invalid JSON");
  }
}

/** Read the student name off each page of a scanned batch. */
export async function identifyPages(content, mimeType, pageCount) {
  const data = await askForJson(
    `
This PDF is a stack of ${pageCount} scanned answer sheets from one class, in order.
For every page, report the student's name if it is written on that page.

Return JSON: {"pages": [{"page": 1, "student_name": string|null}, ...]}

Rules:
- One entry per page, pages numbered from 1 to ${pageCount}.
- Use null when no name is written on that page. Continuation pages of a
  multi-page answer booklet usually have no name, and null is the correct
  answer for them — do not guess or carry a name forward.
- Copy the name exactly as written. Do not correct spelling.
`.trim(),
    {
      content,
      mimeType,
    },
  );
  const byPage = new Map();
  for (const entry of asArray(data.pages)) {
    const page = Number(entry.page);
    if (!Number.isInteger(page)) continue;
    const name = entry.student_name;
    byPage.set(page, typeof name === "string" && name.trim() ? name.trim() : null);
  }
  return Array.from(
    {
      length: pageCount,
    },
    (_, index) => byPage.get(index + 1) ?? null,
  );
}

/** Pull a student list off a photographed or scanned class register. */
export async function readRoster(content, mimeType) {
  const data = await askForJson(
    `
This image or PDF is a class register — a list of students in one classroom.
Read every student on it.

Return JSON: {"students": [{"name": string, "roll_no": string|null}, ...]}

Rules:
- One entry per student, in the order they appear.
- Copy names exactly as written. Do not correct spelling or reorder
  first and last names.
- roll_no is the roll number, admission number, or serial number beside the
  name. Use null when the sheet has none.
- Skip headers, totals, signatures, and anything that is not a student.
`.trim(),
    {
      content,
      mimeType,
    },
  );
  const students = [];
  for (const entry of asArray(data.students)) {
    const row = entry;
    if (typeof row.name !== "string" || !row.name.trim()) continue;
    const roll = row.roll_no;
    students.push({
      name: row.name.trim(),
      roll_no: roll === null || roll === undefined || roll === "" ? null : String(roll).trim(),
    });
  }
  return students;
}

/**
 * Read a question paper into a list of questions.
 *
 * The same call handles a marking scheme: when answers are printed alongside
 * the questions it picks them up, and when they are not it leaves them null
 * rather than inventing them.
 */
export async function readQuestionPaper(content, mimeType) {
  const data = await askForJson(
    `
This image or PDF is a question paper, or a question paper with its marking
scheme. Read every question on it.

Return JSON: {"questions": [{"label": string|null, "prompt": string, "answer": string|null, "marks": number|null}, ...]}

Rules:
- One entry per question, in the order they appear. Split multi-part questions
  into separate entries ("3a", "3b") when each part carries its own marks.
- \`label\` is the number as printed ("1", "Q2", "3a"). Use null if unnumbered.
- \`prompt\` is the question itself, copied as written.
- \`answer\` is the expected answer ONLY if the paper actually shows one, as a
  marking scheme would. Use null otherwise — never solve the question yourself.
- \`marks\` is the marks printed for that question. Use null if not shown.
- Skip headings, instructions, and anything that is not a question.
`.trim(),
    { content, mimeType },
  );

  const questions = [];
  for (const entry of asArray(data.questions)) {
    const row = entry;
    if (typeof row?.prompt !== "string" || !row.prompt.trim()) continue;
    const marks = Number(row.marks);
    questions.push({
      label: typeof row.label === "string" && row.label.trim() ? row.label.trim() : null,
      prompt: row.prompt.trim(),
      answer: typeof row.answer === "string" && row.answer.trim() ? row.answer.trim() : null,
      marks: Number.isFinite(marks) && marks > 0 ? marks : null,
    });
  }
  return questions;
}

/** Mark one student's paper. */
export async function gradeSheet(
  content,
  mimeType,
  maxMarks,
  instructions,
  correction,
  questions = [],
) {
  let guidance = (instructions || "").trim();
  if (correction?.trim()) {
    // A correction is the teacher overruling the previous pass, so it goes last
    // and is marked as taking precedence.
    guidance =
      `${guidance}\n\nCorrection from the teacher, which overrides the above:\n${correction.trim()}`.trim();
  }
  const guidanceBlock = guidance
    ? `Teacher's guidance:\n${guidance}`
    : "No extra guidance was given. Mark fairly, awarding method marks where the approach is sound.";

  // With a question paper the model marks against what the teacher set. Without
  // one it falls back to reading the questions off the student's own sheet,
  // which is how this worked before question papers existed.
  const paperBlock = questions.length
    ? `
The question paper, which is what you are marking against:

${questions
  .map((question, index) => {
    const label = question.label || String(index + 1);
    const answer = question.answer ? `\n   Expected answer: ${question.answer}` : "";
    return `${label}. [${question.marks} marks] ${question.prompt}${answer}`;
  })
  .join("\n")}

Use exactly these questions, these labels and these marks. Do not invent
questions that are not listed, and do not merge or split them. If a student
left one out, award zero for it and say so in the note.${
        questions.some((question) => question.answer)
          ? "\nWhere an expected answer is given, mark against it — but still award\nmethod marks for a sound approach that reaches a different form."
          : ""
      }
`.trim()
    : "The questions are on the sheet itself — read them, read the student's work, and award marks.";
  const data = await askForJson(
    `
You are marking one student's answer sheet.

${paperBlock}

The paper is out of ${maxMarks} marks in total.

${guidanceBlock}

Return JSON with exactly this shape:
{
  "questions": [
    {"number": string, "awarded": number, "out_of": number, "note": string}
  ],
  "score": number,
  "out_of": number,
  "summary": string,
  "needs_review": boolean,
  "review_reason": string|null
}

Rules:
- The sum of \`awarded\` must equal \`score\`, and the sum of \`out_of\` must equal ${maxMarks}.
- Never award more than \`out_of\` for a question.
- \`note\` is one short sentence a teacher could read at a glance.
- Set \`needs_review\` to true when handwriting is unreadable, a page looks
  missing, or you are genuinely unsure — being unsure is not the same as being
  wrong, and a flagged paper is better than a confident mistake.
`.trim(),
    {
      content,
      mimeType,
    },
  );
  return normalize(data, maxMarks);
}

/** Rescale to the paper's total so the model cannot invent a different one. */
export function normalize(data, maxMarks) {
  const questions = asArray(data.questions).map((raw) => {
    const row = raw;
    const outOf = Math.max(0, Number(row.out_of) || 0);
    const awarded = Math.max(0, Number(row.awarded) || 0);
    return {
      number: String(row.number ?? "?"),
      out_of: outOf,
      awarded: Math.min(awarded, outOf),
      note: String(row.note ?? ""),
    };
  });
  const totalOutOf = questions.reduce((sum, question) => sum + question.out_of, 0);
  if (questions.length && totalOutOf > 0 && Math.abs(totalOutOf - maxMarks) > 0.01) {
    const scale = maxMarks / totalOutOf;
    for (const question of questions) {
      question.out_of = round(question.out_of * scale);
      question.awarded = round(Math.min(question.awarded * scale, question.out_of));
    }
  }
  const score = questions.length
    ? questions.reduce((sum, question) => sum + question.awarded, 0)
    : Math.max(0, Math.min(Number(data.score) || 0, maxMarks));
  return {
    questions,
    score: round(score),
    out_of: maxMarks,
    summary: typeof data.summary === "string" ? data.summary : "",
    needs_review: Boolean(data.needs_review),
    review_reason: typeof data.review_reason === "string" ? data.review_reason : null,
  };
}
const round = (value) => Math.round(value * 100) / 100;
const asArray = (value) => (Array.isArray(value) ? value : []);
