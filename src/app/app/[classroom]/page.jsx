"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Avatar, Button, EmptyState, Input, cx } from "@/components/ui/primitives";
import { useConfirm, useToast } from "@/components/ui/overlays";
import { IconCalendar, IconLayers, IconPlus, IconTrash } from "@/components/ui/icons";
import { useWorkspaceActions } from "@/components/app/shell";
import { TestRow } from "@/components/app/test-bits";
import { GradeScaleCard } from "@/components/app/grade-scale";
import {
  addSubject,
  removeSubject,
  renameSubject,
  testProgress,
  useClassroom,
} from "@/lib/workspace";
import { formatPercent, pluralize } from "@/lib/format";
export default function ClassroomOverviewPage() {
  const params = useParams();
  const { data: classroom } = useClassroom(params.classroom);
  const { newTest, addStudents } = useWorkspaceActions();
  if (!classroom) return null;
  const graded = classroom.tests.filter((test) => test.status === "graded").length;
  const averages = classroom.tests
    .map(
      (test) =>
        testProgress(test, classroom.students, classroom.submissions, classroom.attendance)
          .averagePercent,
    )
    .filter((value) => value !== null);
  const classAverage = averages.length
    ? averages.reduce((sum, value) => sum + value, 0) / averages.length
    : null;
  const recentTests = [...classroom.tests]
    .sort((a, b) => b.test_date.localeCompare(a.test_date))
    .slice(0, 6);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_310px]">
      <div className="min-w-0">
        <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
          <Stat label="Students" value={String(classroom.students.length)} />
          <Stat label="Subjects" value={String(classroom.subjects.length)} />
          <Stat label="Tests graded" value={`${graded}/${classroom.tests.length}`} />
          <Stat label="Class average" value={formatPercent(classAverage)} />
        </div>

        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.075em] text-ink-3">
              Tests
            </h2>
            {classroom.tests.length > 6 ? (
              <Link
                href={`/app/${classroom.slug}/tests`}
                className="text-[12.5px] font-medium text-ink-3 transition-colors hover:text-accent"
              >
                View all {classroom.tests.length}
              </Link>
            ) : null}
          </div>

          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {recentTests.length === 0 ? (
              <EmptyState
                icon={<IconCalendar size={17} />}
                title="No tests yet"
                description="Create a test, upload the answer sheets, and GradeFlow marks every one of them."
                action={
                  <Button variant="primary" icon={<IconPlus size={15} />} onClick={newTest}>
                    Create test
                  </Button>
                }
              />
            ) : (
              recentTests.map((test) => <TestRow key={test.id} classroom={classroom} test={test} />)
            )}
          </div>
        </section>
      </div>

      <div className="space-y-6">
        <SubjectsPanel classroom={classroom} />
        <GradeScaleCard classroom={classroom} />

        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.075em] text-ink-3">
              Students
            </h2>
            <Link
              href={`/app/${classroom.slug}/students`}
              className="text-[12.5px] font-medium text-ink-3 transition-colors hover:text-accent"
            >
              View all
            </Link>
          </div>

          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            {classroom.students.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-[13px] text-ink-3">No students yet.</p>
                <Button size="sm" className="mt-3" onClick={addStudents}>
                  Add students
                </Button>
              </div>
            ) : (
              <>
                <ul className="divide-y divide-line">
                  {classroom.students.slice(0, 6).map((student) => (
                    <li key={student.id} className="flex items-center gap-2.5 px-3 py-2">
                      <Avatar name={student.name} size={24} />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                        {student.name}
                      </span>
                      <span className="shrink-0 font-mono text-[11.5px] text-ink-4">
                        {student.code}
                      </span>
                    </li>
                  ))}
                </ul>
                {classroom.students.length > 6 ? (
                  <Link
                    href={`/app/${classroom.slug}/students`}
                    className="block border-t border-line px-3 py-2 text-center text-[12.5px] font-medium text-ink-3 transition-colors hover:bg-surface-2 hover:text-accent"
                  >
                    {pluralize(classroom.students.length - 6, "more student")}
                  </Link>
                ) : null}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
function Stat({ label, value }) {
  return (
    <div className="bg-surface px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-3">{label}</p>
      <p className="mt-0.5 font-mono text-[19px] font-medium tracking-[-0.02em] text-ink tnum">
        {value}
      </p>
    </div>
  );
}
function SubjectsPanel({ classroom }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  async function submit() {
    const name = draft.trim();
    setDraft("");
    if (!name) {
      setAdding(false);
      return;
    }
    try {
      await addSubject(classroom, name);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not add that subject", "error");
    }
  }
  async function remove(subjectId, name) {
    const ok = await confirm({
      title: `Remove ${name}?`,
      body: "Tests already filed under this subject keep their marks — they simply lose the subject label.",
      confirmLabel: "Remove subject",
      danger: true,
    });
    if (!ok) return;
    try {
      await removeSubject(classroom, subjectId);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not remove that subject", "error");
    }
  }
  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.075em] text-ink-3">
          Subjects
        </h2>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 text-[12.5px] font-medium text-ink-3 transition-colors hover:text-accent"
        >
          <IconPlus size={12} />
          Add
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {classroom.subjects.length === 0 && !adding ? (
          <div className="px-4 py-6 text-center">
            <IconLayers size={17} className="mx-auto mb-2 text-ink-4" />
            <p className="text-[13px] text-ink-3">
              No subjects yet. Tests work without them — subjects just group your marks.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {classroom.subjects.map((subject) => {
              const count = classroom.tests.filter((test) => test.subject_id === subject.id).length;
              return (
                <li key={subject.id} className="group/subject flex items-center gap-2 px-3 py-2">
                  <input
                    defaultValue={subject.name}
                    aria-label={`Rename ${subject.name}`}
                    onBlur={(event) => {
                      const next = event.target.value.trim();
                      if (next && next !== subject.name) {
                        void renameSubject(classroom, subject.id, next);
                      } else {
                        event.target.value = subject.name;
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                      if (event.key === "Escape") {
                        event.currentTarget.value = subject.name;
                        event.currentTarget.blur();
                      }
                    }}
                    className="min-w-0 flex-1 truncate rounded-[5px] border border-transparent bg-transparent px-1 py-0.5 text-[13px] text-ink outline-none transition-colors hover:border-line focus:border-accent focus:bg-surface"
                  />
                  <span className="shrink-0 text-[11.5px] text-ink-4">
                    {count > 0 ? pluralize(count, "test") : "—"}
                  </span>
                  <button
                    aria-label={`Remove ${subject.name}`}
                    onClick={() => void remove(subject.id, subject.name)}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-4 opacity-0 transition-all hover:bg-danger-soft hover:text-danger focus-visible:opacity-100 group-hover/subject:opacity-100"
                  >
                    <IconTrash size={12} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {adding ? (
          <div className={cx("p-2", classroom.subjects.length > 0 && "border-t border-line")}>
            <Input
              autoFocus
              value={draft}
              placeholder="Subject name"
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => void submit()}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submit();
                if (event.key === "Escape") {
                  setDraft("");
                  setAdding(false);
                }
              }}
              className="h-8 text-[13px]"
            />
            <p className="mt-1.5 px-1 text-[11.5px] text-ink-4">Enter to add · Esc to close</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
