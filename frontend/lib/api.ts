"use client";

/**
 * The API client.
 *
 * Every classroom, student, test, mark and attendance record lives on the
 * server. Nothing in this app writes teaching data to the browser.
 */

import { authHeaders, AuthError } from "./auth";
import { apiUrl } from "./runtime-config";
import type {
  Classroom,
  GradeBand,
  ShareResult,
  Student,
  Submission,
  Test,
  TestWorkspace,
  UploadOutcome,
} from "./types";



export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function apiConfigured(): boolean {
  return Boolean(apiUrl());
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!apiUrl()) {
    throw new ApiError(
      "No API is configured. Set API_URL so your work is saved.",
      0,
    );
  }

  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  for (const [key, value] of Object.entries(authHeaders())) headers.set(key, value);

  let response: Response;
  try {
    response = await fetch(`${apiUrl()}${path}`, {
      ...init,
      headers,
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Cannot reach the GradeFlow server. Check that it is running.", 0);
  }

  if (response.status === 401) throw new AuthError("Your session has expired. Sign in again.");
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: unknown } | null;
    const detail = typeof body?.detail === "string" ? body.detail : "Something went wrong.";
    throw new ApiError(detail, response.status);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/* ---------- classrooms ---------- */

export const listClassrooms = () => request<Classroom[]>("/classrooms");

export const getClassroom = (slug: string) => request<Classroom>(`/classrooms/${slug}`);

export const createClassroom = (body: {
  name: string;
  description?: string;
  subjects?: string[];
}) => request<Classroom>("/classrooms", { method: "POST", body: JSON.stringify(body) });

export const updateClassroom = (
  id: string,
  body: { name?: string; description?: string; grade_scale?: GradeBand[] },
) => request<Classroom>(`/classrooms/${id}`, { method: "PATCH", body: JSON.stringify(body) });

export const deleteClassroom = (id: string) =>
  request<void>(`/classrooms/${id}`, { method: "DELETE" });

/* ---------- subjects ---------- */

export const createSubject = (classroomId: string, name: string) =>
  request<{ id: string; name: string }>(`/classrooms/${classroomId}/subjects`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });

export const renameSubject = (id: string, name: string) =>
  request<{ id: string; name: string }>(`/subjects/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });

export const deleteSubject = (id: string) => request<void>(`/subjects/${id}`, { method: "DELETE" });

/* ---------- students ---------- */

export const addStudents = (
  classroomId: string,
  students: { name: string; roll_no?: string }[],
) =>
  request<Student[]>(`/classrooms/${classroomId}/students`, {
    method: "POST",
    body: JSON.stringify({ students }),
  });

export const updateStudent = (id: string, body: { name?: string; roll_no?: string }) =>
  request<Student>(`/students/${id}`, { method: "PATCH", body: JSON.stringify(body) });

export const deleteStudent = (id: string) => request<void>(`/students/${id}`, { method: "DELETE" });

/** Invalidates the old results link and returns a fresh token. */
export const rotateShareLink = (id: string) =>
  request<{ share_token: string }>(`/students/${id}/rotate-share-link`, { method: "POST" });

/* ---------- tests ---------- */

export const createTest = (
  classroomId: string,
  body: {
    test_date: string;
    title?: string;
    subject_id?: string;
    instructions?: string;
    max_marks?: number;
  },
) => request<Test>(`/classrooms/${classroomId}/tests`, { method: "POST", body: JSON.stringify(body) });

export const getTest = (id: string) => request<TestWorkspace>(`/tests/${id}`);

export const updateTest = (
  id: string,
  body: {
    test_date?: string;
    title?: string;
    subject_id?: string | null;
    instructions?: string;
    max_marks?: number;
  },
) => request<Test>(`/tests/${id}`, { method: "PATCH", body: JSON.stringify(body) });

export const deleteTest = (id: string) => request<void>(`/tests/${id}`, { method: "DELETE" });

export const setAttendance = (
  testId: string,
  entries: { student_id: string; mark: "present" | "absent" }[],
) =>
  request<{ test_id: string; student_id: string; mark: string }[]>(`/tests/${testId}/attendance`, {
    method: "POST",
    body: JSON.stringify({ entries }),
  });

/** Read a photographed class register into a list the teacher can edit. */
export function extractStudents(
  classroomId: string,
  file: File,
): Promise<{ students: { name: string; roll_no: string | null }[] }> {
  const form = new FormData();
  form.append("file", file);
  return request(`/classrooms/${classroomId}/students/extract`, { method: "POST", body: form });
}

/* ---------- answer sheets ---------- */

export function uploadSheets(testId: string, files: File[]): Promise<UploadOutcome> {
  const form = new FormData();
  files.forEach((file) => form.append("files", file));
  return request<UploadOutcome>(`/tests/${testId}/submissions`, { method: "POST", body: form });
}

/** The sheet itself, so a teacher can check a mark against the paper. */
export async function fetchSheet(submissionId: string): Promise<string> {
  if (!apiUrl()) throw new ApiError("No API is configured.", 0);
  const response = await fetch(`${apiUrl()}/sheets/${submissionId}/file`, {
    headers: authHeaders(),
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) throw new ApiError("Could not load the answer sheet.", response.status);
  return URL.createObjectURL(await response.blob());
}

export const reviewSubmission = (id: string, body: { score?: number; accept?: boolean }) =>
  request<Submission>(`/sheets/${id}`, { method: "PATCH", body: JSON.stringify(body) });

export const deleteSubmission = (id: string) => request<void>(`/sheets/${id}`, { method: "DELETE" });

export const gradeTest = (testId: string) =>
  request<{ status: string }>(`/tests/${testId}/grade`, { method: "POST" });

export const regradeTest = (testId: string, correction: string, onlyFlagged = false) =>
  request<{ status: string; count: number }>(`/tests/${testId}/regrade`, {
    method: "POST",
    body: JSON.stringify({ correction, only_flagged: onlyFlagged }),
  });

/* ---------- sharing ---------- */

export async function fetchShared(token: string): Promise<ShareResult> {
  if (!apiUrl()) throw new ApiError("No API is configured.", 0);
  const response = await fetch(`${apiUrl()}/share/${token}`, { cache: "no-store" });
  if (!response.ok) throw new ApiError("This results link is not valid.", response.status);
  return (await response.json()) as ShareResult;
}
