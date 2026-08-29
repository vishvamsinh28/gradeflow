"use client";

/**
 * Workspace store.
 *
 * A small vanilla store read through `useSyncExternalStore`. Long-running work
 * (AI grading a batch) lives here rather than in a component, so a teacher can
 * start grading and navigate away while it finishes.
 */

import { useEffect, useSyncExternalStore } from "react";
import { gradeSubmission } from "./ai";
import { slugify, todayISO } from "./format";
import type { ParsedStudent } from "./parse";
import type {
  AttendanceMark,
  Classroom,
  Database,
  ID,
  Student,
  Submission,
  Test,
  TestProgress,
} from "./types";

const STORAGE_PREFIX = "gradeflow.workspace.v2";

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`;
}

/** A brand new account starts with nothing in it, not with sample data. */
function emptyDatabase(teacherName: string): Database {
  return { version: 2, teacherName, classrooms: [], submissions: [], attendance: {} };
}

let state: Database = emptyDatabase("there");
let activeUserId: string | null = null;
let didHydrate = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function commit(next: Database) {
  state = next;
  persist();
  emit();
}

function persist() {
  if (typeof window === "undefined" || !didHydrate || !activeUserId) return;
  try {
    window.localStorage.setItem(storageKey(activeUserId), JSON.stringify(state));
  } catch {
    // A full or blocked storage quota must never break the workspace.
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => state;

/** Anything left mid-flight when the tab closed is not actually running. */
function settleInterrupted(db: Database): Database {
  return {
    ...db,
    submissions: db.submissions.map((submission) =>
      submission.status === "grading" || submission.status === "queued"
        ? { ...submission, status: "awaiting" as const }
        : submission,
    ),
    classrooms: db.classrooms.map((classroom) => ({
      ...classroom,
      tests: classroom.tests.map((test) =>
        test.status === "grading" ? { ...test, status: "collecting" as const } : test,
      ),
    })),
  };
}

/**
 * Loads the signed-in teacher's workspace. Returns false until it is ready, so
 * the shell can render a skeleton instead of an empty state that is about to
 * be replaced.
 */
export function useHydratedWorkspace(userId: string | null, teacherName: string): boolean {
  useEffect(() => {
    if (!userId) {
      activeUserId = null;
      didHydrate = false;
      state = emptyDatabase("there");
      emit();
      return;
    }
    if (activeUserId === userId && didHydrate) return;

    activeUserId = userId;
    let next = emptyDatabase(teacherName);
    try {
      const raw = window.localStorage.getItem(storageKey(userId));
      if (raw) {
        const parsed = JSON.parse(raw) as Database;
        if (parsed?.version === next.version && Array.isArray(parsed.classrooms)) {
          next = { ...parsed, teacherName };
        }
      }
    } catch {
      // Corrupt payload — start this account clean rather than crashing.
    }
    state = settleInterrupted(next);
    didHydrate = true;
    persist();
    emit();
  }, [userId, teacherName]);

  return useSyncExternalStore(
    subscribe,
    () => didHydrate && activeUserId === userId,
    () => false,
  );
}

export function useDatabase(): Database {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useClassroom(slug: string): Classroom | undefined {
  const db = useDatabase();
  return db.classrooms.find((classroom) => classroom.slug === slug);
}

/* ---------- Identity ---------- */

let counter = 0;
function uid(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}`;
}

function nextStudentCode(classroom: Classroom, offset: number): string {
  const highest = classroom.students.reduce((max, student) => {
    const match = student.code.match(/(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `STU-${String(highest + offset + 1).padStart(3, "0")}`;
}

function uniqueSlug(name: string): string {
  const base = slugify(name) || "classroom";
  let slug = base;
  let n = 2;
  while (state.classrooms.some((classroom) => classroom.slug === slug)) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

function mapClassroom(id: ID, fn: (classroom: Classroom) => Classroom): Database {
  return {
    ...state,
    classrooms: state.classrooms.map((classroom) =>
      classroom.id === id ? fn(classroom) : classroom,
    ),
  };
}

/* ---------- Classrooms ---------- */

export function createClassroom(input: {
  name: string;
  description?: string;
  subjects?: string[];
}): Classroom {
  const id = uid("cls");
  const classroom: Classroom = {
    id,
    slug: uniqueSlug(input.name),
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    subjects: (input.subjects ?? [])
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name, index) => ({ id: `${id}-sub${index + 1}`, name })),
    students: [],
    tests: [],
    createdAt: todayISO(),
  };
  commit({ ...state, classrooms: [classroom, ...state.classrooms] });
  return classroom;
}

export function updateClassroom(id: ID, patch: { name?: string; description?: string }) {
  commit(
    mapClassroom(id, (classroom) => ({
      ...classroom,
      name: patch.name?.trim() || classroom.name,
      description:
        patch.description === undefined ? classroom.description : patch.description.trim() || undefined,
    })),
  );
}

export function deleteClassroom(id: ID) {
  const classroom = state.classrooms.find((item) => item.id === id);
  const testIds = new Set((classroom?.tests ?? []).map((test) => test.id));
  commit({
    ...state,
    classrooms: state.classrooms.filter((item) => item.id !== id),
    submissions: state.submissions.filter((submission) => !testIds.has(submission.testId)),
    attendance: Object.fromEntries(
      Object.entries(state.attendance).filter(([key]) => !testIds.has(key.split(":")[0])),
    ),
  });
}

/* ---------- Subjects ---------- */

export function addSubject(classroomId: ID, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  commit(
    mapClassroom(classroomId, (classroom) =>
      classroom.subjects.some((subject) => subject.name.toLowerCase() === trimmed.toLowerCase())
        ? classroom
        : {
            ...classroom,
            subjects: [...classroom.subjects, { id: uid("sub"), name: trimmed }],
          },
    ),
  );
}

export function renameSubject(classroomId: ID, subjectId: ID, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  commit(
    mapClassroom(classroomId, (classroom) => ({
      ...classroom,
      subjects: classroom.subjects.map((subject) =>
        subject.id === subjectId ? { ...subject, name: trimmed } : subject,
      ),
    })),
  );
}

export function removeSubject(classroomId: ID, subjectId: ID) {
  commit(
    mapClassroom(classroomId, (classroom) => ({
      ...classroom,
      subjects: classroom.subjects.filter((subject) => subject.id !== subjectId),
      tests: classroom.tests.map((test) =>
        test.subjectId === subjectId ? { ...test, subjectId: undefined } : test,
      ),
    })),
  );
}

/* ---------- Students ---------- */

export function addStudents(classroomId: ID, incoming: ParsedStudent[]): number {
  const classroom = state.classrooms.find((item) => item.id === classroomId);
  if (!classroom) return 0;

  const existing = new Set(classroom.students.map((student) => student.name.toLowerCase()));
  const fresh: Student[] = [];

  incoming.forEach((entry) => {
    const name = entry.name.trim();
    if (!name || existing.has(name.toLowerCase())) return;
    existing.add(name.toLowerCase());
    fresh.push({
      id: uid("stu"),
      code: nextStudentCode(classroom, fresh.length),
      name,
      rollNo: entry.rollNo?.trim() || undefined,
    });
  });

  if (fresh.length === 0) return 0;
  commit(
    mapClassroom(classroomId, (item) => ({ ...item, students: [...item.students, ...fresh] })),
  );
  return fresh.length;
}

export function updateStudent(classroomId: ID, studentId: ID, patch: Partial<Student>) {
  commit(
    mapClassroom(classroomId, (classroom) => ({
      ...classroom,
      students: classroom.students.map((student) =>
        student.id === studentId ? { ...student, ...patch } : student,
      ),
    })),
  );
}

export function removeStudent(classroomId: ID, studentId: ID) {
  commit({
    ...mapClassroom(classroomId, (classroom) => ({
      ...classroom,
      students: classroom.students.filter((student) => student.id !== studentId),
    })),
    submissions: state.submissions.filter((submission) => submission.studentId !== studentId),
  });
}

/* ---------- Tests ---------- */

export function createTest(
  classroomId: ID,
  input: {
    date: string;
    title?: string;
    subjectId?: ID;
    instructions?: string;
    maxMarks?: number;
  },
): Test {
  const test: Test = {
    id: uid("test"),
    date: input.date,
    title: input.title?.trim() || undefined,
    subjectId: input.subjectId || undefined,
    instructions: input.instructions?.trim() || undefined,
    maxMarks: input.maxMarks && input.maxMarks > 0 ? input.maxMarks : 100,
    status: "collecting",
    createdAt: todayISO(),
  };
  commit(mapClassroom(classroomId, (classroom) => ({ ...classroom, tests: [test, ...classroom.tests] })));
  return test;
}

export function updateTest(classroomId: ID, testId: ID, patch: Partial<Test>) {
  commit(
    mapClassroom(classroomId, (classroom) => ({
      ...classroom,
      tests: classroom.tests.map((test) => (test.id === testId ? { ...test, ...patch } : test)),
    })),
  );
}

export function deleteTest(classroomId: ID, testId: ID) {
  commit({
    ...mapClassroom(classroomId, (classroom) => ({
      ...classroom,
      tests: classroom.tests.filter((test) => test.id !== testId),
    })),
    submissions: state.submissions.filter((submission) => submission.testId !== testId),
    attendance: Object.fromEntries(
      Object.entries(state.attendance).filter(([key]) => !key.startsWith(`${testId}:`)),
    ),
  });
}

/* ---------- Attendance ---------- */

export function setAttendance(testId: ID, studentId: ID, mark: AttendanceMark) {
  const attendance = { ...state.attendance, [`${testId}:${studentId}`]: mark };
  const next: Database = { ...state, attendance };
  // An absent student is not expected to submit anything.
  if (mark === "absent") {
    next.submissions = state.submissions.filter(
      (submission) => !(submission.testId === testId && submission.studentId === studentId),
    );
  }
  commit(next);
}

export function setAllAttendance(testId: ID, studentIds: ID[], mark: AttendanceMark) {
  const attendance = { ...state.attendance };
  studentIds.forEach((studentId) => {
    attendance[`${testId}:${studentId}`] = mark;
  });
  commit({ ...state, attendance });
}

export function attendanceOf(db: Database, testId: ID, studentId: ID): AttendanceMark {
  return db.attendance[`${testId}:${studentId}`] ?? "present";
}

/* ---------- Submissions ---------- */

export function attachSubmissions(
  testId: ID,
  entries: { studentId: ID; fileName: string; matchedByAI?: boolean }[],
) {
  const byStudent = new Map(entries.map((entry) => [entry.studentId, entry]));
  const kept = state.submissions.filter(
    (submission) => !(submission.testId === testId && byStudent.has(submission.studentId)),
  );
  const added: Submission[] = entries.map((entry) => ({
    id: uid("sub"),
    testId,
    studentId: entry.studentId,
    fileName: entry.fileName,
    matchedByAI: entry.matchedByAI,
    status: "awaiting",
  }));
  commit({ ...state, submissions: [...kept, ...added] });
}

export function removeSubmission(submissionId: ID) {
  commit({
    ...state,
    submissions: state.submissions.filter((submission) => submission.id !== submissionId),
  });
}

export function overrideScore(submissionId: ID, score: number) {
  commit({
    ...state,
    submissions: state.submissions.map((submission) =>
      submission.id === submissionId
        ? { ...submission, score, overridden: true, needsReview: false }
        : submission,
    ),
  });
}

export function acceptResult(submissionId: ID) {
  commit({
    ...state,
    submissions: state.submissions.map((submission) =>
      submission.id === submissionId ? { ...submission, needsReview: false } : submission,
    ),
  });
}

/* ---------- Grading ---------- */

const running = new Set<ID>();

function patchSubmission(id: ID, patch: Partial<Submission>) {
  commit({
    ...state,
    submissions: state.submissions.map((submission) =>
      submission.id === id ? { ...submission, ...patch } : submission,
    ),
  });
}

/**
 * Grades every ungraded submission on a test, one at a time, so the teacher
 * watches real progress instead of a spinner. Safe to call twice.
 */
export async function startGrading(classroomId: ID, testId: ID): Promise<void> {
  if (running.has(testId)) return;

  const classroom = state.classrooms.find((item) => item.id === classroomId);
  const test = classroom?.tests.find((item) => item.id === testId);
  if (!classroom || !test) return;

  const order = new Map(classroom.students.map((student, index) => [student.id, index]));
  const pending = state.submissions
    .filter(
      (submission) =>
        submission.testId === testId &&
        (submission.status === "awaiting" || submission.status === "failed"),
    )
    .sort((a, b) => (order.get(a.studentId) ?? 0) - (order.get(b.studentId) ?? 0));

  if (pending.length === 0) return;

  running.add(testId);
  updateTest(classroomId, testId, { status: "grading" });
  commit({
    ...state,
    submissions: state.submissions.map((submission) =>
      pending.some((item) => item.id === submission.id)
        ? { ...submission, status: "queued" as const, error: undefined }
        : submission,
    ),
  });

  for (const item of pending) {
    if (!state.submissions.some((submission) => submission.id === item.id)) continue;
    patchSubmission(item.id, { status: "grading" });
    await new Promise((resolve) => setTimeout(resolve, 420 + (pending.length > 12 ? 120 : 380)));

    const student = classroom.students.find((candidate) => candidate.id === item.studentId);
    if (!student) continue;

    try {
      const outcome = await gradeSubmission({
        testId,
        student,
        maxMarks: test.maxMarks,
        instructions: test.instructions,
      });
      patchSubmission(item.id, {
        status: "graded",
        score: outcome.score,
        outOf: outcome.outOf,
        summary: outcome.summary,
        questions: outcome.questions,
        needsReview: outcome.needsReview,
        gradedAt: todayISO(),
      });
    } catch {
      patchSubmission(item.id, { status: "failed", error: "Could not read this answer sheet." });
    }
  }

  running.delete(testId);
  const remaining = state.submissions.some(
    (submission) => submission.testId === testId && submission.status !== "graded",
  );
  updateTest(classroomId, testId, { status: remaining ? "collecting" : "graded" });
}

/* ---------- Workspace lifecycle ---------- */

export function clearWorkspace() {
  commit(emptyDatabase(state.teacherName));
}

/* ---------- Derived data ---------- */

function submissionsForTest(db: Database, testId: ID): Submission[] {
  return db.submissions.filter((submission) => submission.testId === testId);
}

export function testProgress(db: Database, classroom: Classroom, test: Test): TestProgress {
  const submissions = submissionsForTest(db, test.id);
  const absent = classroom.students.filter(
    (student) => attendanceOf(db, test.id, student.id) === "absent",
  ).length;
  const graded = submissions.filter((submission) => submission.status === "graded");
  const percents = graded
    .filter((submission) => submission.outOf)
    .map((submission) => ((submission.score ?? 0) / (submission.outOf || 1)) * 100);

  return {
    expected: classroom.students.length - absent,
    submitted: submissions.length,
    graded: graded.length,
    absent,
    needsReview: graded.filter((submission) => submission.needsReview).length,
    averagePercent:
      percents.length > 0 ? percents.reduce((sum, value) => sum + value, 0) / percents.length : null,
  };
}

export function classroomSummary(db: Database, classroom: Classroom) {
  const graded = classroom.tests.filter((test) => test.status === "graded");
  const latest = [...classroom.tests].sort((a, b) => b.date.localeCompare(a.date))[0];
  const needsAnswers = classroom.tests.filter((test) => {
    const progress = testProgress(db, classroom, test);
    return test.status === "collecting" && progress.submitted < progress.expected;
  }).length;
  const needsReview = db.submissions.filter(
    (submission) =>
      submission.needsReview &&
      classroom.tests.some((test) => test.id === submission.testId),
  ).length;

  const averages = classroom.tests
    .map((test) => testProgress(db, classroom, test).averagePercent)
    .filter((value): value is number => value !== null);

  return {
    latest,
    latestSubject: latest
      ? classroom.subjects.find((subject) => subject.id === latest.subjectId)?.name
      : undefined,
    latestAverage: latest ? testProgress(db, classroom, latest).averagePercent : null,
    gradedCount: graded.length,
    needsAnswers,
    needsReview,
    average:
      averages.length > 0 ? averages.reduce((sum, value) => sum + value, 0) / averages.length : null,
  };
}
