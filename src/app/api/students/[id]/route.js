import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { body, json, noContent, route } from "@/lib/server/http";
import { ownedStudent } from "@/lib/server/domain";
import { studentUpdateSchema } from "@/lib/server/schemas";
import { deleteSheets } from "@/lib/server/storage";
export const PATCH = route(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  const { student } = await ownedStudent(id, user.id);
  const input = await body(request, studentUpdateSchema);
  const data = {};
  if (input.name != null) data.name = input.name.trim();
  if (input.roll_no !== undefined) data.roll_no = input.roll_no?.trim() || null;
  if (!Object.keys(data).length) return json(student);
  return json(
    await db.classroom_students.update({
      where: {
        id,
      },
      data,
    }),
  );
});
export const DELETE = route(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  await ownedStudent(id, user.id);
  const sheets = await db.test_submissions.findMany({
    where: {
      student_id: id,
    },
    select: {
      storage_path: true,
    },
  });
  await db.classroom_students.delete({
    where: {
      id,
    },
  });
  await deleteSheets(sheets.map((row) => row.storage_path));
  return noContent();
});
