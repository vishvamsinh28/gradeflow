/**
 * Marking one sheet, and settling the test around it.
 *
 * Both the queue worker and the inline development path call `gradeOne`, so
 * there is a single description of what grading a sheet means.
 */
import { db } from "./db";
import { gradeSheet } from "./grader";
import { downloadSheet } from "./storage";
/**
 * Mark one sheet. Throws on failure so the queue can retry it — a Gemini blip
 * or a storage hiccup is transient, and marking the row `failed` on the first
 * wobble would turn every transient into a permanent until a human clicked
 * re-mark. The queue's failure handler is what records a real failure.
 */
export async function gradeOne({ submissionId, correction }) {
  const submission = await db.test_submissions.findUnique({
    where: {
      id: submissionId,
    },
    include: {
      tests: { include: { test_questions: { orderBy: { position: "asc" } } } },
    },
  });
  if (!submission?.storage_path) return;
  // Work is claimed as `queued` before it is dispatched, and a re-mark re-queues
  // it, so `graded` here means another attempt already finished this sheet — a
  // retry after settleTest failed, say. Grading again would spend a second model
  // call and could quietly change the mark under the teacher.
  if (submission.status === "graded") return;
  const test = submission.tests;
  await db.test_submissions.update({
    where: {
      id: submissionId,
    },
    data: {
      status: "grading",
      updated_at: new Date(),
    },
  });
  try {
    const content = await downloadSheet(submission.storage_path);
    // With a paper, the sheet is out of what the paper's questions carry —
    // which may be less than the test's ceiling. Without one, the ceiling is
    // all there is.
    const paperTotal = test.test_questions.reduce(
      (sum, question) => sum + Number(question.marks),
      0,
    );
    const outOf = test.test_questions.length ? paperTotal : Number(test.max_marks);
    const result = await gradeSheet(
      content,
      submission.mime_type || "application/pdf",
      outOf,
      test.instructions,
      correction,
      test.test_questions.map((question) => ({
        label: question.label,
        prompt: question.prompt,
        answer: question.answer,
        marks: Number(question.marks),
      })),
    );
    await db.test_submissions.update({
      where: {
        id: submissionId,
      },
      data: {
        status: "graded",
        score: result.score,
        out_of: result.out_of,
        summary: result.summary,
        questions: result.questions,
        needs_review: result.needs_review,
        overridden: false,
        error_message: result.review_reason,
        graded_at: new Date(),
        updated_at: new Date(),
      },
    });
    await settleTest(submission.test_id);
  } catch (error) {
    console.error(`Grading attempt failed for submission ${submissionId}:`, error);
    throw error;
  }
}

/** What the queue records once a sheet is out of retries. */
export async function markSheetFailed(submissionId) {
  const submission = await db.test_submissions.findUnique({
    where: { id: submissionId },
    select: { test_id: true, status: true },
  });
  if (!submission || submission.status === "graded") return;
  await db.test_submissions.update({
    where: { id: submissionId },
    data: {
      status: "failed",
      error_message: "Could not read this answer sheet. Try re-uploading it.",
      updated_at: new Date(),
    },
  });
  await settleTest(submission.test_id);
}

/**
 * A test is graded only once nothing is still pending.
 *
 * Called after every sheet because jobs finish in any order and there is no
 * coordinator watching the batch.
 */
export async function settleTest(testId) {
  const counts = await db.test_submissions.groupBy({
    by: ["status"],
    where: { test_id: testId },
    _count: true,
  });
  const of = (status) => counts.find((row) => row.status === status)?._count ?? 0;
  const inFlight = of("queued") + of("grading");
  const unfinished = of("awaiting") + of("failed");
  // Mid-batch the test is still grading; "collecting" while jobs are running
  // read as the batch having silently stopped.
  const status = inFlight ? "grading" : unfinished ? "collecting" : "graded";
  await db.tests.update({
    where: { id: testId },
    data: { status, updated_at: new Date() },
  });
}

/**
 * Claim every sheet waiting on a test and return the jobs for them.
 *
 * Claiming up front means a second click cannot double-queue the same sheet.
 */
export async function claimPendingSheets(testId) {
  const staleBefore = new Date(Date.now() - 10 * 60 * 1000);
  const pending = await db.test_submissions.findMany({
    where: {
      test_id: testId,
      storage_path: { not: null },
      OR: [
        { status: { in: ["awaiting", "failed", "queued"] } },
        // A row can be stranded mid-"grading" by a crash between the attempt
        // and its failure handler. Ten minutes is far past any single attempt,
        // so reclaiming these cannot double-grade an active one.
        { status: "grading", updated_at: { lt: staleBefore } },
      ],
    },
    select: { id: true },
  });
  if (!pending.length) return [];
  await db.$transaction([
    db.test_submissions.updateMany({
      where: {
        id: {
          in: pending.map((row) => row.id),
        },
      },
      data: {
        status: "queued",
        updated_at: new Date(),
      },
    }),
    db.tests.update({
      where: {
        id: testId,
      },
      data: {
        status: "grading",
        updated_at: new Date(),
      },
    }),
  ]);
  return pending.map((row) => ({
    submissionId: row.id,
  }));
}
