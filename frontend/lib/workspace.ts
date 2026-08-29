"use client";

/**
 * Server-backed workspace.
 *
 * A thin cache over the API — never a source of truth. Every mutation goes to
 * the server and the cache is refreshed from what comes back, so a reload, a
 * second device or a cleared browser all show the same thing.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import * as api from "./api";
import type {
  AttendanceMark,
  Classroom,
  ID,
  Submission,
  TestProgress,
  Test,
  TestWorkspace,
} from "./types";

type Cache = {
  classrooms: Classroom[] | null;
  byId: Record<ID, TestWorkspace>;
};

let cache: Cache = { classrooms: null, byId: {} };
const listeners = new Set<() => void>();

function emit() {
  cache = { ...cache };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const snapshot = () => cache;

/** Dropped on sign-out so one teacher's data never survives into another's session. */
export function clearCache() {
  cache = { classrooms: null, byId: {} };
  emit();
}

function useCache(): Cache {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/* ---------- loading ---------- */

export type Loadable<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

export function useClassrooms(): Loadable<Classroom[]> {
  const { classrooms } = useCache();
  const [loading, setLoading] = useState(classrooms === null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      cache.classrooms = await api.listClassrooms();
      setError(null);
      emit();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load your classrooms.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (cache.classrooms === null) void reload();
    else setLoading(false);
  }, [reload]);

  return { data: classrooms, loading, error, reload };
}

export function useClassroom(slug: string): Loadable<Classroom> {
  const { classrooms } = useCache();
  const found = classrooms?.find((classroom) => classroom.slug === slug) ?? null;
  const [loading, setLoading] = useState(!found);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const fresh = await api.getClassroom(slug);
      replaceClassroom(fresh);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load this classroom.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    // Already cached from the dashboard list — no reason to fetch it again on
    // every navigation. `reload()` is still there when freshness matters.
    if (found) {
      setLoading(false);
      return;
    }
    void reload();
  }, [reload, found]);

  return { data: found, loading: loading && !found, error, reload };
}

export function useTestWorkspace(testId: string): Loadable<TestWorkspace> {
  const { byId } = useCache();
  const found = byId[testId] ?? null;
  const [loading, setLoading] = useState(!found);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      cache.byId = { ...cache.byId, [testId]: await api.getTest(testId) };
      setError(null);
      emit();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load this test.");
    } finally {
      setLoading(false);
    }
  }, [testId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Grading happens on the server, so the only way to watch it is to ask.
  const grading =
    found?.test.status === "grading" ||
    (found?.submissions ?? []).some((s) => s.status === "queued" || s.status === "grading");

  useEffect(() => {
    if (!grading) return;
    const timer = window.setInterval(() => void reload(), 2500);
    return () => window.clearInterval(timer);
  }, [grading, reload]);

  return { data: found, loading, error, reload };
}

function replaceClassroom(fresh: Classroom) {
  const existing = cache.classrooms ?? [];
  const index = existing.findIndex((classroom) => classroom.id === fresh.id);
  cache.classrooms =
    index >= 0
      ? existing.map((classroom) => (classroom.id === fresh.id ? fresh : classroom))
      : [fresh, ...existing];
  emit();
}

function dropClassroom(id: ID) {
  cache.classrooms = (cache.classrooms ?? []).filter((classroom) => classroom.id !== id);
  emit();
}

function patchTest(testId: ID, patch: Partial<TestWorkspace>) {
  const existing = cache.byId[testId];
  if (!existing) return;
  cache.byId = { ...cache.byId, [testId]: { ...existing, ...patch } };
  emit();
}

function patchClassroom(id: ID, patch: (room: Classroom) => Classroom) {
  const classrooms = cache.classrooms;
  if (!classrooms) return;
  cache.classrooms = classrooms.map((room) => (room.id === id ? patch(room) : room));
  emit();
}

/**
 * Fold a freshly-fetched test back into the cached classroom.
 *
 * The dashboard reads its progress counts out of `cache.classrooms`, so a test
 * mutation that only refreshed `cache.byId` left it showing stale numbers until
 * a full page reload — mark a student absent, go back, still "0 of 4".
 */
function syncClassroomFromTest(workspace: TestWorkspace) {
  const testId = workspace.test.id;
  patchClassroom(workspace.classroom.id, (room) => ({
    ...room,
    students: workspace.students,
    tests: room.tests.some((test) => test.id === testId)
      ? room.tests.map((test) => (test.id === testId ? workspace.test : test))
      : sortTests([workspace.test, ...room.tests]),
    submissions: [
      ...room.submissions.filter((row) => row.test_id !== testId),
      ...workspace.submissions,
    ],
    attendance: [
      ...room.attendance.filter((row) => row.test_id !== testId),
      ...workspace.attendance,
    ],
  }));
}

/** Matches the server's ordering, so a locally-inserted test lands where a refetch would put it. */
function sortTests<T extends { test_date: string }>(tests: T[]): T[] {
  return [...tests].sort((a, b) => b.test_date.localeCompare(a.test_date));
}

/** One fetch, both caches. Replaces the getTest + getClassroom pair. */
async function refreshTest(testId: ID): Promise<TestWorkspace> {
  const workspace = await api.getTest(testId);
  cache.byId = { ...cache.byId, [testId]: workspace };
  syncClassroomFromTest(workspace);
  emit();
  return workspace;
}

/* ---------- mutations ----------
   Each returns the server's answer and refreshes the cache from it. */

export async function createClassroom(input: {
  name: string;
  description?: string;
  subjects?: string[];
}): Promise<Classroom> {
  const created = await api.createClassroom(input);
  replaceClassroom(created);
  return created;
}

export async function updateClassroom(
  id: ID,
  input: Parameters<typeof api.updateClassroom>[1],
): Promise<Classroom> {
  const updated = await api.updateClassroom(id, input);
  replaceClassroom(updated);
  return updated;
}

export async function removeClassroom(id: ID): Promise<void> {
  await api.deleteClassroom(id);
  dropClassroom(id);
}

export async function addSubject(classroom: Classroom, name: string) {
  const created = await api.createSubject(classroom.id, name);
  patchClassroom(classroom.id, (room) => ({
    ...room,
    // The server upserts on (classroom, name), so re-adding an existing subject
    // returns the row that is already here rather than a second one.
    subjects: room.subjects.some((subject) => subject.id === created.id)
      ? room.subjects.map((subject) => (subject.id === created.id ? created : subject))
      : [...room.subjects, created],
  }));
}

export async function renameSubject(classroom: Classroom, id: ID, name: string) {
  const updated = await api.renameSubject(id, name);
  patchClassroom(classroom.id, (room) => ({
    ...room,
    subjects: room.subjects.map((subject) => (subject.id === id ? updated : subject)),
  }));
}

export async function removeSubject(classroom: Classroom, id: ID) {
  await api.deleteSubject(id);
  patchClassroom(classroom.id, (room) => ({
    ...room,
    subjects: room.subjects.filter((subject) => subject.id !== id),
    // The server clears the link rather than deleting the tests behind it.
    tests: room.tests.map((test) => (test.subject_id === id ? { ...test, subject_id: null } : test)),
  }));
}

export async function addStudents(
  classroom: Classroom,
  students: { name: string; roll_no?: string }[],
): Promise<number> {
  const created = await api.addStudents(classroom.id, students);
  patchClassroom(classroom.id, (room) => ({ ...room, students: [...room.students, ...created] }));
  return created.length;
}

export async function updateStudent(
  classroom: Classroom,
  id: ID,
  input: { name?: string; roll_no?: string },
) {
  const updated = await api.updateStudent(id, input);
  patchClassroom(classroom.id, (room) => ({
    ...room,
    students: room.students.map((student) => (student.id === id ? updated : student)),
  }));
}

export async function removeStudent(classroom: Classroom, id: ID) {
  await api.deleteStudent(id);
  patchClassroom(classroom.id, (room) => ({
    ...room,
    students: room.students.filter((student) => student.id !== id),
    submissions: room.submissions.filter((row) => row.student_id !== id),
    attendance: room.attendance.filter((row) => row.student_id !== id),
  }));
}

export async function createTest(
  classroom: Classroom,
  input: Parameters<typeof api.createTest>[1],
): Promise<Test> {
  const test = await api.createTest(classroom.id, input);
  patchClassroom(classroom.id, (room) => ({ ...room, tests: sortTests([test, ...room.tests]) }));
  return test;
}

export async function updateTest(testId: ID, input: Parameters<typeof api.updateTest>[1]) {
  await api.updateTest(testId, input);
  await refreshTest(testId);
}

export async function removeTest(testId: ID) {
  const classroomId = cache.byId[testId]?.classroom.id;
  await api.deleteTest(testId);
  const { [testId]: _removed, ...rest } = cache.byId;
  cache.byId = rest;
  if (classroomId) {
    patchClassroom(classroomId, (room) => ({
      ...room,
      tests: room.tests.filter((test) => test.id !== testId),
      submissions: room.submissions.filter((row) => row.test_id !== testId),
      attendance: room.attendance.filter((row) => row.test_id !== testId),
    }));
  } else {
    emit();
  }
}

export async function setAttendance(
  testId: ID,
  entries: { student_id: ID; mark: AttendanceMark }[],
) {
  await api.setAttendance(testId, entries);
  await refreshTest(testId);
}

export async function uploadSheets(testId: ID, files: File[]) {
  const outcome = await api.uploadSheets(testId, files);
  await refreshTest(testId);
  return outcome;
}

export async function removeSubmission(testId: ID, submissionId: ID) {
  await api.deleteSubmission(submissionId);
  await refreshTest(testId);
}

export async function reviewSubmission(
  testId: ID,
  submissionId: ID,
  input: { score?: number; accept?: boolean },
): Promise<Submission> {
  const updated = await api.reviewSubmission(submissionId, input);
  const workspace = cache.byId[testId];
  if (workspace) {
    patchTest(testId, {
      submissions: workspace.submissions.map((s) => (s.id === updated.id ? updated : s)),
    });
    patchClassroom(workspace.classroom.id, (room) => ({
      ...room,
      submissions: room.submissions.map((s) => (s.id === updated.id ? updated : s)),
    }));
  }
  return updated;
}

export async function gradeTest(testId: ID) {
  await api.gradeTest(testId);
  patchTest(testId, { test: { ...cache.byId[testId].test, status: "grading" } });
}

export async function regradeTest(testId: ID, correction: string, onlyFlagged = false) {
  const result = await api.regradeTest(testId, correction, onlyFlagged);
  await refreshTest(testId);
  return result;
}

/* ---------- derived, for display ---------- */

export function testProgress(
  test: Test,
  students: { id: ID }[],
  submissions: Submission[],
  attendance: { student_id: ID; mark: AttendanceMark }[],
): TestProgress {
  const absentIds = new Set(
    attendance.filter((row) => row.mark === "absent").map((row) => row.student_id),
  );
  const mine = submissions.filter((s) => s.test_id === test.id);
  const graded = mine.filter((s) => s.status === "graded");
  const percents = graded
    .filter((s) => s.out_of)
    .map((s) => ((s.score ?? 0) / (s.out_of || 1)) * 100);

  return {
    expected: students.filter((student) => !absentIds.has(student.id)).length,
    submitted: mine.length,
    graded: graded.length,
    absent: students.filter((student) => absentIds.has(student.id)).length,
    needsReview: graded.filter((s) => s.needs_review).length,
    averagePercent: percents.length
      ? percents.reduce((sum, value) => sum + value, 0) / percents.length
      : null,
  };
}

export function attendanceOf(
  attendance: { test_id: ID; student_id: ID; mark: AttendanceMark }[],
  testId: ID,
  studentId: ID,
): AttendanceMark {
  return (
    attendance.find((row) => row.test_id === testId && row.student_id === studentId)?.mark ??
    "present"
  );
}

export function gradeFor(percent: number | null, scale: { label: string; min: number }[]) {
  if (percent === null || !scale.length) return null;
  return scale.find((band) => percent >= band.min)?.label ?? null;
}
