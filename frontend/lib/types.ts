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
  portal_token?: string;
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
  mime_type?: string;
  status: string;
  score?: number;
  max_score?: number;
  confidence?: number;
  review_required: boolean;
  feedback?: { summary?: string; teacher_action?: string; teacher_note?: string };
  extracted_answers?: { questions?: Record<string, unknown>[]; document_notes?: string };
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

export type TeacherSettings = {
  user_id: string;
  gemini_model: string;
  confidence_threshold: number;
  default_subject: string;
  default_grade_level?: string | null;
  default_grading_rules: string;
};

export type AuditLog = {
  id: string;
  entity_type: string;
  entity_id?: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
};

export type AssignmentVersion = {
  id: string;
  assignment_id: string;
  version_number: number;
  title: string;
  description?: string;
  total_points: number;
  answer_key: Record<string, unknown>;
  rubric: Record<string, unknown>;
  change_note?: string;
  created_at: string;
};
