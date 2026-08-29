"use client";

import Link from "next/link";
import { Badge, Progress, cx } from "@/components/ui/primitives";
import { IconAlert, IconArrowRight, Spinner } from "@/components/ui/icons";
import { formatPercent, relativeDay } from "@/lib/format";
import { testProgress, useDatabase } from "@/lib/store";
import type { Classroom, Test, TestProgress } from "@/lib/types";

export function testState(test: Test, progress: TestProgress) {
  if (test.status === "grading") {
    return {
      tone: "accent" as const,
      label: `Grading ${progress.graded}/${progress.submitted}`,
      busy: true,
    };
  }
  if (progress.submitted > progress.graded) {
    return {
      tone: "warn" as const,
      label: `${progress.submitted - progress.graded} ready to grade`,
      busy: false,
    };
  }
  if (progress.graded > 0 && progress.graded >= progress.expected) {
    return { tone: "accent" as const, label: "Graded", busy: false };
  }
  if (progress.submitted === 0) {
    return { tone: "neutral" as const, label: "Needs answers", busy: false };
  }
  return {
    tone: "neutral" as const,
    label: `${progress.submitted} of ${progress.expected} uploaded`,
    busy: false,
  };
}

export function TestStatusBadge({ test, progress }: { test: Test; progress: TestProgress }) {
  const state = testState(test, progress);
  return (
    <Badge tone={state.tone} icon={state.busy ? <Spinner size={11} /> : undefined}>
      {state.label}
    </Badge>
  );
}

export function TestRow({ classroom, test }: { classroom: Classroom; test: Test }) {
  const db = useDatabase();
  const progress = testProgress(db, classroom, test);
  const subject = classroom.subjects.find((item) => item.id === test.subjectId);
  const percentDone =
    progress.expected > 0 ? (progress.graded / progress.expected) * 100 : 0;

  return (
    <Link
      href={`/app/${classroom.slug}/tests/${test.id}`}
      className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-2"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13.5px] font-medium text-ink">
            {test.title ?? "Untitled test"}
          </span>
          {progress.needsReview > 0 ? (
            <span
              className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-warn"
              title={`${progress.needsReview} flagged for review`}
            >
              <IconAlert size={12} />
              {progress.needsReview}
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-ink-3">
          <span className="truncate">{subject?.name ?? "No subject"}</span>
          <span className="text-ink-4">·</span>
          <span className="shrink-0 tnum">{relativeDay(test.date)}</span>
          {progress.absent > 0 ? (
            <>
              <span className="text-ink-4">·</span>
              <span className="shrink-0">{progress.absent} absent</span>
            </>
          ) : null}
        </div>
      </div>

      <div className="hidden w-[132px] shrink-0 sm:block">
        <Progress value={percentDone} />
        <p className="mt-1.5 text-right font-mono text-[11.5px] text-ink-3 tnum">
          {progress.graded}/{progress.expected} graded
        </p>
      </div>

      <div className="hidden w-[112px] shrink-0 justify-end md:flex">
        <TestStatusBadge test={test} progress={progress} />
      </div>

      <div className="w-[52px] shrink-0 text-right">
        <span
          className={cx(
            "font-mono text-[13.5px] font-medium tnum",
            progress.averagePercent === null ? "text-ink-4" : "text-ink",
          )}
        >
          {formatPercent(progress.averagePercent)}
        </span>
      </div>

      <IconArrowRight
        size={14}
        className="shrink-0 text-ink-4 transition-transform group-hover:translate-x-0.5 group-hover:text-ink-2"
      />
    </Link>
  );
}
