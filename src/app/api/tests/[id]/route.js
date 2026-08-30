import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { ApiError, body, json, noContent, route } from "@/lib/server/http";
import { ownedTest, questionPayload, submissionPayload, testPayload } from "@/lib/server/domain";
import { testUpdateSchema } from "@/lib/server/schemas";
import { deleteSheets } from "@/lib/server/storage";
/**
 * Everything the test screen needs in one request.
 *
 * The classroom travels with it — fetching it separately was both a wasted
 * round trip and the reason this screen used to flash "Test not found".
 */
export const GET = route(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  const { test, classroom } = await ownedTest(id, user.id);
  const [subjects, students, submissions, attendance, questions] = await Promise.all([
    db.subjects.findMany({
      where: {
        classroom_id: classroom.id,
      },
      orderBy: [
        {
          position: "asc",
        },
        {
          name: "asc",
        },
      ],
    }),
    db.classroom_students.findMany({
      where: {
        classroom_id: classroom.id,
      },
      orderBy: {
        code: "asc",
      },
    }),
    db.test_submissions.findMany({
      where: {
        test_id: id,
      },
    }),
    db.test_attendance.findMany({
      where: {
        test_id: id,
      },
    }),
    db.test_questions.findMany({
      where: { test_id: id },
      orderBy: { position: "asc" },
    }),
  ]);
  return json({
    test: testPayload(test),
    classroom: {
      ...classroom,
      subjects,
    },
    students,
    submissions: submissions.map(submissionPayload),
    attendance,
    questions: questions.map(questionPayload),
  });
});
export const PATCH = route(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  const { classroom } = await ownedTest(id, user.id);
  const input = await body(request, testUpdateSchema);
  // Same boundary as on create: the subject must belong to this classroom.
  if (input.subject_id) {
    const subject = await db.subjects.findFirst({
      where: { id: input.subject_id, classroom_id: classroom.id },
      select: { id: true },
    });
    if (!subject) throw new ApiError(422, "That subject is not in this classroom");
  }
  const data = {
    updated_at: new Date(),
  };
  if (input.test_date != null) data.test_date = new Date(`${input.test_date}T00:00:00Z`);
  if (input.title !== undefined) data.title = input.title?.trim() || null;
  if (input.instructions !== undefined) data.instructions = input.instructions?.trim() || null;
  if (input.max_marks != null) {
    // Once a paper exists, its marks are the total — a hand-edited number here
    // would let question marks disagree with the test total.
    const questionCount = await db.test_questions.count({ where: { test_id: id } });
    if (!questionCount) data.max_marks = input.max_marks;
  }
  data.subjects = input.subject_id
    ? {
        connect: {
          id: input.subject_id,
        },
      }
    : {
        disconnect: true,
      };
  return json(
    testPayload(
      await db.tests.update({
        where: {
          id,
        },
        data,
      }),
    ),
  );
});
export const DELETE = route(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  await ownedTest(id, user.id);
  const sheets = await db.test_submissions.findMany({
    where: {
      test_id: id,
    },
    select: {
      storage_path: true,
    },
  });
  await db.tests.delete({
    where: {
      id,
    },
  });
  await deleteSheets(sheets.map((row) => row.storage_path));
  return noContent();
});
