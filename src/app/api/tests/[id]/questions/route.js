import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { body, json, route } from "@/lib/server/http";
import { ownedTest, questionPayload } from "@/lib/server/domain";
import { questionsSchema } from "@/lib/server/schemas";

/**
 * Replace the whole question paper in one write.
 *
 * The editor is a list the teacher rearranges, renumbers and deletes rows from,
 * so a diff of individual creates and deletes would be more moving parts for no
 * gain. `max_marks` follows the paper: once questions exist, the total is their
 * sum rather than something to keep in step by hand.
 */
export const PUT = route(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  await ownedTest(id, user.id);
  const { questions } = await body(request, questionsSchema);

  const rows = questions.map((question, position) => ({
    test_id: id,
    position,
    label: question.label?.trim() || null,
    prompt: question.prompt.trim(),
    answer: question.answer?.trim() || null,
    marks: question.marks,
  }));

  const total = rows.reduce((sum, row) => sum + row.marks, 0);

  await db.$transaction([
    db.test_questions.deleteMany({ where: { test_id: id } }),
    ...(rows.length ? [db.test_questions.createMany({ data: rows })] : []),
    ...(total > 0
      ? [
          db.tests.update({
            where: { id },
            data: { max_marks: total, updated_at: new Date() },
          }),
        ]
      : []),
  ]);

  return json(
    (
      await db.test_questions.findMany({
        where: { test_id: id },
        orderBy: { position: "asc" },
      })
    ).map(questionPayload),
  );
});
