"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Badge, Button, EmptyState, cx } from "@/components/ui/primitives";
import {
  IconArrowRight,
  IconCalendar,
  IconLayers,
  IconPlus,
  IconSparkle,
  IconUsers,
} from "@/components/ui/icons";
import { NewClassroomButton, PageHeader, useWorkspaceActions } from "@/components/app/shell";
import { classroomSummary, loadSampleData, testProgress, useDatabase } from "@/lib/store";
import { useToast } from "@/components/ui/overlays";
import { formatPercent, greeting, pluralize, relativeDay } from "@/lib/format";
import type { Classroom } from "@/lib/types";

export default function DashboardPage() {
  const db = useDatabase();
  const { newClassroom } = useWorkspaceActions();
  const toast = useToast();

  const totalStudents = db.classrooms.reduce(
    (sum, classroom) => sum + classroom.students.length,
    0,
  );

  /** Only real, actionable work lands here — never a metric for its own sake. */
  const attention = useMemo(() => {
    const items: {
      key: string;
      href: string;
      label: string;
      detail: string;
      tone: "warn" | "accent" | "neutral";
    }[] = [];

    db.classrooms.forEach((classroom) => {
      classroom.tests.forEach((test) => {
        const progress = testProgress(db, classroom, test);
        const name = test.title ?? "Untitled test";

        if (test.status === "grading") {
          items.push({
            key: `grading-${test.id}`,
            href: `/app/${classroom.slug}/tests/${test.id}`,
            label: `${name} is grading`,
            detail: `${progress.graded} of ${progress.submitted} done · ${classroom.name}`,
            tone: "accent",
          });
        } else if (progress.submitted > progress.graded) {
          items.push({
            key: `ungraded-${test.id}`,
            href: `/app/${classroom.slug}/tests/${test.id}`,
            label: `${progress.submitted - progress.graded} answers ready to grade`,
            detail: `${name} · ${classroom.name}`,
            tone: "accent",
          });
        } else if (test.status === "collecting" && progress.submitted < progress.expected) {
          items.push({
            key: `awaiting-${test.id}`,
            href: `/app/${classroom.slug}/tests/${test.id}`,
            label: `${name} needs answers`,
            detail: `${progress.submitted} of ${progress.expected} uploaded · ${classroom.name}`,
            tone: "neutral",
          });
        }

        if (progress.needsReview > 0) {
          items.push({
            key: `review-${test.id}`,
            href: `/app/${classroom.slug}/tests/${test.id}?filter=review`,
            label: `${pluralize(progress.needsReview, "result")} flagged for review`,
            detail: `${name} · ${classroom.name}`,
            tone: "warn",
          });
        }
      });
    });

    // Work you can act on right now floats to the top; reviews sit below it.
    const rank = { accent: 0, warn: 1, neutral: 2 } as const;
    return items.sort((a, b) => rank[a.tone] - rank[b.tone]).slice(0, 5);
  }, [db]);

  return (
    <div className="mx-auto w-full max-w-[1360px] px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        title={`${greeting()}, ${db.teacherName}`}
        subtitle={
          db.classrooms.length === 0
            ? "Start by creating your first classroom."
            : `${pluralize(db.classrooms.length, "classroom")} · ${pluralize(totalStudents, "student")}`
        }
        actions={db.classrooms.length > 0 ? <NewClassroomButton /> : undefined}
      />

      {attention.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.075em] text-ink-3">
            Needs you
          </h2>
          <ul className="mt-2.5 overflow-hidden rounded-xl border border-line bg-surface">
            {attention.map((item) => (
              <li key={item.key} className="border-b border-line last:border-b-0">
                <Link
                  href={item.href}
                  className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2"
                >
                  <span
                    className={cx(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      item.tone === "warn"
                        ? "bg-warn"
                        : item.tone === "accent"
                          ? "bg-accent"
                          : "bg-ink-4",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">
                    {item.label}
                  </span>
                  <span className="hidden shrink-0 truncate text-[12.5px] text-ink-3 sm:block">
                    {item.detail}
                  </span>
                  <IconArrowRight
                    size={14}
                    className="shrink-0 text-ink-4 transition-transform group-hover:translate-x-0.5 group-hover:text-ink-2"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.075em] text-ink-3">
          Classrooms
        </h2>

        {db.classrooms.length === 0 ? (
          <div className="mt-2.5 rounded-xl border border-dashed border-line-strong bg-surface">
            <EmptyState
              icon={<IconLayers size={17} />}
              title="No classrooms yet"
              description="A classroom holds your students, subjects, tests, marks and attendance. It takes about ten seconds to set up."
              action={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button variant="primary" icon={<IconPlus size={15} />} onClick={newClassroom}>
                    Create your first classroom
                  </Button>
                  <Button
                    icon={<IconSparkle size={15} />}
                    onClick={() => {
                      loadSampleData();
                      toast("Sample workspace loaded", "success");
                    }}
                  >
                    Explore with sample data
                  </Button>
                </div>
              }
            />
          </div>
        ) : (
          <div className="mt-2.5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {db.classrooms.map((classroom) => (
              <ClassroomCard key={classroom.id} classroom={classroom} />
            ))}
            <button
              onClick={newClassroom}
              className="group flex min-h-[172px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong bg-surface/40 text-ink-3 transition-colors hover:border-accent-line hover:bg-accent-soft/40 hover:text-accent"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface transition-colors group-hover:border-accent-line">
                <IconPlus size={16} />
              </span>
              <span className="text-[13.5px] font-medium">Create classroom</span>
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function ClassroomCard({ classroom }: { classroom: Classroom }) {
  const db = useDatabase();
  const summary = classroomSummary(db, classroom);

  return (
    <Link
      href={`/app/${classroom.slug}`}
      className="group flex min-h-[172px] flex-col rounded-xl border border-line bg-surface p-4 transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-[0_1px_2px_rgba(26,26,23,0.04),0_8px_24px_-16px_rgba(26,26,23,0.2)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold tracking-[-0.02em] text-ink">
            {classroom.name}
          </h3>
          {classroom.description ? (
            <p className="mt-0.5 line-clamp-1 text-[12.5px] text-ink-3">{classroom.description}</p>
          ) : null}
        </div>
        {summary.needsReview > 0 ? (
          <Badge tone="warn">{summary.needsReview} to review</Badge>
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-3.5 text-[12.5px] text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <IconUsers size={13} className="text-ink-4" />
          {classroom.students.length}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <IconLayers size={13} className="text-ink-4" />
          {pluralize(classroom.subjects.length, "subject")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <IconCalendar size={13} className="text-ink-4" />
          {pluralize(classroom.tests.length, "test")}
        </span>
      </div>

      <div className="mt-auto pt-4">
        {summary.latest ? (
          <div className="rounded-lg border border-line bg-surface-2/60 px-3 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[12.5px] font-medium text-ink-2">
                {summary.latest.title ?? "Untitled test"}
              </span>
              <span className="shrink-0 font-mono text-[12px] text-ink-3 tnum">
                {relativeDay(summary.latest.date)}
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className="text-[12px] text-ink-3">
                {summary.latestSubject ?? "No subject"}
              </span>
              {summary.latestAverage !== null ? (
                <span className="font-mono text-[12.5px] font-medium text-ink tnum">
                  {formatPercent(summary.latestAverage)} avg
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[12px] text-ink-3">
                  <IconSparkle size={11} />
                  Awaiting answers
                </span>
              )}
            </div>
          </div>
        ) : (
          <p className="text-[12.5px] text-ink-3">No tests yet</p>
        )}

        <span className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 transition-colors group-hover:text-accent">
          Open classroom
          <IconArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
