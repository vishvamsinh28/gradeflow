import { randomUUID } from "node:crypto";
import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { json, route } from "@/lib/server/http";
import { ownedStudent } from "@/lib/server/domain";

/**
 * Issue a new results link and invalidate the old one.
 *
 * A results link exposes a child's marks to anyone holding it, so there has to
 * be a way to withdraw one that has been forwarded, posted, or lost.
 */
export const POST = route(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  await ownedStudent(id, user.id);
  const updated = await db.classroom_students.update({
    where: {
      id,
    },
    data: {
      share_token: randomUUID(),
    },
    select: {
      share_token: true,
    },
  });
  return json(updated);
});
