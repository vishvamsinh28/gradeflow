"use client";

/**
 * Server-backed workspace.
 *
 * A thin cache over the API — never a source of truth. Every mutation goes to
 * the server and the cache is refreshed from what comes back, so a reload, a
 * second device or a cleared browser all show the same thing.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import * as api from "./api";
import { ApiError } from "./api";
let cache = {
  classrooms: null,
  byId: {},
};
const listeners = new Set();
function emit() {
  cache = {
    ...cache,
  };
  for (const listener of listeners) listener();
}
function subscribe(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
const snapshot = () => cache;

/** Dropped on sign-out so one teacher's data never survives into another's session. */
export function clearCache() {
  cache = {
    classrooms: null,
    byId: {},
  };
  emit();
}
function useCache() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/**
 * Run a load, and stand guard over the OUTCOME.
 *
 * Two wedges observed in production, both leaving a permanent skeleton with
 * the data already fetched: an async continuation that never resumes, and a
 * completed React render that never commits (the alternate fiber held the
 * finished state). The guard doesn't trust either layer — until the render
 * itself shows data or a verdict, it re-fires the load (fresh task, covers a
 * lost continuation) and forces a state update (fresh commit, covers a lost
 * one). `outcomeVisible` is evaluated in render, so it reports what the user
 * actually sees.
 */
function useGuardedLoad(reload, outcomeVisible, shouldRun = true) {
  const outcomeRef = useRef(outcomeVisible);
  outcomeRef.current = outcomeVisible;
  const [, forceRender] = useState(0);
  useEffect(() => {
    if (!shouldRun) return;
    void reload();
    let tries = 0;
    const guard = window.setInterval(() => {
      if (outcomeRef.current || tries >= 8) {
        window.clearInterval(guard);
        return;
      }
      tries += 1;
      void reload();
      forceRender((n) => n + 1);
    }, 1500);
    return () => window.clearInterval(guard);
    // outcomeRef mirrors render state; shouldRun only gates the first run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);
}

/* ---------- loading ---------- */

export function useClassrooms() {
  const { classrooms } = useCache();
  const [loading, setLoading] = useState(classrooms === null);
  const [error, setError] = useState(null);
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
  useGuardedLoad(reload, classrooms !== null || Boolean(error), cache.classrooms === null);
  useEffect(() => {
    if (cache.classrooms !== null) setLoading(false);
  }, []);
  return {
    data: classrooms,
    loading,
    error,
    reload,
  };
}
export function useClassroom(slug) {
  const { classrooms } = useCache();
  const found = classrooms?.find((classroom) => classroom.slug === slug) ?? null;
  const [loading, setLoading] = useState(!found);
  // "Not found" is the server's verdict (a real 404), never an inference from
  // an empty cache — a fetch still in flight must read as loading, or a slow
  // first load renders a false "deleted" screen.
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState(null);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const fresh = await api.getClassroom(slug);
      replaceClassroom(fresh);
      setMissing(false);
      setError(null);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 404) setMissing(true);
      else setError(caught instanceof Error ? caught.message : "Could not load this classroom.");
    } finally {
      setLoading(false);
    }
  }, [slug]);
  // Already cached from the dashboard list — no reason to fetch again on every
  // navigation. `reload()` is still there when freshness matters.
  useGuardedLoad(reload, Boolean(found) || missing || Boolean(error), !found);
  return {
    data: found,
    loading: loading && !found,
    missing,
    error,
    reload,
  };
}
export function useTestWorkspace(testId) {
  const { byId } = useCache();
  const found = byId[testId] ?? null;
  const [loading, setLoading] = useState(!found);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState(null);
  const reload = useCallback(async () => {
    try {
      cache.byId = {
        ...cache.byId,
        [testId]: await api.getTest(testId),
      };
      setMissing(false);
      setError(null);
      emit();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 404) setMissing(true);
      else setError(caught instanceof Error ? caught.message : "Could not load this test.");
    } finally {
      setLoading(false);
    }
  }, [testId]);
  useGuardedLoad(reload, Boolean(found) || missing || Boolean(error));

  // Grading happens on the server, so the only way to watch it is to ask.
  const grading =
    found?.test.status === "grading" ||
    (found?.submissions ?? []).some((s) => s.status === "queued" || s.status === "grading");
  useEffect(() => {
    if (!grading) return;
    const timer = window.setInterval(() => void reload(), 2500);
    return () => window.clearInterval(timer);
  }, [grading, reload]);
  return {
    data: found,
    loading,
    missing,
    error,
    reload,
  };
}
function replaceClassroom(fresh) {
  const existing = cache.classrooms ?? [];
  const index = existing.findIndex((classroom) => classroom.id === fresh.id);
  cache.classrooms =
    index >= 0
      ? existing.map((classroom) => (classroom.id === fresh.id ? fresh : classroom))
      : [fresh, ...existing];
  emit();
}
function dropClassroom(id) {
  cache.classrooms = (cache.classrooms ?? []).filter((classroom) => classroom.id !== id);
  emit();
}
function patchTest(testId, patch) {
  const existing = cache.byId[testId];
  if (!existing) return;
  cache.byId = {
    ...cache.byId,
    [testId]: {
      ...existing,
      ...patch,
    },
  };
  emit();
}
function patchClassroom(id, patch) {
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
function syncClassroomFromTest(workspace) {
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
function sortTests(tests) {
  return [...tests].sort((a, b) => b.test_date.localeCompare(a.test_date));
}

/** One fetch, both caches. Replaces the getTest + getClassroom pair. */
async function refreshTest(testId) {
  const workspace = await api.getTest(testId);
  cache.byId = {
    ...cache.byId,
    [testId]: workspace,
  };
  syncClassroomFromTest(workspace);
  emit();
  return workspace;
}

/* ---------- mutations ----------
   Each returns the server's answer and refreshes the cache from it. */

export async function createClassroom(input) {
  const created = await api.createClassroom(input);
  replaceClassroom(created);
  return created;
}
export async function updateClassroom(id, input) {
  const updated = await api.updateClassroom(id, input);
  replaceClassroom(updated);
  return updated;
}
export async function removeClassroom(id) {
  await api.deleteClassroom(id);
  dropClassroom(id);
}
export async function addSubject(classroom, name) {
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
export async function renameSubject(classroom, id, name) {
  const updated = await api.renameSubject(id, name);
  patchClassroom(classroom.id, (room) => ({
    ...room,
    subjects: room.subjects.map((subject) => (subject.id === id ? updated : subject)),
  }));
}
export async function removeSubject(classroom, id) {
  await api.deleteSubject(id);
  patchClassroom(classroom.id, (room) => ({
    ...room,
    subjects: room.subjects.filter((subject) => subject.id !== id),
    // The server clears the link rather than deleting the tests behind it.
    tests: room.tests.map((test) =>
      test.subject_id === id
        ? {
            ...test,
            subject_id: null,
          }
        : test,
    ),
  }));
}
export async function addStudents(classroom, students) {
  const created = await api.addStudents(classroom.id, students);
  patchClassroom(classroom.id, (room) => ({
    ...room,
    students: [...room.students, ...created],
  }));
  return created.length;
}
export async function updateStudent(classroom, id, input) {
  const updated = await api.updateStudent(id, input);
  patchClassroom(classroom.id, (room) => ({
    ...room,
    students: room.students.map((student) => (student.id === id ? updated : student)),
  }));
}
export async function removeStudent(classroom, id) {
  await api.deleteStudent(id);
  patchClassroom(classroom.id, (room) => ({
    ...room,
    students: room.students.filter((student) => student.id !== id),
    submissions: room.submissions.filter((row) => row.student_id !== id),
    attendance: room.attendance.filter((row) => row.student_id !== id),
  }));
}
export async function createTest(classroom, input) {
  const test = await api.createTest(classroom.id, input);
  patchClassroom(classroom.id, (room) => ({
    ...room,
    tests: sortTests([test, ...room.tests]),
  }));
  return test;
}
export async function updateTest(testId, input) {
  await api.updateTest(testId, input);
  await refreshTest(testId);
}
export async function removeTest(testId) {
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
export async function setAttendance(testId, entries) {
  await api.setAttendance(testId, entries);
  await refreshTest(testId);
}
export async function uploadSheets(testId, files, studentId) {
  const outcome = await api.uploadSheets(testId, files, studentId);
  await refreshTest(testId);
  return outcome;
}
export async function removeSubmission(testId, submissionId) {
  await api.deleteSubmission(submissionId);
  await refreshTest(testId);
}
export async function reviewSubmission(testId, submissionId, input) {
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
export async function saveQuestions(testId, questions) {
  await api.saveQuestions(testId, questions);
  // The paper sets the test's total, so the whole workspace is refreshed rather
  // than patched — max_marks changes with it.
  await refreshTest(testId);
}

export async function gradeTest(testId) {
  await api.gradeTest(testId);
  const cached = cache.byId[testId];
  // The poll picks the status up regardless; this only avoids a flash of the
  // old badge when the test is already on screen.
  if (cached)
    patchTest(testId, {
      test: {
        ...cached.test,
        status: "grading",
      },
    });
}
export async function regradeTest(testId, correction, onlyFlagged = false) {
  const result = await api.regradeTest(testId, correction, onlyFlagged);
  await refreshTest(testId);
  return result;
}

/* ---------- derived, for display ---------- */

export function testProgress(test, students, submissions, attendance) {
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
export function attendanceOf(attendance, testId, studentId) {
  return (
    attendance.find((row) => row.test_id === testId && row.student_id === studentId)?.mark ??
    "present"
  );
}
export function gradeFor(percent, scale) {
  if (percent === null || !scale.length) return null;
  return scale.find((band) => percent >= band.min)?.label ?? null;
}
