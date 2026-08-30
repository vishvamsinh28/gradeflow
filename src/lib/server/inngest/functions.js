import { claimPendingSheets, gradeOne, settleTest } from "../grading";
import { gradeRequested, inngest, sheetGrade } from "./client";

/**
 * Fan a test out into one job per sheet.
 *
 * Claiming happens in its own step so a retry of the fan-out cannot queue the
 * same sheet twice — the claim flips rows to `queued`, and only rows that were
 * still pending come back.
 */
export const gradeTest = inngest.createFunction(
  {
    id: "grade-test",
    name: "Grade every pending sheet on a test",
    triggers: [gradeRequested],
  },
  async ({ event, step }) => {
    const { testId, correction } = event.data;
    const jobs = await step.run("claim-pending-sheets", () => claimPendingSheets(testId));
    if (!jobs.length) {
      await step.run("settle-test", () => settleTest(testId));
      return {
        queued: 0,
      };
    }
    await step.sendEvent(
      "queue-each-sheet",
      jobs.map((job) =>
        sheetGrade.create({
          submissionId: job.submissionId,
          correction: correction ?? null,
        }),
      ),
    );
    return {
      queued: jobs.length,
    };
  },
);

/**
 * Mark one sheet.
 *
 * `concurrency` keeps a big class from opening thirty model calls at once, and
 * `gradeOne` settles the test afterwards because jobs finish in any order.
 */
export const gradeSheet = inngest.createFunction(
  {
    id: "grade-sheet",
    name: "Mark one answer sheet",
    triggers: [sheetGrade],
    retries: 2,
    concurrency: {
      limit: 5,
    },
  },
  async ({ event, step }) => {
    const { submissionId, correction } = event.data;
    await step.run("grade", () =>
      gradeOne({
        submissionId,
        correction: correction ?? null,
      }),
    );
    return {
      submissionId,
    };
  },
);
export const functions = [gradeTest, gradeSheet];
