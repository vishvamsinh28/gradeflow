import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { body, json, route } from "@/lib/server/http";
import { ownedTest } from "@/lib/server/domain";
import { attendanceSchema } from "@/lib/server/schemas";
import { deleteSheets } from "@/lib/server/storage";
export const POST = route(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  const { classroom } = await ownedTest(id, user.id);
  const { entries } = await body(request, attendanceSchema);
  const valid = new Set(
    (
      await db.classroom_students.findMany({
        where: {
          classroom_id: classroom.id,
        },
        select: {
          id: true,
        },
      })
    ).map((student) => student.id),
  );
  const rows = entries.filter((entry) => valid.has(entry.student_id));
  if (!rows.length) return json([]);
  await db.$transaction(
    rows.map((entry) =>
      db.test_attendance.upsert({
        where: {
          test_id_student_id: {
            test_id: id,
            student_id: entry.student_id,
          },
        },
        create: {
          test_id: id,
          student_id: entry.student_id,
          mark: entry.mark,
        },
        update: {
          mark: entry.mark,
          updated_at: new Date(),
        },
      }),
    ),
  );

  // An absent student is not expected to hand anything in, so drop any sheet
  // sitting against them rather than leaving it to be graded.
  const absent = rows.filter((entry) => entry.mark === "absent").map((entry) => entry.student_id);
  if (absent.length) {
    const stale = await db.test_submissions.findMany({
      where: {
        test_id: id,
        student_id: {
          in: absent,
        },
      },
      select: {
        storage_path: true,
      },
    });
    if (stale.length) {
      await db.test_submissions.deleteMany({
        where: {
          test_id: id,
          student_id: {
            in: absent,
          },
        },
      });
      await deleteSheets(stale.map((row) => row.storage_path));
    }
  }
  return json(
    await db.test_attendance.findMany({
      where: {
        test_id: id,
      },
    }),
  );
});
