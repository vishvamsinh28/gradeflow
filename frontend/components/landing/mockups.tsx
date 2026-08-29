/**
 * Product replicas for the landing page.
 *
 * These are built from the same tokens as the real workspace rather than
 * screenshots, so they stay honest as the product changes — and stay crisp at
 * any size.
 */

import type { ReactNode } from "react";
import { cx } from "@/components/ui/primitives";
import { IconFile, IconSearch, IconSparkle, Logo } from "@/components/ui/icons";

/* ---------- Frame ---------- */

export function AppFrame({
  children,
  label,
  className,
  minWidth = 600,
}: {
  children: ReactNode;
  label: string;
  className?: string;
  /** Product tables keep real proportions; 0 lets a mock shrink to its column. */
  minWidth?: number;
}) {
  return (
    <div
      className={cx(
        "overflow-hidden rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(26,26,23,0.04),0_24px_64px_-32px_rgba(26,26,23,0.28)]",
        className,
      )}
    >
      <div className="flex h-9 items-center gap-2 border-b border-line bg-paper px-3">
        <Logo size={14} />
        <span className="text-[11.5px] font-semibold tracking-[-0.02em] text-ink">GradeFlow</span>
        <span className="text-ink-4">/</span>
        <span className="truncate text-[11.5px] text-ink-2">{label}</span>
        <span className="ml-auto flex items-center gap-1.5 rounded border border-line bg-surface px-1.5 py-[1px] text-[10px] text-ink-4">
          <IconSearch size={9} />
          <span className="hidden sm:inline">⌘K</span>
        </span>
      </div>
      {/* Tables keep their real proportions and scroll on narrow screens rather
          than collapsing into unreadable columns. */}
      <div className="no-scrollbar overflow-x-auto">
        <div style={minWidth ? { minWidth } : undefined}>{children}</div>
      </div>
    </div>
  );
}

/* ---------- Marks table ---------- */

const MARKS = [
  { name: "Aarav Shah", id: "STU-001", m: 87, p: 91, c: 84, avg: 87.3, att: "Full" },
  { name: "Ananya Iyer", id: "STU-002", m: 92, p: 88, c: 90, avg: 90.0, att: "Full" },
  { name: "Kabir Mehta", id: "STU-003", m: 76, p: 81, c: 79, avg: 78.7, att: "1 absent" },
  { name: "Priya Patel", id: "STU-004", m: 64, p: 58, c: 71, avg: 64.3, att: "Full" },
  { name: "Rahul Sharma", id: "STU-005", m: 95, p: 89, c: 93, avg: 92.3, att: "Full" },
  { name: "Riya Shah", id: "STU-006", m: 43, p: 51, c: 38, avg: 44.0, att: "2 absent" },
];

function markClass(value: number) {
  if (value >= 80) return "text-accent";
  if (value >= 60) return "text-ink";
  if (value >= 40) return "text-warn";
  return "text-danger";
}

export function MarksMock() {
  return (
    <div>
      <div className="flex items-center gap-1.5 border-b border-line px-3 py-2">
        <span className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-2 px-1.5 py-[2px] text-[10.5px] font-medium text-ink">
          By subject
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-line px-1.5 py-[2px] text-[10.5px] text-ink-3">
          All tests
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-line px-1.5 py-[2px] text-[10.5px] text-ink-3">
          Any attendance
        </span>
        <span className="ml-auto text-[10.5px] text-ink-3">32 students</span>
      </div>
      <table className="w-full border-separate border-spacing-0 text-[11.5px]">
        <thead>
          <tr className="text-[9.5px] uppercase tracking-[0.07em] text-ink-3">
            <th className="border-b border-line px-3 py-1.5 text-left font-semibold">Student</th>
            <th className="border-b border-line py-1.5 text-left font-semibold">ID</th>
            <th className="border-b border-line py-1.5 text-right font-semibold">Maths</th>
            <th className="border-b border-line py-1.5 text-right font-semibold">Physics</th>
            <th className="border-b border-line py-1.5 text-right font-semibold">Chem</th>
            <th className="border-b border-l border-line bg-surface-2/60 py-1.5 text-right font-semibold">
              Avg
            </th>
            <th className="border-b border-line px-3 py-1.5 text-right font-semibold">Attendance</th>
          </tr>
        </thead>
        <tbody>
          {MARKS.map((row) => (
            <tr key={row.id}>
              <td className="border-b border-line px-3 py-[7px] font-medium text-ink">{row.name}</td>
              <td className="border-b border-line py-[7px] font-mono text-[10.5px] text-ink-3">
                {row.id}
              </td>
              <td className={cx("border-b border-line py-[7px] text-right font-mono tnum", markClass(row.m))}>
                {row.m}
              </td>
              <td className={cx("border-b border-line py-[7px] text-right font-mono tnum", markClass(row.p))}>
                {row.p}
              </td>
              <td className={cx("border-b border-line py-[7px] text-right font-mono tnum", markClass(row.c))}>
                {row.c}
              </td>
              <td
                className={cx(
                  "border-b border-l border-line bg-surface-2/40 py-[7px] text-right font-mono font-medium tnum",
                  markClass(row.avg),
                )}
              >
                {row.avg.toFixed(1)}
              </td>
              <td className="border-b border-line px-3 py-[7px] text-right">
                <span
                  className={cx(
                    "rounded border px-1 py-[1px] text-[10px] font-medium",
                    row.att === "Full"
                      ? "border-transparent text-ink-3"
                      : "border-danger-line bg-danger-soft text-danger",
                  )}
                >
                  {row.att}
                </span>
              </td>
            </tr>
          ))}
          <tr className="bg-surface-2/70">
            <td className="px-3 py-[7px] text-[9.5px] font-semibold uppercase tracking-[0.07em] text-ink-3">
              Class average
            </td>
            <td />
            <td className="py-[7px] text-right font-mono text-[11px] text-ink-2 tnum">76</td>
            <td className="py-[7px] text-right font-mono text-[11px] text-ink-2 tnum">76</td>
            <td className="py-[7px] text-right font-mono text-[11px] text-ink-2 tnum">76</td>
            <td className="border-l border-line py-[7px] text-right font-mono text-[11px] font-semibold text-ink tnum">
              76.1
            </td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Classroom overview ---------- */

export function ClassroomMock() {
  return (
    <div className="p-3">
      <div className="mb-2.5 grid grid-cols-4 divide-x divide-line rounded-lg border border-line">
        {[
          ["Students", "32"],
          ["Subjects", "4"],
          ["Tests graded", "3/4"],
          ["Class average", "76%"],
        ].map(([label, value]) => (
          <div key={label} className="px-2 py-1.5">
            <p className="text-[8.5px] font-medium uppercase tracking-[0.06em] text-ink-3">{label}</p>
            <p className="mt-0.5 font-mono text-[13px] font-medium text-ink tnum">{value}</p>
          </div>
        ))}
      </div>
      <div className="divide-y divide-line overflow-hidden rounded-lg border border-line">
        {[
          ["Algebra Midterm", "Mathematics · 17 days ago", "Graded", "82%", "accent"],
          ["Unit Test 3 — Laws of Motion", "Physics · 10 days ago", "Graded", "74%", "accent"],
          ["Periodic Table Quiz", "Chemistry · 4 days ago", "6 ready to grade", "—", "warn"],
          ["Comprehension & Writing", "English · Yesterday", "Needs answers", "—", "neutral"],
        ].map(([title, meta, status, avg, tone]) => (
          <div key={title} className="flex items-center gap-2 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11.5px] font-medium text-ink">{title}</p>
              <p className="text-[10px] text-ink-3">{meta}</p>
            </div>
            <span
              className={cx(
                "shrink-0 rounded border px-1.5 py-[1px] text-[10px] font-medium",
                tone === "accent"
                  ? "border-accent-line bg-accent-soft text-accent"
                  : tone === "warn"
                    ? "border-warn-line bg-warn-soft text-warn"
                    : "border-line bg-surface-2 text-ink-2",
              )}
            >
              {status}
            </span>
            <span className="w-8 shrink-0 text-right font-mono text-[11px] font-medium text-ink tnum">
              {avg}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Student import ---------- */

export function StudentsMock() {
  return (
    <div>
      <div className="flex items-center gap-1.5 border-b border-line bg-accent-soft/60 px-3 py-2 text-[10.5px] text-accent">
        <IconSparkle size={11} />
        Extracted 28 students from register-10a.jpg. Edit anything that looks wrong.
      </div>
      <table className="w-full border-separate border-spacing-0 text-[11.5px]">
        <thead>
          <tr className="text-[9.5px] uppercase tracking-[0.07em] text-ink-3">
            <th className="border-b border-line px-3 py-1.5 text-left font-semibold">ID</th>
            <th className="border-b border-line py-1.5 text-left font-semibold">Name</th>
            <th className="border-b border-line px-3 py-1.5 text-left font-semibold">Roll</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["STU-001", "Rahul Sharma", "1"],
            ["STU-002", "Priya Patel", "2"],
            ["STU-003", "Aarav Shah", "3"],
            ["STU-004", "Riya Shah", "4"],
            ["STU-005", "Ananya Iyer", "5"],
            ["STU-006", "Kabir Mehta", "6"],
          ].map(([id, name, roll]) => (
            <tr key={id}>
              <td className="border-b border-line px-3 py-[7px] font-mono text-[10.5px] text-ink-3">
                {id}
              </td>
              <td className="border-b border-line py-[7px] font-medium text-ink">{name}</td>
              <td className="border-b border-line px-3 py-[7px] font-mono text-[10.5px] text-ink-3">
                {roll}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[10.5px] text-ink-3">28 to add</span>
        <span className="rounded-md bg-ink px-2 py-1 text-[10.5px] font-medium text-paper">
          Add 28 students
        </span>
      </div>
    </div>
  );
}

/* ---------- Bulk upload matching ---------- */

export function UploadMock() {
  return (
    <div>
      <div className="flex items-center gap-1.5 border-b border-line bg-accent-soft/60 px-3 py-2 text-[10.5px] text-accent">
        <IconSparkle size={11} />
        24 sheets matched to students. Grading starts as soon as you confirm.
      </div>
      <ul className="divide-y divide-line">
        {[
          ["scan_0431.jpg", "Aarav Shah · STU-001", "Read from sheet", true],
          ["stu-002-answer.pdf", "Ananya Iyer · STU-002", "Student ID", false],
          ["kabir_mehta.jpg", "Kabir Mehta · STU-003", "Name", false],
          ["scan_0434.jpg", "Priya Patel · STU-004", "Read from sheet", true],
          ["roll-05.pdf", "Rahul Sharma · STU-005", "Roll number", false],
        ].map(([file, student, via, ai]) => (
          <li key={file as string} className="flex items-center gap-2 px-3 py-[7px]">
            <IconFile size={11} className="shrink-0 text-ink-4" />
            <span className="w-[38%] truncate font-mono text-[10.5px] text-ink-2">{file}</span>
            <span className="flex-1 truncate rounded border border-line bg-surface-2/60 px-1.5 py-[2px] text-[10.5px] text-ink">
              {student}
            </span>
            <span
              className={cx(
                "shrink-0 rounded border px-1 py-[1px] text-[9.5px] font-medium",
                ai ? "border-accent-line bg-accent-soft text-accent" : "border-line bg-surface-2 text-ink-2",
              )}
            >
              {via}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t border-line px-3 py-2">
        <span className="text-[10.5px] text-ink-3">24 of 24 matched</span>
        <span className="rounded-md bg-ink px-2 py-1 text-[10.5px] font-medium text-paper">
          Upload &amp; grade 24
        </span>
      </div>
    </div>
  );
}

