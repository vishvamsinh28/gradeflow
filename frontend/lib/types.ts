/**
 * GradeFlow domain model.
 *
 * The classroom is the central entity. Everything else — subjects, students,
 * tests, submissions, attendance — hangs off it.
 */

export type ID = string;

export type Subject = {
  id: ID;
  name: string;
};

export type Student = {
  id: ID;
  /** Human-facing identifier shown in the UI, e.g. "STU-001". */
  code: string;
  name: string;
  rollNo?: string;
};

export type Classroom = {
  id: ID;
  /** URL slug, e.g. "class-10-a". */
  slug: string;
  name: string;
  description?: string;
  subjects: Subject[];
  students: Student[];
  tests: Test[];
  createdAt: string;
};

/**
 * A test moves through exactly three states. There is no draft/publish step —
 * a test exists the moment it is created and starts collecting answers.
 */
export type TestStatus = "collecting" | "grading" | "graded";

export type Test = {
  id: ID;
  /** ISO date (YYYY-MM-DD). The only required field when creating a test. */
  date: string;
  title?: string;
  subjectId?: ID;
  /** Free-text grading guidance for the AI. No rubric builder, no parameters. */
  instructions?: string;
  maxMarks: number;
  status: TestStatus;
  createdAt: string;
};

export type SubmissionStatus =
  | "awaiting"
  | "queued"
  | "grading"
  | "graded"
  | "failed";

export type QuestionMark = {
  number: string;
  awarded: number;
  outOf: number;
  note: string;
};

export type Submission = {
  id: ID;
  testId: ID;
  studentId: ID;
  fileName?: string;
  /** Set when the file was matched to a student by AI rather than by the teacher. */
  matchedByAI?: boolean;
  status: SubmissionStatus;
  score?: number;
  outOf?: number;
  summary?: string;
  questions?: QuestionMark[];
  /** True when the AI could not read the work confidently and wants a human look. */
  needsReview?: boolean;
  /** Set when a teacher overrides the AI score. */
  overridden?: boolean;
  gradedAt?: string;
  error?: string;
};

export type AttendanceMark = "present" | "absent";

/** Keyed `${testId}:${studentId}`. Missing entries default to present. */
export type AttendanceMap = Record<string, AttendanceMark>;

export type Database = {
  version: number;
  teacherName: string;
  classrooms: Classroom[];
  submissions: Submission[];
  attendance: AttendanceMap;
};

/* ---------- Derived view models ---------- */

export type TestProgress = {
  expected: number;
  submitted: number;
  graded: number;
  absent: number;
  needsReview: number;
  averagePercent: number | null;
};

export type MarksRow = {
  student: Student;
  /** subjectId -> average percent across graded tests in that subject. */
  bySubject: Record<ID, number | null>;
  /** testId -> percent. */
  byTest: Record<ID, number | null>;
  average: number | null;
  attendancePercent: number | null;
  needsReview: number;
};
