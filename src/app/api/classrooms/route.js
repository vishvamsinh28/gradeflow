import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { body, json, route } from "@/lib/server/http";
import { classroomPayload, classroomsPayload, uniqueSlug } from "@/lib/server/domain";
import { classroomCreateSchema } from "@/lib/server/schemas";
export const GET = route(async (request) => {
  const user = await requireUser(request);
  return json(await classroomsPayload(user.id));
});
export const POST = route(async (request) => {
  const user = await requireUser(request);
  const input = await body(request, classroomCreateSchema);
  const names = [...new Set(input.subjects.map((name) => name.trim()).filter(Boolean))];
  const classroom = await db.classrooms.create({
    data: {
      owner_id: user.id,
      slug: await uniqueSlug(user.id, input.name),
      name: input.name.trim(),
      description: input.description?.trim() || null,
      subjects: {
        create: names.map((name, position) => ({
          name,
          position,
        })),
      },
    },
  });
  return json(await classroomPayload(classroom.id), 201);
});
