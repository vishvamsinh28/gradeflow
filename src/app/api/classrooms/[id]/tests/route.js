import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { ApiError, body, json, route } from "@/lib/server/http";
import { ownedClassroom, testPayload } from "@/lib/server/domain";
import { testCreateSchema } from "@/lib/server/schemas";
export const POST = route(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  await ownedClassroom(id, user.id);
  const input = await body(request, testCreateSchema);
  // The FK only proves the subject exists somewhere — it must be this
  // classroom's, or a crafted id could pin another teacher's subject here.
  if (input.subject_id) {
    const subject = await db.subjects.findFirst({
      where: { id: input.subject_id, classroom_id: id },
      select: { id: true },
    });
    if (!subject) throw new ApiError(422, "That subject is not in this classroom");
  }
  const test = await db.tests.create({
    data: {
      classroom_id: id,
      subject_id: input.subject_id || null,
      test_date: new Date(`${input.test_date}T00:00:00Z`),
      title: input.title?.trim() || null,
      instructions: input.instructions?.trim() || null,
      max_marks: input.max_marks,
    },
  });
  return json(testPayload(test), 201);
});
