import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { body, json, noContent, route } from "@/lib/server/http";
import { ownedSubject } from "@/lib/server/domain";
import { subjectSchema } from "@/lib/server/schemas";
export const PATCH = route(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  await ownedSubject(id, user.id);
  const { name } = await body(request, subjectSchema);
  return json(
    await db.subjects.update({
      where: {
        id,
      },
      data: {
        name: name.trim(),
      },
    }),
  );
});
export const DELETE = route(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  await ownedSubject(id, user.id);
  // Tests filed under the subject keep their marks; the column is set null.
  await db.subjects.delete({
    where: {
      id,
    },
  });
  return noContent();
});
