"use client";

/**
 * The API client.
 *
 * Every classroom, student, test, mark and attendance record lives on the
 * server. Nothing in this app writes teaching data to the browser.
 */
import { AuthError } from "./auth";
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}
async function request(path, init = {}) {
  const headers = new Headers(init.headers);
  // FormData sets its own multipart boundary; setting the header breaks it.
  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  let response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Cannot reach GradeFlow. Check your connection.", 0);
  }
  if (response.status === 401) throw new AuthError("Your session has expired. Sign in again.");
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = typeof body?.detail === "string" ? body.detail : "Something went wrong.";
    throw new ApiError(detail, response.status);
  }
  if (response.status === 204) return undefined;
  return await response.json();
}

/* ---------- classrooms ---------- */

export const listClassrooms = () => request("/classrooms");
export const getClassroom = (slug) => request(`/classrooms/by-slug/${slug}`);
export const createClassroom = (body) =>
  request("/classrooms", {
    method: "POST",
    body: JSON.stringify(body),
  });
export const updateClassroom = (id, body) =>
  request(`/classrooms/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
export const deleteClassroom = (id) =>
  request(`/classrooms/${id}`, {
    method: "DELETE",
  });

/* ---------- subjects ---------- */

export const createSubject = (classroomId, name) =>
  request(`/classrooms/${classroomId}/subjects`, {
    method: "POST",
    body: JSON.stringify({
      name,
    }),
  });
export const renameSubject = (id, name) =>
  request(`/subjects/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      name,
    }),
  });
export const deleteSubject = (id) =>
  request(`/subjects/${id}`, {
    method: "DELETE",
  });

/* ---------- students ---------- */

export const addStudents = (classroomId, students) =>
  request(`/classrooms/${classroomId}/students`, {
    method: "POST",
    body: JSON.stringify({
      students,
    }),
  });
export const updateStudent = (id, body) =>
  request(`/students/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
export const deleteStudent = (id) =>
  request(`/students/${id}`, {
    method: "DELETE",
  });

/** Invalidates the old results link and returns a fresh token. */
export const rotateShareLink = (id) =>
  request(`/students/${id}/rotate-share-link`, {
    method: "POST",
  });

/* ---------- tests ---------- */

export const createTest = (classroomId, body) =>
  request(`/classrooms/${classroomId}/tests`, {
    method: "POST",
    body: JSON.stringify(body),
  });
export const getTest = (id) => request(`/tests/${id}`);
export const updateTest = (id, body) =>
  request(`/tests/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
export const deleteTest = (id) =>
  request(`/tests/${id}`, {
    method: "DELETE",
  });
export const setAttendance = (testId, entries) =>
  request(`/tests/${testId}/attendance`, {
    method: "POST",
    body: JSON.stringify({
      entries,
    }),
  });

/** Read a photographed class register into a list the teacher can edit. */
export function extractStudents(classroomId, file) {
  const form = new FormData();
  form.append("file", file);
  return request(`/classrooms/${classroomId}/students/extract`, {
    method: "POST",
    body: form,
  });
}

/* ---------- the question paper ---------- */

export const saveQuestions = (testId, questions) =>
  request(`/tests/${testId}/questions`, {
    method: "PUT",
    body: JSON.stringify({ questions }),
  });

/** Read a photographed question paper. Images and PDFs both work. */
export function extractQuestions(testId, file) {
  const form = new FormData();
  form.append("file", file);
  return request(`/tests/${testId}/questions/extract`, {
    method: "POST",
    body: form,
  });
}

/* ---------- answer sheets ---------- */

export function uploadSheets(testId, files) {
  const form = new FormData();
  files.forEach((file) => form.append("files", file));
  return request(`/tests/${testId}/submissions`, {
    method: "POST",
    body: form,
  });
}

/** The sheet itself, so a teacher can check a mark against the paper. */
export async function fetchSheet(submissionId) {
  const response = await fetch(`/api/sheets/${submissionId}/file`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) throw new ApiError("Could not load the answer sheet.", response.status);
  return URL.createObjectURL(await response.blob());
}
export const reviewSubmission = (id, body) =>
  request(`/sheets/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
export const deleteSubmission = (id) =>
  request(`/sheets/${id}`, {
    method: "DELETE",
  });
export const gradeTest = (testId) =>
  request(`/tests/${testId}/grade`, {
    method: "POST",
  });
export const regradeTest = (testId, correction, onlyFlagged = false) =>
  request(`/tests/${testId}/regrade`, {
    method: "POST",
    body: JSON.stringify({
      correction,
      only_flagged: onlyFlagged,
    }),
  });

/* ---------- sharing ---------- */

export async function fetchShared(token) {
  const response = await fetch(`/api/share/${token}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new ApiError("This results link is not valid.", response.status);
  return await response.json();
}
