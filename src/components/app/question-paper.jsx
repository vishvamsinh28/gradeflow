"use client";

import { useEffect, useState } from "react";
import { Button, Segmented, Textarea, cx } from "@/components/ui/primitives";
import { Sheet, useToast } from "@/components/ui/overlays";
import { IconFile, IconPlus, IconSparkle, IconTrash, Spinner } from "@/components/ui/icons";
import { Dropzone } from "./dropzone";
import { extractQuestions } from "@/lib/api";
import { saveQuestions } from "@/lib/workspace";
import { pluralize } from "@/lib/format";

const BLANK = { label: "", prompt: "", answer: "", marks: 1 };

/**
 * One reading of the marks field, used by both the running total and the save.
 * A half-typed or cleared box should not show one number and store another.
 */
function marksOf(row) {
  const value = Number(row.marks);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

/**
 * The question paper editor.
 *
 * A paper is optional — without one the model reads the questions off each
 * student's sheet. Giving it one makes marking consistent across the class,
 * and an expected answer sharpens it further without being required.
 */
export function QuestionPaperSheet({ open, onClose, test, questions }) {
  const toast = useToast();
  const [mode, setMode] = useState("write");
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

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
        : [{ ...BLANK }],
    );
    setMode("write");
    setNote("");
    setBusy(false);
  }, [open, questions]);

  const usable = rows.filter((row) => row.prompt.trim());
  const total = usable.reduce((sum, row) => sum + marksOf(row), 0);

  function update(index, patch) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function readPaper(files) {
    const file = files[0];
    if (!file) return;
    setBusy(true);
    try {
      const { questions: found } = await extractQuestions(test.id, file);
      if (found.length === 0) {
        toast("No questions found on that page — try a clearer photo", "error");
        return;
      }
      setRows(
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

  async function commit() {
    setBusy(true);
    try {
      await saveQuestions(
        test.id,
        usable.map((row) => ({
          label: row.label.trim() || null,
          prompt: row.prompt.trim(),
          answer: row.answer.trim() || null,
          marks: marksOf(row),
        })),
      );
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
          <span className="mr-auto text-[12.5px] text-ink-3">
            {usable.length > 0
              ? `${pluralize(usable.length, "question")} · ${total} marks`
              : "Optional — without it the AI reads the questions off each sheet"}
          </span>
          <Button size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" loading={busy} onClick={() => void commit()}>
            Save paper
          </Button>
        </>
      }
    >
      <div className="px-5 py-4">
        <Segmented
          value={mode}
          onChange={setMode}
          className="mb-4"
          options={[
            {
              value: "write",
              label: "Write them",
              icon: <IconFile size={13} />,
            },
            {
              value: "upload",
              label: "Read a paper",
              icon: <IconSparkle size={13} />,
            },
          ]}
        />

        {mode === "upload" ? (
          <div>
            <Dropzone
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
                        aria-label={`Remove question ${index + 1}`}
                        onClick={() => setRows(rows.filter((_, i) => i !== index))}
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
              onClick={() => setRows([...rows, { ...BLANK }])}
              className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-3 transition-colors hover:text-accent"
            >
              <IconPlus size={13} /> Add a question
            </button>

            <p className="mt-3 text-[12.5px] leading-relaxed text-ink-3">
              The total comes from the marks here — {total > 0 ? `${total} so far` : "none yet"}.
              Leave the answers blank and the AI still marks the work; fill them in and it marks
              against yours.
            </p>
          </div>
        )}
      </div>
    </Sheet>
  );
}
