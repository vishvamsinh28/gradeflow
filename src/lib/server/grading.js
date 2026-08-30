/**
 * Marking one sheet, and settling the test around it.
 *
 * Both the queue worker and the inline development path call `gradeOne`, so
 * there is a single description of what grading a sheet means.
 */
import { db } from "./db";
import { gradeSheet } from "./grader";
import { downloadSheet } from "./storage";
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
    const result = await gradeSheet(
      content,
      submission.mime_type || "application/pdf",
      Number(test.max_marks),
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
  } catch (error) {
    console.error(`Grading failed for submission ${submissionId}:`, error);
    await db.test_submissions.update({
      where: {
        id: submissionId,
      },
      data: {
        status: "failed",
        error_message: "Could not read this answer sheet. Try re-uploading it.",
        updated_at: new Date(),
      },
    });
  } finally {
    await settleTest(submission.test_id);
  }
}

/**
 * A test is graded only once nothing is still pending.
 *
 * Called after every sheet because jobs finish in any order and there is no
 * coordinator watching the batch.
 */
export async function settleTest(testId) {
  const pending = await db.test_submissions.count({
    where: {
      test_id: testId,
      status: {
        not: "graded",
      },
    },
  });
  await db.tests.update({
    where: {
      id: testId,
    },
    data: {
      status: pending ? "collecting" : "graded",
      updated_at: new Date(),
    },
  });
}

/**
 * Claim every sheet waiting on a test and return the jobs for them.
 *
 * Claiming up front means a second click cannot double-queue the same sheet.
 */
export async function claimPendingSheets(testId) {
  const pending = await db.test_submissions.findMany({
    where: {
      test_id: testId,
      status: {
        in: ["awaiting", "failed", "queued"],
      },
      storage_path: {
        not: null,
      },
    },
    select: {
      id: true,
    },
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
