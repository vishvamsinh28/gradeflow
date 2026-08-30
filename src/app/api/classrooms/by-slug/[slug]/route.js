import { requireUser } from "@/lib/server/auth";
import { json, route } from "@/lib/server/http";
import { classroomPayload, ownedClassroomBySlug } from "@/lib/server/domain";
export const GET = route(async (request, { params }) => {
  const user = await requireUser(request);
  const { slug } = await params;
  const classroom = await ownedClassroomBySlug(slug, user.id);
  return json(await classroomPayload(classroom.id));
});
