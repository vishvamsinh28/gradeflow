import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { ApiError, body, json, route } from "@/lib/server/http";
import { ownedTest, questionPayload } from "@/lib/server/domain";
import { questionsSchema } from "@/lib/server/schemas";

/**
 * Replace the whole question paper in one write.
 *
 * The editor is a list the teacher rearranges, renumbers and deletes rows from,
 * so a diff of individual creates and deletes would be more moving parts for no
 * gain. The test's total is the teacher's ceiling: the paper must fit inside
 * it, never redefine it.
 */
export const PUT = route(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  const { test } = await ownedTest(id, user.id);
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
  const ceiling = Number(test.max_marks);
  if (total > ceiling) {
    throw new ApiError(
      422,
      `These questions add up to ${total} marks — more than the test's total of ${ceiling}. ` +
        "Lower the question marks, or raise the test's total first.",
    );
  }

  await db.$transaction([
    db.test_questions.deleteMany({ where: { test_id: id } }),
    ...(rows.length ? [db.test_questions.createMany({ data: rows })] : []),
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
