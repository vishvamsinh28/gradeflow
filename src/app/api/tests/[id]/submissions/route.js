import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { ApiError, json, route } from "@/lib/server/http";
import { ownedTest, submissionPayload } from "@/lib/server/domain";
import { identifyPages } from "@/lib/server/grader";
import { gradeRequested, inngest } from "@/lib/server/inngest/client";
import {
  extractPdfPages,
  groupPagesByStudent,
  matchByFilename,
  matchNameToStudent,
  pdfPageCount,
} from "@/lib/server/sheets";
import { slugify } from "@/lib/server/shape";
import {
  MAX_FILES,
  MAX_PDF_PAGES,
  deleteSheets,
  readUpload,
  uploadSheet,
} from "@/lib/server/storage";

const MAX_AI_MATCHES = 8;

/**
 * Accept whatever the scanner produced.
 *
 * One file per student works. So does a single multi-page PDF holding the whole
 * class — it is split by reading the name off each page, which is the shape a
 * document scanner or a phone scanning app actually gives you.
 */
export const POST = route(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  const { classroom } = await ownedTest(id, user.id);
  const form = await request.formData();
  const files = form.getAll("files").filter((entry) => entry instanceof File);
  if (!files.length) throw new ApiError(422, "Attach at least one answer sheet");
  if (files.length > MAX_FILES) {
    throw new ApiError(
      413,
      `That is ${files.length} files. Upload at most ${MAX_FILES} at a time.`,
    );
  }
  const anyStudents = await db.classroom_students.count({ where: { classroom_id: classroom.id } });
  if (!anyStudents) {
    throw new ApiError(400, "Add students to this classroom before uploading answer sheets.");
  }
  const questionCount = await db.test_questions.count({ where: { test_id: id } });
  if (!questionCount) {
    throw new ApiError(400, "Add the question paper first — answers are marked against it.");
  }
  const students = await presentStudents(id, classroom.id);
  if (!students.length) {
    throw new ApiError(400, "Every student is marked absent for this test");
  }

  const taken = new Set();
  const prepared = [];
  const unmatched = [];
  const pendingAiMatch = [];

  // The Upload button on a student's row names its student outright — no
  // matching, no guessing, exactly what the unmatched-sheet notice promises.
  const directStudentId = form.get("student_id");
  if (typeof directStudentId === "string" && directStudentId) {
    const target = students.find((student) => student.id === directStudentId);
    if (!target) {
      throw new ApiError(422, "That student is not in this classroom, or is marked absent.");
    }
    for (const file of files) {
      const { content, mime } = await readUpload(file);
      prepared.push({
        studentId: target.id,
        sheet: { fileName: file.name || "sheet", mimeType: mime, content },
        byAi: false,
      });
    }
  } else
    for (const file of files) {
      const { content, mime } = await readUpload(file);
      const name = file.name || "sheet";
      const pages = mime === "application/pdf" ? await pdfPageCount(content) : 1;
      if (pages > MAX_PDF_PAGES) {
        throw new ApiError(
          413,
          `${name} has ${pages} pages. Split it into batches of ${MAX_PDF_PAGES} or fewer.`,
        );
      }
      if (pages > 1 && files.length === 1) {
        // A whole class in one PDF: ask which name is on each page, group
        // continuation pages onto the sheet they belong to, then split.
        let pageNames;
        try {
          pageNames = await identifyPages(content, mime, pages);
        } catch (error) {
          console.error(`Could not read names from ${name}:`, error);
          throw new ApiError(
            422,
            "Could not read the names in that PDF. Try uploading one file per student.",
          );
        }
        for (const group of groupPagesByStudent(pageNames)) {
          const studentId = matchNameToStudent(
            group.name,
            students.filter((student) => !taken.has(student.id)),
          );
          const sheet = {
            fileName: `${slugify(group.name || "sheet")}-p${group.first}.pdf`,
            mimeType: mime,
            content: await extractPdfPages(content, group.first, group.last),
            pageFrom: group.first,
            pageTo: group.last,
          };
          if (studentId) {
            taken.add(studentId);
            prepared.push({
              studentId,
              sheet,
              byAi: true,
            });
          } else {
            unmatched.push(`pages ${group.first}-${group.last}`);
          }
        }
        continue;
      }
      const studentId = matchByFilename(name, students, taken);
      const sheet = {
        fileName: name,
        mimeType: mime,
        content,
      };
      if (studentId) {
        taken.add(studentId);
        prepared.push({
          studentId,
          sheet,
          byAi: false,
        });
      } else {
        pendingAiMatch.push({ sheet, pages });
      }
    }

  // Filename told us nothing (IMG_4821.jpg, ag.png) — read the name off the
  // sheet itself, the same way whole-class PDFs are split. Reads run in
  // parallel; assignment stays sequential so two sheets cannot land on one
  // student. Bounded so a huge unnamed batch cannot fan out into a model call
  // per file.
  if (pendingAiMatch.length) {
    const attempts = pendingAiMatch.slice(0, MAX_AI_MATCHES);
    const overflow = pendingAiMatch.slice(MAX_AI_MATCHES);
    const readings = await Promise.all(
      attempts.map(async ({ sheet, pages }) => {
        try {
          const names = await identifyPages(sheet.content, sheet.mimeType, pages);
          return names.find((value) => value) ?? null;
        } catch (error) {
          console.error(`Could not read a name off ${sheet.fileName}:`, error);
          return null;
        }
      }),
    );
    attempts.forEach(({ sheet }, index) => {
      const studentId = matchNameToStudent(
        readings[index],
        students.filter((student) => !taken.has(student.id)),
      );
      if (studentId) {
        taken.add(studentId);
        prepared.push({ studentId, sheet, byAi: true });
      } else {
        unmatched.push(sheet.fileName);
      }
    });
    overflow.forEach(({ sheet }) => unmatched.push(sheet.fileName));
  }
  // A re-upload under a different filename lands on a different storage path;
  // without this, the old object stays in the bucket forever.
  const previousPaths = new Map(
    (
      await db.test_submissions.findMany({
        where: { test_id: id, student_id: { in: prepared.map((entry) => entry.studentId) } },
        select: { student_id: true, storage_path: true },
      })
    ).map((row) => [row.student_id, row.storage_path]),
  );

  const created = [];
  const replaced = [];
  for (const { studentId, sheet, byAi } of prepared) {
    const storagePath = await uploadSheet(user.id, id, studentId, sheet);
    const previous = previousPaths.get(studentId);
    if (previous && previous !== storagePath) replaced.push(previous);
    const row = {
      file_name: sheet.fileName,
      storage_path: storagePath,
      mime_type: sheet.mimeType,
      source_page_from: sheet.pageFrom ?? null,
      source_page_to: sheet.pageTo ?? null,
      matched_by_ai: byAi,
      status: "awaiting",
      score: null,
      out_of: null,
      summary: null,
      questions: [],
      needs_review: false,
      overridden: false,
      error_message: null,
      graded_at: null,
      updated_at: new Date(),
    };
    created.push(
      submissionPayload(
        await db.test_submissions.upsert({
          where: {
            test_id_student_id: {
              test_id: id,
              student_id: studentId,
            },
          },
          create: {
            test_id: id,
            student_id: studentId,
            ...row,
          },
          update: row,
        }),
      ),
    );
  }
  await deleteSheets(replaced);
  if (created.length) {
    // The sheets are stored and the rows written — the upload has succeeded.
    // If the queue is unreachable the rows simply stay `awaiting`, and the
    // Grade button re-queues them; failing the whole request here would tell
    // the teacher their upload was lost when it was not.
    try {
      await inngest.send(gradeRequested.create({ testId: id }));
    } catch (error) {
      console.error("Could not queue grading after upload:", error);
    }
  }

  // Unmatched sheets are reported, never guessed at. Attaching one student's
  // paper to another is the worst mistake this product could make, so the
  // teacher assigns those by uploading them against a student directly.
  return json(
    {
      submissions: created,
      unmatched,
      awaiting_upload: students
        .filter((student) => !taken.has(student.id))
        .map((student) => ({
          id: student.id,
          name: student.name,
          code: student.code,
        })),
    },
    201,
  );
});
async function presentStudents(testId, classroomId) {
  const [students, absent] = await Promise.all([
    db.classroom_students.findMany({
      where: {
        classroom_id: classroomId,
      },
      orderBy: {
        code: "asc",
      },
    }),
    db.test_attendance.findMany({
      where: {
        test_id: testId,
        mark: "absent",
      },
      select: {
        student_id: true,
      },
    }),
  ]);
  const away = new Set(absent.map((row) => row.student_id));
  return students.filter((student) => !away.has(student.id));
}

// Splitting a class PDF reads every page in one model call.
export const maxDuration = 60;
