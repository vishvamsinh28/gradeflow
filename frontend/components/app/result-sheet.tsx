"use client";

import { useEffect, useState } from "react";
import { Badge, Button, IconButton, Input, Kbd, cx } from "@/components/ui/primitives";
import { Sheet, useToast } from "@/components/ui/overlays";
import {
  IconAlert,
  IconArrowDown,
  IconArrowUp,
  IconCheck,
  IconFile,
  IconSparkle,
} from "@/components/ui/icons";
import { acceptResult, overrideScore } from "@/lib/store";
import { formatMark, formatPercent, markTone } from "@/lib/format";
import type { Student, Submission, Test } from "@/lib/types";

const TONE_TEXT = {
  strong: "text-accent",
  fine: "text-ink",
  watch: "text-warn",
  low: "text-danger",
  none: "text-ink-4",
} as const;

export function ResultSheet({
  submission,
  student,
  test,
  onClose,
  onStep,
  position,
}: {
  submission: Submission | null;
  student: Student | undefined;
  test: Test;
  onClose: () => void;
  /** Moves to the previous/next result in the list the teacher is looking at. */
  onStep?: (direction: -1 | 1) => void;
  position?: { index: number; total: number };
}) {
  const toast = useToast();
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setDraft(submission?.score !== undefined ? String(submission.score) : "");
  }, [submission]);

  // Walk a batch of results without closing the panel between each one.
  useEffect(() => {
    if (!submission || !onStep) return;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      if (event.key === "ArrowDown" || event.key === "j") {
        event.preventDefault();
        onStep?.(1);
      } else if (event.key === "ArrowUp" || event.key === "k") {
        event.preventDefault();
        onStep?.(-1);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [submission, onStep]);

  const percent =
    submission?.outOf && submission.score !== undefined
      ? (submission.score / submission.outOf) * 100
      : null;

  const changed =
    submission?.score !== undefined && draft !== "" && Number(draft) !== submission.score;

  function save() {
    if (!submission || draft === "") return;
    const value = Math.max(0, Math.min(Number(draft), submission.outOf ?? test.maxMarks));
    overrideScore(submission.id, value);
    toast("Mark updated", "success");
    if (onStep && position && position.total > 1) onStep(1);
    else onClose();
  }

  return (
    <Sheet
      open={submission !== null}
      onClose={onClose}
      title={student?.name ?? "Result"}
      description={student ? `${student.code} · ${test.title ?? "Untitled test"}` : undefined}
      width={560}
      footer={
        <>
          {onStep && position && position.total > 1 ? (
            <div className="mr-auto flex items-center gap-1.5">
              <IconButton label="Previous student" size="sm" onClick={() => onStep(-1)}>
                <IconArrowUp size={14} />
              </IconButton>
              <IconButton label="Next student" size="sm" onClick={() => onStep(1)}>
                <IconArrowDown size={14} />
              </IconButton>
              <span className="ml-1 font-mono text-[12px] text-ink-3 tnum">
                {position.index + 1}/{position.total}
              </span>
              <span className="ml-1 hidden items-center gap-1 text-[11.5px] text-ink-4 sm:flex">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd>
              </span>
            </div>
          ) : null}
          {submission?.needsReview ? (
            <Button
              size="sm"
              icon={<IconCheck size={14} />}
              onClick={() => {
                acceptResult(submission.id);
                toast("Marked as reviewed", "success");
                if (onStep && position && position.total > 1) onStep(1);
                else onClose();
              }}
            >
              Looks right
            </Button>
          ) : null}
          <Button size="sm" onClick={onClose}>
            Close
          </Button>
          <Button size="sm" variant="primary" onClick={save} disabled={!changed}>
            Save mark
          </Button>
        </>
      }
    >
      {submission ? (
        <div>
          <div className="border-b border-line px-5 py-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
                  Mark
                </p>
                <p className="mt-1 flex items-baseline gap-1.5">
                  <span
                    className={cx(
                      "font-mono text-[30px] font-medium tracking-[-0.03em] tnum",
                      TONE_TEXT[markTone(percent)],
                    )}
                  >
                    {formatMark(submission.score ?? 0)}
                  </span>
                  <span className="font-mono text-[16px] text-ink-4 tnum">
                    / {submission.outOf ?? test.maxMarks}
                  </span>
                  <span className="ml-1 font-mono text-[14px] text-ink-3 tnum">
                    {formatPercent(percent)}
                  </span>
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                {submission.overridden ? <Badge tone="neutral">Edited by you</Badge> : null}
                {submission.needsReview ? (
                  <Badge tone="warn" icon={<IconAlert size={11} />}>
                    Wants a second look
                  </Badge>
                ) : null}
                {submission.fileName ? (
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11.5px] text-ink-4">
                    <IconFile size={11} />
                    {submission.fileName}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="mt-4 flex items-end gap-2">
              <label className="flex-1">
                <span className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
                  Override the mark
                </span>
                <Input
                  type="number"
                  min={0}
                  max={submission.outOf ?? test.maxMarks}
                  step={0.5}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  className="h-8 max-w-[130px] font-mono"
                />
              </label>
            </div>
          </div>

          {submission.summary ? (
            <div className="border-b border-line px-5 py-4">
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
                <IconSparkle size={11} />
                Summary
              </p>
              <p className="text-[13.5px] leading-relaxed text-ink-2">{submission.summary}</p>
            </div>
          ) : null}

          {submission.questions && submission.questions.length > 0 ? (
            <div>
              <p className="px-5 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
                Question by question
              </p>
              <ul className="divide-y divide-line border-t border-line">
                {submission.questions.map((question) => {
                  const ratio = question.outOf > 0 ? (question.awarded / question.outOf) * 100 : 0;
                  return (
                    <li key={question.number} className="flex gap-3 px-5 py-3">
                      <span className="w-8 shrink-0 pt-0.5 font-mono text-[12.5px] font-medium text-ink-3">
                        {question.number}
                      </span>
                      <p className="flex-1 text-[13px] leading-relaxed text-ink-2">{question.note}</p>
                      <span
                        className={cx(
                          "shrink-0 pt-0.5 font-mono text-[13px] font-medium tnum",
                          TONE_TEXT[markTone(ratio)],
                        )}
                      >
                        {formatMark(question.awarded)}
                        <span className="text-ink-4">/{formatMark(question.outOf)}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </Sheet>
  );
}
