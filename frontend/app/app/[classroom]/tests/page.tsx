"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Button, EmptyState, Segmented, Select } from "@/components/ui/primitives";
import { IconCalendar, IconPlus } from "@/components/ui/icons";
import { useWorkspaceActions } from "@/components/app/shell";
import { TestRow, testState } from "@/components/app/test-bits";
import { testProgress, useClassroom } from "@/lib/workspace";
import { pluralize } from "@/lib/format";

type Filter = "all" | "open" | "graded";

export default function TestsPage() {
  const params = useParams<{ classroom: string }>();
  const { data: classroom } = useClassroom(params.classroom);
  const { newTest } = useWorkspaceActions();

  const [filter, setFilter] = useState<Filter>("all");
  const [subjectId, setSubjectId] = useState("");

  const tests = useMemo(() => {
    if (!classroom) return [];
    return [...classroom.tests]
      .sort((a, b) => b.test_date.localeCompare(a.test_date))
      .filter((test) => {
        if (subjectId && test.subject_id !== subjectId) return false;
        if (filter === "all") return true;
        const progress = testProgress(test, classroom.students, classroom.submissions, classroom.attendance);
        const done =
          test.status !== "grading" &&
          progress.graded > 0 &&
          progress.graded >= progress.expected;
        return filter === "graded" ? done : !done;
      });
  }, [classroom, filter, subjectId]);

  if (!classroom) return null;

  const openCount = classroom.tests.filter((test) => {
    const progress = testProgress(test, classroom.students, classroom.submissions, classroom.attendance);
    return !(test.status !== "grading" && progress.graded > 0 && progress.graded >= progress.expected);
  }).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: `All ${classroom.tests.length}` },
            { value: "open", label: `Open ${openCount}` },
            { value: "graded", label: `Graded ${classroom.tests.length - openCount}` },
          ]}
        />
        {classroom.subjects.length > 0 ? (
          <Select
            value={subjectId}
            onChange={(event) => setSubjectId(event.target.value)}
            className="h-8 w-auto min-w-[150px] text-[13px]"
          >
            <option value="">All subjects</option>
            {classroom.subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </Select>
        ) : null}
        <div className="ml-auto">
          <Button size="sm" variant="primary" icon={<IconPlus size={14} />} onClick={newTest}>
            New test
          </Button>
        </div>
      </div>

      <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {classroom.tests.length === 0 ? (
          <EmptyState
            icon={<IconCalendar size={17} />}
            title="No tests yet"
            description="A test needs a date. Everything else — subject, title, grading notes — is optional."
            action={
              <Button variant="primary" icon={<IconPlus size={15} />} onClick={newTest}>
                Create test
              </Button>
            }
          />
        ) : tests.length === 0 ? (
          <EmptyState
            title="Nothing here"
            description="No tests match the filters you have set."
            action={
              <Button
                size="sm"
                onClick={() => {
                  setFilter("all");
                  setSubjectId("");
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          tests.map((test) => <TestRow key={test.id} classroom={classroom} test={test} />)
        )}
      </div>

      {tests.length > 0 ? (
        <p className="mt-3 text-[12.5px] text-ink-3">
          {pluralize(tests.length, "test")}
          {filter !== "all" || subjectId ? " matching your filters" : ""}.{" "}
          {(() => {
            const needsWork = tests.filter((test) => {
              const state = testState(test, testProgress(test, classroom.students, classroom.submissions, classroom.attendance));
              return state.tone !== "accent" || state.busy;
            }).length;
            if (needsWork === 0) return "All caught up.";
            return needsWork === 1
              ? "1 still needs something from you."
              : `${needsWork} still need something from you.`;
          })()}
        </p>
      ) : null}
    </div>
  );
}
