"use client";

import { Avatar, Badge, Button, EmptyState, cx } from "@/components/ui/primitives";
import { Sheet, useConfirm, useToast } from "@/components/ui/overlays";
import { IconCalendar, IconTrash } from "@/components/ui/icons";
import { attendanceOf, removeStudent, updateStudent } from "@/lib/workspace";
import { formatDateShort, formatMark, formatPercent, markTone } from "@/lib/format";
import type { Classroom, Student } from "@/lib/types";

const TONE_TEXT: Record<ReturnType<typeof markTone>, string> = {
  strong: "text-accent",
  fine: "text-ink",
  watch: "text-warn",
  low: "text-danger",
  none: "text-ink-4",
};

export function StudentSheet({
  student,
  classroom,
  onClose,
}: {
  student: Student | null;
  classroom: Classroom;
  onClose: () => void;
}) {
  const confirm = useConfirm();
  const toast = useToast();

  const rows = student
    ? [...classroom.tests]
        .sort((a, b) => b.test_date.localeCompare(a.test_date))
        .map((test) => {
          const submission = classroom.submissions.find(
            (item) => item.test_id === test.id && item.student_id === student.id,
          );
          const absent =
            attendanceOf(classroom.attendance, test.id, student.id) === "absent";
          const percent =
            submission?.status === "graded" && submission.out_of
              ? ((submission.score ?? 0) / submission.out_of) * 100
              : null;
          return { test, submission, absent, percent };
        })
    : [];

  const graded = rows.filter((row) => row.percent !== null);
  const average =
    graded.length > 0
      ? graded.reduce((sum, row) => sum + (row.percent ?? 0), 0) / graded.length
      : null;
  const present = rows.filter((row) => !row.absent).length;

  function commitName(input: HTMLInputElement) {
    if (!student) return;
    const name = input.value.trim();
    if (!name || name === student.name) {
      input.value = student.name;
      return;
    }
    void updateStudent(classroom, student.id, { name });
  }

  async function remove() {
    if (!student) return;
    const ok = await confirm({
      title: `Remove ${student.name}?`,
      body: "Their submissions and marks in this classroom are removed too.",
      confirmLabel: "Remove student",
      danger: true,
    });
    if (!ok) return;
    try {
      await removeStudent(classroom, student.id);
      onClose();
      toast("Student removed", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not remove that student", "error");
    }
  }

  return (
    <Sheet
      open={student !== null}
      onClose={onClose}
      title={student?.name ?? ""}
      description={student ? `${student.code}${student.roll_no ? ` · Roll ${student.roll_no}` : ""}` : undefined}
      width={540}
      footer={
        <>
          <Button size="sm" variant="danger" icon={<IconTrash size={14} />} onClick={() => void remove()}>
            Remove
          </Button>
          <Button size="sm" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      {student ? (
        <div>
          <div className="flex items-center gap-3 border-b border-line px-5 py-3">
            <Avatar name={student.name} size={40} />
            <div className="min-w-0 flex-1">
              <input
                key={`${student.id}-name`}
                defaultValue={student.name}
                aria-label="Student name"
                onBlur={(event) => commitName(event.target)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                  if (event.key === "Escape") {
                    event.currentTarget.value = student.name;
                    event.currentTarget.blur();
                  }
                }}
                className="w-full rounded-[5px] border border-transparent bg-transparent px-1.5 py-0.5 text-[14px] font-medium text-ink outline-none transition-colors hover:border-line focus:border-accent focus:bg-surface"
              />
              <input
                key={`${student.id}-roll`}
                defaultValue={student.roll_no ?? ""}
                placeholder="Add roll number"
                aria-label="Roll number"
                onBlur={(event) =>
                  void updateStudent(classroom, student.id, {
                    roll_no: event.target.value.trim() || undefined,
                  })
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
                className="mt-0.5 w-full rounded-[5px] border border-transparent bg-transparent px-1.5 py-0.5 font-mono text-[12px] text-ink-3 outline-none transition-colors placeholder:text-ink-4 hover:border-line focus:border-accent focus:bg-surface"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 border-b border-line px-5 py-3">
            <div className="grid flex-1 grid-cols-3 gap-3 text-center">
              <div>
                <p className="font-mono text-[17px] font-medium text-ink tnum">
                  {formatPercent(average)}
                </p>
                <p className="text-[11px] uppercase tracking-[0.06em] text-ink-3">Average</p>
              </div>
              <div>
                <p className="font-mono text-[17px] font-medium text-ink tnum">{graded.length}</p>
                <p className="text-[11px] uppercase tracking-[0.06em] text-ink-3">Graded</p>
              </div>
              <div>
                <p className="font-mono text-[17px] font-medium text-ink tnum">
                  {rows.length > 0 ? formatPercent((present / rows.length) * 100) : "—"}
                </p>
                <p className="text-[11px] uppercase tracking-[0.06em] text-ink-3">Attendance</p>
              </div>
            </div>
          </div>

          {rows.length === 0 ? (
            <EmptyState
              icon={<IconCalendar size={17} />}
              title="No tests yet"
              description="Marks appear here as soon as this classroom has a graded test."
            />
          ) : (
            <ul className="divide-y divide-line">
              {rows.map(({ test, submission, absent, percent }) => {
                const subject = classroom.subjects.find((item) => item.id === test.subject_id);
                return (
                  <li key={test.id} className="flex items-center gap-3 px-5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink">
                        {test.title ?? "Untitled test"}
                      </p>
                      <p className="mt-0.5 text-[12px] text-ink-3">
                        {subject?.name ?? "No subject"} · {formatDateShort(test.test_date)}
                      </p>
                    </div>
                    {absent ? (
                      <Badge tone="danger">Absent</Badge>
                    ) : percent === null ? (
                      <Badge tone="muted">
                        {submission ? "Awaiting grading" : "No answer"}
                      </Badge>
                    ) : (
                      <div className="text-right">
                        <p className={cx("font-mono text-[13.5px] font-medium tnum", TONE_TEXT[markTone(percent)])}>
                          {formatMark(submission?.score ?? 0)}
                          <span className="text-ink-4">/{submission?.out_of}</span>
                        </p>
                        <p className="font-mono text-[11.5px] text-ink-3 tnum">
                          {formatPercent(percent)}
                        </p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </Sheet>
  );
}
