import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { body, json, route } from "@/lib/server/http";
import { nextStudentCodes, ownedClassroom } from "@/lib/server/domain";
import { studentsCreateSchema } from "@/lib/server/schemas";
export const POST = route(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  await ownedClassroom(id, user.id);
  const { students } = await body(request, studentsCreateSchema);
  const existing = await db.classroom_students.findMany({
    where: {
      classroom_id: id,
    },
    select: {
      code: true,
      name: true,
    },
  });
  const taken = new Set(existing.map((student) => student.name.trim().toLowerCase()));

  // A roster pasted twice should not double the class.
  const fresh = [];
  for (const student of students) {
    const name = student.name.trim();
    if (!name || taken.has(name.toLowerCase())) continue;
    taken.add(name.toLowerCase());
    fresh.push({
      name,
      roll_no: student.roll_no?.trim() || null,
    });
  }
  if (!fresh.length) return json([], 201);
  const codes = nextStudentCodes(existing, fresh.length);
  await db.classroom_students.createMany({
    data: fresh.map((student, index) => ({
      classroom_id: id,
      code: codes[index] ?? `STU-${String(index + 1).padStart(3, "0")}`,
      ...student,
    })),
  });
  return json(
    await db.classroom_students.findMany({
      where: {
        classroom_id: id,
        code: {
          in: codes,
        },
      },
      orderBy: {
        code: "asc",
      },
    }),
    201,
  );
});
