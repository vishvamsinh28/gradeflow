import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { body, json, route } from "@/lib/server/http";
import { ownedClassroom, testPayload } from "@/lib/server/domain";
import { testCreateSchema } from "@/lib/server/schemas";
export const POST = route(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  await ownedClassroom(id, user.id);
  const input = await body(request, testCreateSchema);
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
