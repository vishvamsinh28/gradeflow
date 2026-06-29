export type User = {
  id: string;
  email: string;
  full_name: string;
};

export type Classroom = {
  id: string;
  name: string;
  subject: string;
  grade_level?: string;
  students?: Student[];
  assignments?: Assignment[];
};

export type Student = {
  id: string;
  name: string;
  external_id?: string;
};

export type Assignment = {
  id: string;
  class_id: string;
  title: string;
  description?: string;
  total_points: number;
  answer_key: Record<string, unknown>;
  rubric: Record<string, unknown>;
  status: string;
  students?: Student[];
};

export type Submission = {
  id: string;
  original_filename: string;
  status: string;
  score?: number;
  max_score?: number;
  confidence?: number;
  review_required: boolean;
  feedback?: { summary?: string; teacher_action?: string; teacher_note?: string };
  students?: { name: string };
  student?: Student;
  assignment?: Assignment;
  question_results?: QuestionResult[];
};

export type QuestionResult = {
  id: string;
  question_number: string;
  student_work: string;
  score: number;
  max_score: number;
  feedback: string;
  confidence: number;
  error_category?: string;
};
