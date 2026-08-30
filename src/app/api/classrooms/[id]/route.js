import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { body, json, noContent, route } from "@/lib/server/http";
import { classroomPayload, ownedClassroom } from "@/lib/server/domain";
import { classroomUpdateSchema } from "@/lib/server/schemas";
import { deleteSheets } from "@/lib/server/storage";
export const PATCH = route(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  await ownedClassroom(id, user.id);
  const input = await body(request, classroomUpdateSchema);
  const data = {
    updated_at: new Date(),
  };
  if (input.name != null) data.name = input.name.trim();
  if (input.description !== undefined) data.description = input.description?.trim() || null;
  if (input.grade_scale != null) data.grade_scale = input.grade_scale;
  await db.classrooms.update({
    where: {
      id,
    },
    data,
  });
  return json(await classroomPayload(id));
});
export const DELETE = route(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  await ownedClassroom(id, user.id);

  // Read the paths before the cascade removes the rows that name them.
  const sheets = await db.test_submissions.findMany({
    where: {
      tests: {
        classroom_id: id,
      },
    },
    select: {
      storage_path: true,
    },
  });
  await db.classrooms.delete({
    where: {
      id,
    },
  });
  await deleteSheets(sheets.map((row) => row.storage_path));
  return noContent();
});
