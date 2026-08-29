"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Badge, Button, EmptyState, Input, Segmented, Select, cx } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/overlays";
import { IconDownload, IconSearch, IconTable } from "@/components/ui/icons";
import { StudentSheet } from "@/components/app/student-sheet";
import { SortHeader, TD, compareValues, nextSort, type SortDirection } from "@/components/app/table";
import { attendanceOf, useClassroom, useDatabase } from "@/lib/store";
import { formatDateShort, formatPercent, markTone, pluralize } from "@/lib/format";
import type { Student } from "@/lib/types";

type View = "subjects" | "tests";
type AttendanceFilter = "any" | "present" | "absent";

const TONE_TEXT = {
  strong: "text-accent",
  fine: "text-ink",
  watch: "text-warn",
  low: "text-danger",
  none: "text-ink-4",
} as const;

export default function MarksPage() {
  const params = useParams<{ classroom: string }>();
  const db = useDatabase();
  const classroom = useClassroom(params.classroom);
  const toast = useToast();

  const [view, setView] = useState<View>("subjects");
  const [query, setQuery] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [testId, setTestId] = useState("");
  const [attendance, setAttendance] = useState<AttendanceFilter>("any");
  const [sort, setSort] = useState<{ key: string; direction: SortDirection }>({
    key: "name",
    direction: "asc",
  });
  const [selected, setSelected] = useState<Student | null>(null);

  /** Tests in play after the subject/test filters — everything downstream uses these. */
  const scopedTests = useMemo(() => {
    if (!classroom) return [];
    return classroom.tests
      .filter((test) => (subjectId ? test.subjectId === subjectId : true))
      .filter((test) => (testId ? test.id === testId : true))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [classroom, subjectId, testId]);

  const columns = useMemo(() => {
    if (!classroom) return [];
    if (view === "tests") {
      return scopedTests.map((test) => ({
        id: test.id,
        label: test.title ?? "Untitled",
        sub: formatDateShort(test.date),
        testIds: [test.id],
      }));
    }
    return classroom.subjects
      .filter((subject) => (subjectId ? subject.id === subjectId : true))
      .map((subject) => ({
        id: subject.id,
        label: subject.name,
        sub: pluralize(scopedTests.filter((test) => test.subjectId === subject.id).length, "test"),
        testIds: scopedTests.filter((test) => test.subjectId === subject.id).map((test) => test.id),
      }));
  }, [classroom, view, subjectId, scopedTests]);

  const rows = useMemo(() => {
    if (!classroom) return [];
    const scopedIds = new Set(scopedTests.map((test) => test.id));

    return classroom.students.map((student) => {
      const percentFor = (testIds: string[]) => {
        const values = testIds
          .map((id) => {
            const submission = db.submissions.find(
              (item) => item.testId === id && item.studentId === student.id && item.status === "graded",
            );
            if (!submission?.outOf) return null;
            return ((submission.score ?? 0) / submission.outOf) * 100;
          })
          .filter((value): value is number => value !== null);
        return values.length > 0
          ? values.reduce((sum, value) => sum + value, 0) / values.length
          : null;
      };

      const cells: Record<string, number | null> = {};
      columns.forEach((column) => {
        cells[column.id] = percentFor(column.testIds);
      });

      const all = percentFor([...scopedIds]);
      const absences = scopedTests.filter(
        (test) => attendanceOf(db, test.id, student.id) === "absent",
      ).length;

      return {
        student,
        cells,
        average: all,
        absences,
        attendancePercent:
          scopedTests.length > 0
            ? ((scopedTests.length - absences) / scopedTests.length) * 100
            : null,
      };
    });
  }, [classroom, columns, db, scopedTests]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (
        q &&
        !row.student.name.toLowerCase().includes(q) &&
        !row.student.code.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (attendance === "present") return row.absences === 0;
      if (attendance === "absent") return row.absences > 0;
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sort.key === "name") return compareValues(a.student.name, b.student.name, sort.direction);
      if (sort.key === "code") return compareValues(a.student.code, b.student.code, sort.direction);
      if (sort.key === "average") return compareValues(a.average, b.average, sort.direction);
      if (sort.key === "attendance")
        return compareValues(a.attendancePercent, b.attendancePercent, sort.direction);
      return compareValues(a.cells[sort.key] ?? null, b.cells[sort.key] ?? null, sort.direction);
    });
  }, [rows, query, attendance, sort]);

  const columnAverages = useMemo(() => {
    const result: Record<string, number | null> = {};
    [...columns.map((column) => column.id), "average"].forEach((key) => {
      const values = visible
        .map((row) => (key === "average" ? row.average : row.cells[key]))
        .filter((value): value is number => value !== null && value !== undefined);
      result[key] =
        values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    });
    return result;
  }, [columns, visible]);

  if (!classroom) return null;

  function exportCsv() {
    if (!classroom) return;
    const header = ["Student", "ID", ...columns.map((column) => column.label), "Average", "Absences"];
    const body = visible.map((row) => [
      row.student.name,
      row.student.code,
      ...columns.map((column) =>
        row.cells[column.id] === null ? "" : (row.cells[column.id] ?? 0).toFixed(1),
      ),
      row.average === null ? "" : row.average.toFixed(1),
      String(row.absences),
    ]);
    const csv = [header, ...body]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${classroom.slug}-marks.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast(`Exported ${pluralize(visible.length, "row")}`, "success");
  }

  const hasAnyMarks = rows.some((row) => row.average !== null);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: "subjects", label: "By subject" },
            { value: "tests", label: "By test" },
          ]}
        />

        <div className="relative min-w-[170px] flex-1 sm:max-w-[230px]">
          <IconSearch
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search students"
            className="h-8 pl-8 text-[13px]"
          />
        </div>

        {classroom.subjects.length > 0 ? (
          <Select
            value={subjectId}
            onChange={(event) => {
              setSubjectId(event.target.value);
              setTestId("");
            }}
            className="h-8 min-w-[132px] flex-1 text-[13px] sm:w-auto sm:flex-none"
          >
            <option value="">All subjects</option>
            {classroom.subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </Select>
        ) : null}

        <Select
          value={testId}
          onChange={(event) => setTestId(event.target.value)}
          className="h-8 min-w-[132px] flex-1 text-[13px] sm:w-auto sm:flex-none"
        >
          <option value="">All tests</option>
          {classroom.tests
            .filter((test) => (subjectId ? test.subjectId === subjectId : true))
            .map((test) => (
              <option key={test.id} value={test.id}>
                {test.title ?? "Untitled"} · {formatDateShort(test.date)}
              </option>
            ))}
        </Select>

        <Select
          value={attendance}
          onChange={(event) => setAttendance(event.target.value as AttendanceFilter)}
          className="h-8 min-w-[132px] flex-1 text-[13px] sm:w-auto sm:flex-none"
        >
          <option value="any">Any attendance</option>
          <option value="present">No absences</option>
          <option value="absent">Has absences</option>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-[12.5px] text-ink-3 sm:inline">
            {visible.length === rows.length
              ? pluralize(rows.length, "student")
              : `${visible.length} of ${rows.length}`}
          </span>
          <Button size="sm" icon={<IconDownload size={14} />} onClick={exportCsv} disabled={visible.length === 0}>
            Export
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {classroom.students.length === 0 || columns.length === 0 || !hasAnyMarks ? (
          <EmptyState
            icon={<IconTable size={17} />}
            title={classroom.students.length === 0 ? "No students yet" : "No marks yet"}
            description={
              classroom.students.length === 0
                ? "Add students to this classroom and their marks will collect here."
                : "Once a test is graded, every mark lands in this table — sortable, filterable and ready to export."
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState
            title="No matches"
            description="No students match the filters you have set."
            action={
              <Button
                size="sm"
                onClick={() => {
                  setQuery("");
                  setSubjectId("");
                  setTestId("");
                  setAttendance("any");
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <div className="max-h-[calc(100svh-17rem)] min-h-[280px] overflow-auto">
            <table className="w-full border-separate border-spacing-0 text-ink">
              <thead>
                <tr>
                  <SortHeader
                    id="name"
                    label="Student"
                    sort={sort}
                    onSort={(key) => setSort((current) => nextSort(current, key, "asc"))}
                    className="sticky left-0 z-20 min-w-[150px] border-r border-line pl-4 sm:min-w-[190px]"
                  />
                  <SortHeader
                    id="code"
                    label="ID"
                    sort={sort}
                    onSort={(key) => setSort((current) => nextSort(current, key, "asc"))}
                    className="w-[100px] whitespace-nowrap"
                  />
                  {columns.map((column) => (
                    <SortHeader
                      key={column.id}
                      id={column.id}
                      label={
                        <span className="flex flex-col items-end leading-tight">
                          <span className="max-w-[120px] truncate">{column.label}</span>
                          <span className="text-[10px] font-medium normal-case tracking-normal text-ink-4">
                            {column.sub}
                          </span>
                        </span>
                      }
                      sort={sort}
                      onSort={(key) => setSort((current) => nextSort(current, key, "desc"))}
                      align="right"
                      className="min-w-[104px]"
                    />
                  ))}
                  <SortHeader
                    id="average"
                    label="Average"
                    sort={sort}
                    onSort={(key) => setSort((current) => nextSort(current, key, "desc"))}
                    align="right"
                    className="min-w-[100px] border-l border-line bg-surface-2/70"
                  />
                  <SortHeader
                    id="attendance"
                    label="Attendance"
                    sort={sort}
                    onSort={(key) => setSort((current) => nextSort(current, key, "desc"))}
                    align="right"
                    className="min-w-[124px] pr-4"
                  />
                </tr>
              </thead>

              <tbody>
                {visible.map((row) => (
                  <tr
                    key={row.student.id}
                    tabIndex={0}
                    onClick={() => setSelected(row.student)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") setSelected(row.student);
                    }}
                    className="group/row cursor-pointer transition-colors hover:bg-surface-2 focus:outline-none focus-visible:bg-surface-2"
                  >
                    <td
                      className={cx(
                        TD,
                        "sticky left-0 z-10 border-r border-line bg-surface pl-4 font-medium transition-colors group-hover/row:bg-surface-2",
                      )}
                    >
                      {row.student.name}
                    </td>
                    <td className={cx(TD, "whitespace-nowrap font-mono text-[12px] text-ink-3")}>{row.student.code}</td>
                    {columns.map((column) => {
                      const value = row.cells[column.id];
                      return (
                        <td
                          key={column.id}
                          className={cx(
                            TD,
                            "text-right font-mono text-[13px] tnum",
                            TONE_TEXT[markTone(value)],
                          )}
                        >
                          {value === null ? "—" : value.toFixed(0)}
                        </td>
                      );
                    })}
                    <td
                      className={cx(
                        TD,
                        "border-l border-line bg-surface-2/40 text-right font-mono text-[13px] font-medium tnum",
                        TONE_TEXT[markTone(row.average)],
                      )}
                    >
                      {row.average === null ? "—" : row.average.toFixed(1)}
                    </td>
                    <td className={cx(TD, "pr-4 text-right")}>
                      {row.absences === 0 ? (
                        <Badge tone="muted">Full</Badge>
                      ) : (
                        <Badge tone="danger">
                          {row.absences} absent
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr>
                  <td className="sticky bottom-0 left-0 z-30 border-r border-t border-line bg-surface-2 py-2 pl-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-3">
                    Class average
                  </td>
                  <td className="sticky bottom-0 z-20 border-t border-line bg-surface-2" />
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className="sticky bottom-0 z-20 border-t border-line bg-surface-2 px-3 py-2 text-right font-mono text-[12.5px] font-medium text-ink-2 tnum"
                    >
                      {formatPercent(columnAverages[column.id])}
                    </td>
                  ))}
                  <td className="sticky bottom-0 z-20 border-l border-t border-line bg-surface-2 px-3 py-2 text-right font-mono text-[12.5px] font-semibold text-ink tnum">
                    {formatPercent(columnAverages.average, 1)}
                  </td>
                  <td className="sticky bottom-0 z-20 border-t border-line bg-surface-2 pr-4" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <StudentSheet student={selected} classroom={classroom} onClose={() => setSelected(null)} />
    </div>
  );
}
