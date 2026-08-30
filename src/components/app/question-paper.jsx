"use client";

import { useEffect, useState } from "react";
import { Button, Segmented, Textarea, cx } from "@/components/ui/primitives";
import { Sheet, useToast } from "@/components/ui/overlays";
import { IconFile, IconPlus, IconSparkle, IconTrash, Spinner } from "@/components/ui/icons";
import { Dropzone } from "./dropzone";
import { extractQuestions } from "@/lib/api";
import { saveQuestions } from "@/lib/workspace";
import { pluralize } from "@/lib/format";

export const BLANK_QUESTION = { label: "", prompt: "", answer: "", marks: 1 };

/**
 * One reading of the marks field, used by both the running total and the save.
 * A half-typed or cleared box should not show one number and store another.
 */
export function marksOf(row) {
  const value = Number(row.marks);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

/** The rows a teacher edited, ready for the API. */
export function usableQuestions(rows) {
  return rows
    .filter((row) => row.prompt.trim())
    .map((row) => ({
      label: row.label.trim() || null,
      prompt: row.prompt.trim(),
      answer: row.answer.trim() || null,
      marks: marksOf(row),
    }));
}

/**
 * The question paper editor — write the questions by hand or photograph the
 * paper and let the model read them. Answers are optional throughout: without
 * one the model marks the work on its own; with one it marks against yours.
 *
 * Used in two places with the same behaviour: inside the create-test dialog,
 * and on the test page for a paper added or changed later. `extract` is the
 * only difference — before the test exists it runs against the classroom.
 */
export function QuestionRowsEditor({ rows, onRows, extract, limit }) {
  const toast = useToast();
  const [mode, setMode] = useState("write");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const usable = rows.filter((row) => row.prompt.trim());
  const total = usable.reduce((sum, row) => sum + marksOf(row), 0);

  function update(index, patch) {
    onRows(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function readPaper(files) {
    const file = files[0];
    if (!file) return;
    setBusy(true);
    try {
      const { questions: found } = await extract(file);
      if (found.length === 0) {
        toast("No questions found on that page — try a clearer photo", "error");
        return;
      }
      onRows(
        found.map((question) => ({
          label: question.label ?? "",
          prompt: question.prompt,
          answer: question.answer ?? "",
          marks: question.marks ?? 1,
        })),
      );
      setNote(`Read ${pluralize(found.length, "question")} off ${file.name}.`);
      setMode("write");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not read that paper", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Segmented
        value={mode}
        onChange={setMode}
        className="mb-3"
        options={[
          { value: "write", label: "Write them", icon: <IconFile size={13} /> },
          { value: "upload", label: "Read a paper", icon: <IconSparkle size={13} /> },
        ]}
      />

      {mode === "upload" ? (
        <div>
          <Dropzone
            compact
            accept="image/*,.pdf"
            onFiles={readPaper}
            disabled={busy}
            title={busy ? "Reading the paper…" : "Photograph the question paper"}
            hint="A photo, scan or PDF. If it is a marking scheme, the answers are picked up too."
            icon={busy ? <Spinner size={16} /> : <IconSparkle size={16} />}
          />
          <p className="mt-2 text-[12.5px] text-ink-3">
            You review every question before anything is saved.
          </p>
        </div>
      ) : (
        <div>
          {note ? (
            <div className="mb-3 flex items-center gap-2 rounded-md bg-accent-soft/50 px-3 py-2 text-[12.5px] text-accent">
              <IconSparkle size={13} className="shrink-0" />
              {note} Edit anything that looks wrong.
            </div>
          ) : null}

          <div className="grid gap-3">
            {rows.map((row, index) => (
              <div
                key={index}
                className="group/q rounded-lg border border-line bg-surface-2/40 p-3"
              >
                <div className="mb-2 flex items-center gap-2">
                  <input
                    value={row.label}
                    onChange={(event) => update(index, { label: event.target.value })}
                    placeholder={`Q${index + 1}`}
                    aria-label="Question number"
                    className="h-7 w-16 rounded-[5px] border border-line bg-surface px-2 font-mono text-[12px] text-ink-2 outline-none transition-colors placeholder:text-ink-4 focus:border-accent"
                  />
                  <div className="ml-auto flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={row.marks}
                      onChange={(event) => update(index, { marks: event.target.value })}
                      aria-label="Marks"
                      className="h-7 w-16 rounded-[5px] border border-line bg-surface px-2 text-right font-mono text-[12px] text-ink outline-none transition-colors focus:border-accent"
                    />
                    <span className="text-[12px] text-ink-3">marks</span>
                    <button
                      type="button"
                      aria-label={`Remove question ${index + 1}`}
                      onClick={() => onRows(rows.filter((_, i) => i !== index))}
                      className="ml-1 flex h-6 w-6 items-center justify-center rounded-[5px] text-ink-4 opacity-0 transition-all hover:bg-danger-soft hover:text-danger focus-visible:opacity-100 group-hover/q:opacity-100"
                    >
                      <IconTrash size={13} />
                    </button>
                  </div>
                </div>

                <Textarea
                  rows={2}
                  value={row.prompt}
                  onChange={(event) => update(index, { prompt: event.target.value })}
                  placeholder="The question, as it appears on the paper"
                  className="text-[13px]"
                />

                <Textarea
                  rows={1}
                  value={row.answer}
                  onChange={(event) => update(index, { answer: event.target.value })}
                  placeholder="Expected answer — optional"
                  className={cx("mt-2 text-[13px]", !row.answer && "text-ink-3")}
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onRows([...rows, { ...BLANK_QUESTION }])}
            className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-3 transition-colors hover:text-accent"
          >
            <IconPlus size={13} /> Add a question
          </button>

          <p
            className={cx(
              "mt-3 text-[12.5px] leading-relaxed",
              limit && total > limit ? "font-medium text-danger" : "text-ink-3",
            )}
          >
            {limit
              ? total > limit
                ? `These questions add up to ${total} marks — more than the test's total of ${limit}. Lower some marks, or raise the total.`
                : `${total} of the test's ${limit} marks used.`
              : total > 0
                ? `${total} marks so far.`
                : "No marks yet."}{" "}
            Leave the answers blank and the AI still marks the work; fill them in and it marks
            against yours.
          </p>
        </div>
      )}
    </div>
  );
}

/** The same editor on the test page, for a paper added or changed later. */
export function QuestionPaperSheet({ open, onClose, test, questions }) {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRows(
      questions.length
        ? questions.map((question) => ({
            label: question.label ?? "",
            prompt: question.prompt,
            answer: question.answer ?? "",
            marks: Number(question.marks),
          }))
        : [{ ...BLANK_QUESTION }],
    );
    setBusy(false);
  }, [open, questions]);

  const usable = usableQuestions(rows);
  const total = usable.reduce((sum, row) => sum + row.marks, 0);
  const overLimit = total > Number(test.max_marks);

  async function commit() {
    setBusy(true);
    try {
      await saveQuestions(test.id, usable);
      onClose();
      toast(
        usable.length === 0
          ? "Question paper removed"
          : `Saved ${pluralize(usable.length, "question")} · ${total} marks`,
        "success",
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save the paper", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Question paper"
      description={test.title ?? "Untitled test"}
      footer={
        <>
          <span className={cx("mr-auto text-[12.5px]", overLimit ? "text-danger" : "text-ink-3")}>
            {usable.length > 0
              ? `${pluralize(usable.length, "question")} · ${total} of ${Number(test.max_marks)} marks`
              : "Optional — without it the AI reads the questions off each sheet"}
          </span>
          <Button size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            loading={busy}
            disabled={overLimit}
            onClick={() => void commit()}
          >
            Save paper
          </Button>
        </>
      }
    >
      <div className="px-5 py-4">
        <QuestionRowsEditor
          rows={rows}
          onRows={setRows}
          limit={Number(test.max_marks)}
          extract={(file) => extractQuestions(test.id, file)}
        />
      </div>
    </Sheet>
  );
}
