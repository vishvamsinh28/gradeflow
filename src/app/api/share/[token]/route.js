/**
 * Returning marks to a student or parent.
 *
 * Unauthenticated and reached by an unguessable per-student token, so every
 * field here is whitelisted deliberately. Nothing internal — no teacher notes,
 * no other student's work — crosses this boundary.
 */
import { db } from "@/lib/server/db";
import { isUuid, json, notFound, route } from "@/lib/server/http";
import { gradeFor } from "@/lib/server/domain";
export const GET = route(async (_request, { params }) => {
  const { token } = await params;
  // share_token is a uuid column: a truncated or mistyped link would otherwise
  // reach Postgres, fail the cast, and surface to a parent as a 500.
  if (!isUuid(token)) throw notFound("This results link is");
  const student = await db.classroom_students.findUnique({
    where: {
      share_token: token,
    },
    select: {
      id: true,
      name: true,
      code: true,
      classroom_id: true,
      classrooms: {
        select: {
          name: true,
          grade_scale: true,
        },
      },
    },
  });
  if (!student) throw notFound("This results link is");
  const classroom = student.classrooms;
  const scale = classroom.grade_scale;

  // Only fully graded tests are shared. A test still collecting or mid-grading
  // would show a provisional mark as if it were final.
  const tests = await db.tests.findMany({
    where: {
      classroom_id: student.classroom_id,
      status: "graded",
    },
    orderBy: {
      test_date: "desc",
    },
    select: {
      id: true,
      title: true,
      test_date: true,
      max_marks: true,
      subjects: {
        select: {
          name: true,
        },
      },
    },
  });
  if (!tests.length) {
    return json({
      student: {
        name: student.name,
      },
      classroom: {
        name: classroom.name,
      },
      results: [],
    });
  }
  const testIds = tests.map((test) => test.id);
  const [submissions, absences] = await Promise.all([
    db.test_submissions.findMany({
      where: {
        student_id: student.id,
        status: "graded",
        test_id: {
          in: testIds,
        },
      },
      select: {
        test_id: true,
        score: true,
        out_of: true,
        summary: true,
        questions: true,
      },
    }),
    db.test_attendance.findMany({
      where: {
        student_id: student.id,
        mark: "absent",
        test_id: {
          in: testIds,
        },
      },
      select: {
        test_id: true,
      },
    }),
  ]);
  const byId = new Map(tests.map((test) => [test.id, test]));
  const results = submissions.flatMap((submission) => {
    const test = byId.get(submission.test_id);
    if (!test) return [];
    const outOf = Number(submission.out_of ?? test.max_marks ?? 0);
    const score = Number(submission.score ?? 0);
    const percent = outOf ? Math.round((score / outOf) * 1000) / 10 : null;
    return [
      {
        title: test.title || "Test",
        subject: test.subjects?.name ?? null,
        date: test.test_date.toISOString().slice(0, 10),
        score,
        out_of: outOf,
        percent,
        grade: gradeFor(percent, scale),
        summary: submission.summary,
        questions: (Array.isArray(submission.questions) ? submission.questions : []).map((row) => {
          const question = row;
          return {
            number: question.number,
            awarded: question.awarded,
            out_of: question.out_of,
            note: question.note,
          };
        }),
      },
    ];
  });
  return json({
    student: {
      name: student.name,
      code: student.code,
    },
    classroom: {
      name: classroom.name,
    },
    missed: absences.flatMap((row) => {
      const test = byId.get(row.test_id);
      return test
        ? [
            {
              title: test.title || "Test",
              date: test.test_date.toISOString().slice(0, 10),
            },
          ]
        : [];
    }),
    results,
  });
});
