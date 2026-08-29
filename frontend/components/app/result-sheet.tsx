"use client";

import { useEffect, useState } from "react";
import { Badge, Button, IconButton, Input, Kbd, Segmented, cx } from "@/components/ui/primitives";
import { Sheet, useToast } from "@/components/ui/overlays";
import {
  IconAlert,
  IconArrowDown,
  IconArrowUp,
  IconCheck,
  IconFile,
  IconSparkle,
  Spinner,
} from "@/components/ui/icons";
import { fetchSheet } from "@/lib/api";
import { reviewSubmission } from "@/lib/workspace";
import { formatMark, formatPercent, markTone, MARK_TONE_CLASS } from "@/lib/format";
import type { Student, Submission, Test } from "@/lib/types";

/**
 * The answer sheet itself.
 *
 * A teacher will not release thirty marks they cannot check, so the paper sits
 * beside the marks rather than behind a download.
 */
function SheetViewer({ submission }: { submission: Submission }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let alive = true;
    setUrl(null);
    setError(null);

    fetchSheet(submission.id)
      .then((created) => {
        objectUrl = created;
        if (alive) setUrl(created);
        else URL.revokeObjectURL(created);
      })
      .catch(() => alive && setError("Could not load the answer sheet."));

    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [submission.id]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <p className="text-[13px] text-ink-3">{error}</p>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-[13px] text-ink-3">
        <Spinner size={14} />
        Loading the sheet…
      </div>
    );
  }

  const isPdf = (submission.mime_type ?? "").includes("pdf");
  return isPdf ? (
    <iframe title="Answer sheet" src={url} className="h-full w-full border-0 bg-surface-2" />
  ) : (
    <div className="h-full overflow-auto bg-surface-2 p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Answer sheet" className="mx-auto max-w-full rounded-md" />
    </div>
  );
}

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
  onStep?: (direction: -1 | 1) => void;
  position?: { index: number; total: number };
}) {
  const toast = useToast();
  const [draft, setDraft] = useState("");
  const [pane, setPane] = useState<"marks" | "sheet">("marks");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(submission?.score !== null && submission?.score !== undefined ? String(submission.score) : "");
  }, [submission]);

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
    submission?.out_of && submission.score !== null && submission.score !== undefined
      ? (submission.score / submission.out_of) * 100
      : null;

  const changed =
    submission?.score !== null &&
    submission?.score !== undefined &&
    draft !== "" &&
    Number(draft) !== submission.score;

  async function save() {
    if (!submission || draft === "") return;
    setSaving(true);
    try {
      await reviewSubmission(test.id, submission.id, {
        score: Math.max(0, Math.min(Number(draft), submission.out_of ?? test.max_marks)),
      });
      toast("Mark updated", "success");
      if (onStep && position && position.total > 1) onStep(1);
      else onClose();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save that mark", "error");
    } finally {
      setSaving(false);
    }
  }

  async function accept() {
    if (!submission) return;
    try {
      await reviewSubmission(test.id, submission.id, { accept: true });
      toast("Marked as reviewed", "success");
      if (onStep && position && position.total > 1) onStep(1);
      else onClose();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save that", "error");
    }
  }

  return (
    <Sheet
      open={submission !== null}
      onClose={onClose}
      title={student?.name ?? "Result"}
      description={student ? `${student.code} · ${test.title ?? "Untitled test"}` : undefined}
      width={880}
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
          {submission?.needs_review ? (
            <Button size="sm" icon={<IconCheck size={14} />} onClick={() => void accept()}>
              Looks right
            </Button>
          ) : null}
          <Button size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            size="sm"
            variant="primary"
            loading={saving}
            onClick={() => void save()}
            disabled={!changed}
          >
            Save mark
          </Button>
        </>
      }
    >
      {submission ? (
        <div className="flex h-full flex-col lg:flex-row">
          {/* The paper. Full height on desktop; a tab on a phone. */}
          <div
            className={cx(
              "min-h-[280px] flex-1 border-line lg:min-h-0 lg:border-r",
              pane === "sheet" ? "block" : "hidden lg:block",
            )}
          >
            {!submission.file_name ? (
              <div className="flex h-full items-center justify-center px-6 text-center text-[13px] text-ink-3">
                No answer sheet was stored for this student.
              </div>
            ) : (
              <SheetViewer submission={submission} />
            )}
          </div>

          <div
            className={cx(
              "w-full shrink-0 overflow-y-auto lg:w-[360px]",
              pane === "marks" ? "block" : "hidden lg:block",
            )}
          >
            <div className="border-b border-line px-5 py-3 lg:hidden">
              <Segmented
                value={pane}
                onChange={setPane}
                options={[
                  { value: "marks", label: "Marks" },
                  { value: "sheet", label: "Answer sheet" },
                ]}
              />
            </div>

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
                        MARK_TONE_CLASS[markTone(percent)],
                      )}
                    >
                      {formatMark(submission.score ?? 0)}
                    </span>
                    <span className="font-mono text-[16px] text-ink-4 tnum">
                      / {submission.out_of ?? test.max_marks}
                    </span>
                    <span className="ml-1 font-mono text-[14px] text-ink-3 tnum">
                      {formatPercent(percent)}
                    </span>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  {submission.overridden ? <Badge tone="neutral">Edited by you</Badge> : null}
                  {submission.needs_review ? (
                    <Badge tone="warn" icon={<IconAlert size={11} />}>
                      Wants a second look
                    </Badge>
                  ) : null}
                  {submission.file_name ? (
                    <span className="inline-flex items-center gap-1.5 font-mono text-[11.5px] text-ink-4">
                      <IconFile size={11} />
                      {submission.file_name}
                    </span>
                  ) : null}
                </div>
              </div>

              {submission.error_message ? (
                <p className="mt-3 rounded-md border border-warn-line bg-warn-soft px-2.5 py-1.5 text-[12.5px] leading-snug text-warn">
                  {submission.error_message}
                </p>
              ) : null}

              <label className="mt-4 block">
                <span className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
                  Override the mark
                </span>
                <Input
                  type="number"
                  min={0}
                  max={submission.out_of ?? test.max_marks}
                  step={0.5}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  className="h-8 max-w-[130px] font-mono"
                />
              </label>
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

            {submission.questions.length > 0 ? (
              <div>
                <p className="px-5 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
                  Question by question
                </p>
                <ul className="divide-y divide-line border-t border-line">
                  {submission.questions.map((question) => {
                    const ratio = question.out_of > 0 ? (question.awarded / question.out_of) * 100 : 0;
                    return (
                      <li key={question.number} className="flex gap-3 px-5 py-3">
                        <span className="w-8 shrink-0 pt-0.5 font-mono text-[12.5px] font-medium text-ink-3">
                          {question.number}
                        </span>
                        <p className="flex-1 text-[13px] leading-relaxed text-ink-2">
                          {question.note}
                        </p>
                        <span
                          className={cx(
                            "shrink-0 pt-0.5 font-mono text-[13px] font-medium tnum",
                            MARK_TONE_CLASS[markTone(ratio)],
                          )}
                        >
                          {formatMark(question.awarded)}
                          <span className="text-ink-4">/{formatMark(question.out_of)}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </Sheet>
  );
}
