/**
 * Domain types, mirroring the server. Field names are snake_case because they
 * come off the API unchanged — one shape, no mapping layer to drift.
 */

export type ID = string;

export type GradeBand = { label: string; min: number };

export type Subject = { id: ID; classroom_id: ID; name: string; position: number };

export type Student = {
  id: ID;
  classroom_id: ID;
  code: string;
  name: string;
  roll_no: string | null;
  share_token: string;
};

export type TestStatus = "collecting" | "grading" | "graded";

export type Test = {
  id: ID;
  classroom_id: ID;
  subject_id: ID | null;
  test_date: string;
  title: string | null;
  instructions: string | null;
  max_marks: number;
  status: TestStatus;
};

export type SubmissionStatus = "awaiting" | "queued" | "grading" | "graded" | "failed";

export type QuestionMark = { number: string; awarded: number; out_of: number; note: string };

export type Submission = {
  id: ID;
  test_id: ID;
  student_id: ID;
  file_name: string | null;
  mime_type: string | null;
  source_page_from: number | null;
  source_page_to: number | null;
  matched_by_ai: boolean;
  status: SubmissionStatus;
  score: number | null;
  out_of: number | null;
  summary: string | null;
  questions: QuestionMark[];
  needs_review: boolean;
  overridden: boolean;
  error_message: string | null;
  graded_at: string | null;
};

export type AttendanceMark = "present" | "absent";

export type AttendanceRow = { test_id: ID; student_id: ID; mark: AttendanceMark };

export type Classroom = {
  id: ID;
  owner_id: ID;
  slug: string;
  name: string;
  description: string | null;
  grade_scale: GradeBand[];
  subjects: Subject[];
  students: Student[];
  tests: Test[];
  submissions: Submission[];
  attendance: AttendanceRow[];
};

export type TestWorkspace = {
  test: Test;
  classroom: Classroom;
  students: Student[];
  submissions: Submission[];
  attendance: AttendanceRow[];
};

export type UploadOutcome = {
  submissions: Submission[];
  /** Sheets that could not be matched to a student — never guessed at. */
  unmatched: string[];
  awaiting_upload: { id: ID; name: string; code: string }[];
};

export type ClassroomReport = {
  classroom: { id: ID; name: string; grade_scale: GradeBand[] };
  subjects: { id: ID; name: string }[];
  tests: number;
  rows: {
    student_id: ID;
    code: string;
    name: string;
    roll_no: string | null;
    share_token: string;
    subjects: Record<ID, number | null>;
    average: number | null;
    grade: string | null;
    tests_taken: number;
    absences: number;
  }[];
};

export type ShareResult = {
  student: { name: string; code?: string };
  classroom: { name: string };
  missed?: { title: string; date: string }[];
  results: {
    title: string;
    subject: string | null;
    date: string;
    score: number | null;
    out_of: number | null;
    percent: number | null;
    grade: string | null;
    summary: string | null;
    questions: QuestionMark[];
  }[];
};

/* ---------- derived, computed client-side for display only ---------- */

export type TestProgress = {
  expected: number;
  submitted: number;
  graded: number;
  absent: number;
  needsReview: number;
  averagePercent: number | null;
};
