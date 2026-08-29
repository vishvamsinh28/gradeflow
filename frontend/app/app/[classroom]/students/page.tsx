"use client";

import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Avatar, Button, EmptyState, Input, cx } from "@/components/ui/primitives";
import { IconPlus, IconSearch, IconUsers } from "@/components/ui/icons";
import { useWorkspaceActions } from "@/components/app/shell";
import { StudentSheet } from "@/components/app/student-sheet";
import { SortHeader, TD, TH, compareValues, nextSort, type SortDirection } from "@/components/app/table";
import { attendanceOf, useClassroom } from "@/lib/workspace";
import { formatPercent, markTone, MARK_TONE_CLASS, pluralize } from "@/lib/format";
import type { Student } from "@/lib/types";

type SortKey = "name" | "code" | "graded" | "average" | "attendance";

export default function StudentsPage() {
  const params = useParams<{ classroom: string }>();
  const searchParams = useSearchParams();
  const { data: classroom } = useClassroom(params.classroom);
  const { addStudents } = useWorkspaceActions();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: "name",
    direction: "asc",
  });
  const [selected, setSelected] = useState<Student | null>(null);

  const rows = useMemo(() => {
    if (!classroom) return [];
    return classroom.students.map((student) => {
      const percents = classroom.tests
        .map((test) => {
          const submission = classroom.submissions.find(
            (item) =>
              item.test_id === test.id &&
              item.student_id === student.id &&
              item.status === "graded",
          );
          if (!submission?.out_of) return null;
          return ((submission.score ?? 0) / submission.out_of) * 100;
        })
        .filter((value): value is number => value !== null);

      const present = classroom.tests.filter(
        (test) => attendanceOf(classroom.attendance, test.id, student.id) === "present",
      ).length;

      return {
        student,
        graded: percents.length,
        average:
          percents.length > 0
            ? percents.reduce((sum, value) => sum + value, 0) / percents.length
            : null,
        attendance:
          classroom.tests.length > 0 ? (present / classroom.tests.length) * 100 : null,
      };
    });
  }, [classroom]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rows.filter(
          (row) =>
            row.student.name.toLowerCase().includes(q) ||
            row.student.code.toLowerCase().includes(q) ||
            (row.student.roll_no ?? "").toLowerCase().includes(q),
        )
      : rows;

    return [...filtered].sort((a, b) => {
      switch (sort.key) {
        case "code":
          return compareValues(a.student.code, b.student.code, sort.direction);
        case "graded":
          return compareValues(a.graded, b.graded, sort.direction);
        case "average":
          return compareValues(a.average, b.average, sort.direction);
        case "attendance":
          return compareValues(a.attendance, b.attendance, sort.direction);
        default:
          return compareValues(a.student.name, b.student.name, sort.direction);
      }
    });
  }, [rows, query, sort]);

  if (!classroom) return null;

  function toggleSort(key: SortKey) {
    setSort((current) => nextSort(current, key, key === "name" || key === "code" ? "asc" : "desc"));
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-[300px]">
          <IconSearch
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search students"
            className="pl-8"
          />
        </div>
        <span className="text-[12.5px] text-ink-3">
          {query ? `${visible.length} of ${classroom.students.length}` : pluralize(classroom.students.length, "student")}
        </span>
        <div className="ml-auto">
          <Button size="sm" variant="primary" icon={<IconPlus size={14} />} onClick={addStudents}>
            Add students
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {classroom.students.length === 0 ? (
          <EmptyState
            icon={<IconUsers size={17} />}
            title="No students yet"
            description="Paste a list, drop a CSV, or hand GradeFlow a photo of your register — it reads the names and generates IDs for you."
            action={
              <Button variant="primary" icon={<IconPlus size={15} />} onClick={addStudents}>
                Add students
              </Button>
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState title="No matches" description={`Nothing in this classroom matches "${query}".`} />
        ) : (
          <div className="max-h-[calc(100svh-17rem)] min-h-[280px] overflow-auto">
            <table className="w-full border-separate border-spacing-0 text-ink">
              <thead>
                <tr>
                  <SortHeader id="name" label="Student" sort={sort} onSort={toggleSort} className="pl-4" />
                  <SortHeader id="code" label="ID" sort={sort} onSort={toggleSort} className="w-[110px] whitespace-nowrap" />
                  <th scope="col" className={cx(TH, "w-[92px]")}>
                    Roll
                  </th>
                  <SortHeader
                    id="graded"
                    label="Tests"
                    sort={sort}
                    onSort={toggleSort}
                    align="right"
                    className="w-[92px]"
                  />
                  <SortHeader
                    id="average"
                    label="Average"
                    sort={sort}
                    onSort={toggleSort}
                    align="right"
                    className="w-[104px]"
                  />
                  <SortHeader
                    id="attendance"
                    label="Attendance"
                    sort={sort}
                    onSort={toggleSort}
                    align="right"
                    className="w-[122px] pr-4"
                  />
                </tr>
              </thead>
              <tbody>
                {visible.map(({ student, graded, average, attendance }) => (
                  <tr
                    key={student.id}
                    tabIndex={0}
                    onClick={() => setSelected(student)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelected(student);
                      }
                    }}
                    className="cursor-pointer transition-colors hover:bg-surface-2 focus:bg-surface-2 focus:outline-none"
                  >
                    <td className={cx(TD, "pl-4")}>
                      <span className="flex items-center gap-2.5">
                        <Avatar name={student.name} size={24} />
                        <span className="font-medium">{student.name}</span>
                      </span>
                    </td>
                    <td className={cx(TD, "whitespace-nowrap font-mono text-[12px] text-ink-3")}>{student.code}</td>
                    <td className={cx(TD, "font-mono text-[12px] text-ink-3")}>
                      {student.roll_no ?? "—"}
                    </td>
                    <td className={cx(TD, "text-right font-mono text-[12.5px] text-ink-2 tnum")}>
                      {graded}
                    </td>
                    <td
                      className={cx(
                        TD,
                        "text-right font-mono text-[13px] font-medium tnum",
                        MARK_TONE_CLASS[markTone(average)],
                      )}
                    >
                      {formatPercent(average)}
                    </td>
                    <td className={cx(TD, "pr-4 text-right font-mono text-[12.5px] text-ink-2 tnum")}>
                      {formatPercent(attendance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <StudentSheet student={selected} classroom={classroom} onClose={() => setSelected(null)} />
    </div>
  );
}
