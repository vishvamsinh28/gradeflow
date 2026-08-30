/** Request validation. One schema per endpoint that takes a body. */
import { z } from "zod";
export const registerSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(2).max(100),
  password: z.string().min(8).max(72),
});
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
const gradeBand = z.object({
  label: z.string().min(1).max(12),
  min: z.number().min(0).max(100),
});
export const classroomCreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullish(),
  subjects: z.array(z.string()).max(40).default([]),
});
export const classroomUpdateSchema = z.object({
  name: z.string().min(1).max(120).nullish(),
  description: z.string().max(500).nullish(),
  grade_scale: z
    .array(gradeBand)
    .nullish()
    .refine(
      (bands) => {
        if (!bands?.length) return true;
        const thresholds = bands.map((band) => band.min);
        const descending = [...thresholds].sort((a, b) => b - a);
        return thresholds.every((value, index) => value === descending[index]);
      },
      {
        message: "Grade bands must be ordered from the highest threshold down",
      },
    )
    .refine((bands) => !bands?.length || new Set(bands.map((b) => b.min)).size === bands.length, {
      message: "Grade bands cannot share a threshold",
    }),
});
export const subjectSchema = z.object({
  name: z.string().min(1).max(80),
});
export const studentsCreateSchema = z.object({
  students: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        roll_no: z.string().max(40).nullish(),
      }),
    )
    .min(1)
    .max(300),
});
export const studentUpdateSchema = z.object({
  name: z.string().min(1).max(120).nullish(),
  roll_no: z.string().max(40).nullish(),
});

// A calendar day, not an instant — the client sends YYYY-MM-DD.
const testDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date");
export const testCreateSchema = z.object({
  test_date: testDate,
  title: z.string().max(160).nullish(),
  subject_id: z.string().nullish(),
  instructions: z.string().max(2000).nullish(),
  max_marks: z.number().gt(0).max(10000).default(100),
});
export const testUpdateSchema = z.object({
  test_date: testDate.nullish(),
  title: z.string().max(160).nullish(),
  subject_id: z.string().nullish(),
  instructions: z.string().max(2000).nullish(),
  max_marks: z.number().gt(0).max(10000).nullish(),
});
export const attendanceSchema = z.object({
  entries: z
    .array(
      z.object({
        student_id: z.string(),
        mark: z.enum(["present", "absent"]),
      }),
    )
    .min(1)
    .max(300),
});

/**
 * The question paper. Answers are optional — plenty of teachers set a paper
 * without writing out a marking scheme, and the model marks fine without one.
 */
export const questionsSchema = z.object({
  questions: z
    .array(
      z.object({
        label: z.string().max(16).nullish(),
        prompt: z.string().min(1).max(2000),
        answer: z.string().max(2000).nullish(),
        marks: z.number().gt(0).max(1000).default(1),
      }),
    )
    .max(200),
});

/** A teacher correcting one mark, or accepting the one the model gave. */
export const reviewSchema = z.object({
  score: z.number().min(0).nullish(),
  accept: z.boolean().default(false),
});

/** Re-run a whole test with an extra correction appended to the guidance. */
export const regradeSchema = z.object({
  correction: z.string().min(1).max(1000),
  only_flagged: z.boolean().default(false),
});
