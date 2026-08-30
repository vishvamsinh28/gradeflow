import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { body, json, route } from "@/lib/server/http";
import { ownedClassroom } from "@/lib/server/domain";
import { subjectSchema } from "@/lib/server/schemas";
export const POST = route(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  await ownedClassroom(id, user.id);
  const { name } = await body(request, subjectSchema);
  const position = await db.subjects.count({
    where: {
      classroom_id: id,
    },
  });
  // Upsert on (classroom, name): re-adding an existing subject returns the row
  // that is already there rather than failing or creating a second one.
  const subject = await db.subjects.upsert({
    where: {
      classroom_id_name: {
        classroom_id: id,
        name: name.trim(),
      },
    },
    create: {
      classroom_id: id,
      name: name.trim(),
      position,
    },
    update: {},
  });
  return json(subject, 201);
});
