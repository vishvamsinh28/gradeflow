/**
 * Ownership, and the shapes the browser is allowed to see.
 *
 * Every read and write funnels through one of the `owned*` helpers. A route
 * that forgets to call one cannot reach a row, because nothing else here
 * resolves an id.
 */

import { slugify, submissionPayload, testPayload } from "./shape";
export {
  SUBMISSION_PRIVATE,
  gradeFor,
  nextStudentCodes,
  questionPayload,
  slugify,
  submissionPayload,
  testPayload,
} from "./shape";
import { db } from "./db";
import { ApiError, isUuid, notFound } from "./http";

/** A malformed id would fail the uuid cast in Postgres and surface as a 500. */
function checkId(id, what) {
  if (!isUuid(id)) throw notFound(what);
}
export async function ownedClassroom(id, userId) {
  checkId(id, "Classroom");
  const classroom = await db.classrooms.findFirst({
    where: {
      id,
      owner_id: userId,
    },
  });
  if (!classroom) throw notFound("Classroom");
  return classroom;
}
export async function ownedClassroomBySlug(slug, userId) {
  const classroom = await db.classrooms.findFirst({
    where: {
      slug,
      owner_id: userId,
    },
  });
  if (!classroom) throw notFound("Classroom");
  return classroom;
}
export async function ownedTest(id, userId) {
  checkId(id, "Test");
  const test = await db.tests.findUnique({
    where: {
      id,
    },
    include: {
      classrooms: true,
    },
  });
  if (!test || test.classrooms.owner_id !== userId) throw notFound("Test");
  const { classrooms, ...rest } = test;
  return {
    test: rest,
    classroom: classrooms,
  };
}
export async function ownedSubmission(id, userId) {
  checkId(id, "Submission");
  const submission = await db.test_submissions.findUnique({
    where: {
      id,
    },
    include: {
      tests: {
        include: {
          classrooms: true,
        },
      },
    },
  });
  if (!submission || submission.tests.classrooms.owner_id !== userId) throw notFound("Submission");
  const { tests, ...rest } = submission;
  const { classrooms, ...test } = tests;
  return {
    submission: rest,
    test,
    classroom: classrooms,
  };
}
export async function ownedStudent(id, userId) {
  checkId(id, "Student");
  const student = await db.classroom_students.findUnique({
    where: {
      id,
    },
    include: {
      classrooms: true,
    },
  });
  if (!student || student.classrooms.owner_id !== userId) throw notFound("Student");
  const { classrooms, ...rest } = student;
  return {
    student: rest,
    classroom: classrooms,
  };
}
export async function ownedSubject(id, userId) {
  checkId(id, "Subject");
  const subject = await db.subjects.findUnique({
    where: {
      id,
    },
    include: {
      classrooms: true,
    },
  });
  if (!subject || subject.classrooms.owner_id !== userId) throw notFound("Subject");
  const { classrooms, ...rest } = subject;
  return {
    subject: rest,
    classroom: classrooms,
  };
}

/**
 * A classroom with everything the workspace renders from it.
 *
 * The dashboard computes per-test progress from `submissions` and `attendance`,
 * so they travel with the classroom rather than being fetched per test.
 *
 * One query, not five: the old shape ran a query per relation and then again
 * per classroom on the list endpoint, which is what made loading the dashboard
 * take most of a second on an empty account.
 */
const CLASSROOM_INCLUDE = {
  subjects: {
    orderBy: [
      {
        position: "asc",
      },
      {
        name: "asc",
      },
    ],
  },
  classroom_students: {
    orderBy: {
      code: "asc",
    },
  },
  tests: {
    orderBy: {
      test_date: "desc",
    },
    include: {
      test_submissions: true,
      test_attendance: true,
    },
  },
};
function shapeClassroom(row) {
  const { subjects: subjectRows, classroom_students, tests: testRows, ...classroom } = row;
  return {
    ...classroom,
    subjects: subjectRows,
    students: classroom_students,
    tests: testRows.map(({ test_submissions, test_attendance, ...test }) => testPayload(test)),
    submissions: testRows.flatMap((test) => test.test_submissions.map(submissionPayload)),
    attendance: testRows.flatMap((test) => test.test_attendance),
  };
}
export async function classroomPayload(id) {
  const row = await db.classrooms.findUniqueOrThrow({
    where: {
      id,
    },
    include: CLASSROOM_INCLUDE,
  });
  return shapeClassroom(row);
}

/** Every classroom a teacher owns, in one round trip rather than one per room. */
export async function classroomsPayload(ownerId) {
  const rows = await db.classrooms.findMany({
    where: {
      owner_id: ownerId,
    },
    orderBy: {
      created_at: "desc",
    },
    include: CLASSROOM_INCLUDE,
  });
  return rows.map(shapeClassroom);
}

/** Slugs are per owner, so two teachers can both have a "class-10-a". */
export async function uniqueSlug(ownerId, name) {
  const base = slugify(name);
  const taken = new Set(
    (
      await db.classrooms.findMany({
        where: {
          owner_id: ownerId,
        },
        select: {
          slug: true,
        },
      })
    ).map((row) => row.slug),
  );
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}
export { ApiError };
