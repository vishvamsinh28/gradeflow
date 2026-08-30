import { Inngest, eventType } from "inngest";
import { z } from "zod";

/**
 * The grading queue.
 *
 * A serverless function dies with its request, so marking a class cannot happen
 * inline. Inngest owns the durability: it holds the work, retries a sheet that
 * fails, and keeps going across a redeploy or a closed tab.
 */
export const inngest = new Inngest({
  id: "gradeflow",
  // Without this Inngest assumes cloud mode and demands a signing key, so
  // `npm run dev` would need one before anything could be graded.
  isDev: process.env.NODE_ENV !== "production",
});

/** Fan a whole test out into one job per pending sheet. */
export const gradeRequested = eventType("test/grade.requested", {
  schema: z.object({
    testId: z.string(),
    correction: z.string().nullable().optional(),
  }),
});

/** Mark one sheet. */
export const sheetGrade = eventType("test/sheet.grade", {
  schema: z.object({
    submissionId: z.string(),
    correction: z.string().nullable().optional(),
  }),
});
