"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Textarea, cx } from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";
import { DateField } from "@/components/ui/date-field";
import { Dialog, useToast } from "@/components/ui/overlays";
import { IconPlus, IconSparkle, IconX } from "@/components/ui/icons";
import { createClassroom, createTest, saveQuestions } from "@/lib/workspace";
import { extractQuestionsForClassroom } from "@/lib/api";
import {
  BLANK_QUESTION,
  QuestionRowsEditor,
  usableQuestions,
} from "@/components/app/question-paper";
import { todayISO } from "@/lib/format";
const SUBJECT_SUGGESTIONS = [
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "English",
  "Science",
  "History",
  "Geography",
  "Computer Science",
];

/* ---------- Subject chips ---------- */

function SubjectInput({ subjects, onChange }) {
  const [draft, setDraft] = useState("");
  function add(value) {
    const name = value.trim();
    if (!name) return;
    if (subjects.some((subject) => subject.toLowerCase() === name.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...subjects, name]);
    setDraft("");
  }
  const suggestions = SUBJECT_SUGGESTIONS.filter(
    (name) => !subjects.some((subject) => subject.toLowerCase() === name.toLowerCase()),
  ).slice(0, 5);
  return (
    <div>
      <div
        className={cx(
          "flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-line bg-surface px-1.5 py-1.5",
          "focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent/12",
        )}
      >
        {subjects.map((subject) => (
          <span
            key={subject}
            className="inline-flex items-center gap-1 rounded-[5px] border border-line bg-surface-2 py-[1px] pl-2 pr-1 text-[12.5px] font-medium text-ink-2"
          >
            {subject}
            <button
              type="button"
              aria-label={`Remove ${subject}`}
              onClick={() => onChange(subjects.filter((item) => item !== subject))}
              className="text-ink-4 transition-colors hover:text-danger"
            >
              <IconX size={12} />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              add(draft);
            } else if (event.key === "Backspace" && !draft && subjects.length > 0) {
              onChange(subjects.slice(0, -1));
            }
          }}
          onBlur={() => add(draft)}
          placeholder={subjects.length === 0 ? "Mathematics, Physics…" : ""}
          className="h-6 min-w-[8ch] flex-1 bg-transparent px-1 text-[13.5px] outline-none placeholder:text-ink-4"
        />
      </div>
      {suggestions.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => add(name)}
              className="inline-flex items-center gap-1 rounded-[5px] border border-dashed border-line px-1.5 py-[1px] text-[12px] font-medium text-ink-3 transition-colors hover:border-accent-line hover:bg-accent-soft hover:text-accent"
            >
              <IconPlus size={11} />
              {name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ---------- Create classroom ---------- */

export function CreateClassroomDialog({ open, onClose }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [subjects, setSubjects] = useState([]);
  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setSubjects([]);
    }
  }, [open]);
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const classroom = await createClassroom({
        name,
        description,
        subjects,
      });
      onClose();
      toast(`${classroom.name} created`, "success");
      router.push(`/app/${classroom.slug}`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not create that classroom", "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New classroom"
      description="You can add students and subjects at any time."
      footer={
        <>
          <Button size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            loading={busy}
            onClick={() => void submit()}
            disabled={!name.trim()}
          >
            Create classroom
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field label="Classroom name">
          <Input
            data-autofocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Class 10-A"
          />
        </Field>
        <Field label="Description" optional>
          <Input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Board year section, weekly unit tests"
          />
        </Field>
        <Field label="Subjects" optional hint="Press Enter after each one.">
          <SubjectInput subjects={subjects} onChange={setSubjects} />
        </Field>
      </form>
    </Dialog>
  );
}

/* ---------- Create test ---------- */

export function CreateTestDialog({ open, onClose, classroom }) {
  const router = useRouter();
  const toast = useToast();
  const [date, setDate] = useState(todayISO());
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [maxMarks, setMaxMarks] = useState("100");
  const [instructions, setInstructions] = useState("");
  const [paperOpen, setPaperOpen] = useState(false);
  const [rows, setRows] = useState([]);
  useEffect(() => {
    if (!open) return;
    setDate(todayISO());
    setSubjectId(classroom?.subjects[0]?.id ?? "");
    setTitle("");
    setMaxMarks("100");
    setInstructions("");
    setPaperOpen(false);
    setRows([]);
  }, [open, classroom]);
  // The teacher's total is the ceiling; the paper has to fit inside it.
  const paper = useMemo(() => usableQuestions(rows), [rows]);
  const paperTotal = paper.reduce((sum, question) => sum + question.marks, 0);
  const marks = useMemo(() => Number(maxMarks) || 100, [maxMarks]);
  const paperOverLimit = paperTotal > marks;
  const [saving, setSaving] = useState(false);
  async function submit() {
    if (!classroom || !date || saving) return;
    setSaving(true);
    try {
      const test = await createTest(classroom, {
        test_date: date,
        subject_id: subjectId || undefined,
        title: title || undefined,
        instructions: instructions || undefined,
        max_marks: marks,
      });
      if (paper.length > 0) {
        // The test exists either way; a failed paper save should land the
        // teacher on the test page with a clear message, not undo the test.
        try {
          await saveQuestions(test.id, paper);
        } catch {
          toast(
            "Test created, but the question paper did not save — add it on the test page",
            "error",
          );
          onClose();
          router.push(`/app/${classroom.slug}/tests/${test.id}`);
          return;
        }
      }
      onClose();
      toast(
        paper.length > 0
          ? `Test created with ${paper.length} question${paper.length === 1 ? "" : "s"}`
          : "Test created — upload answer sheets when you're ready",
        "success",
      );
      router.push(`/app/${classroom.slug}/tests/${test.id}`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not create that test", "error");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New test"
      description={classroom ? `In ${classroom.name}` : undefined}
      width={560}
      footer={
        <>
          <Button size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            loading={saving}
            onClick={() => void submit()}
            disabled={!date || paperOverLimit}
          >
            Create test
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Test date">
            <DateField data-autofocus aria-label="Test date" value={date} onChange={setDate} />
          </Field>
          <Field label="Subject" optional>
            <Select
              value={subjectId}
              onChange={setSubjectId}
              placeholder="No subject"
              className="w-full"
              options={[
                {
                  value: "",
                  label: "No subject",
                },
                ...(classroom?.subjects ?? []).map((subject) => ({
                  value: subject.id,
                  label: subject.name,
                })),
              ]}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
          <Field label="Title" optional>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Unit Test 3"
            />
          </Field>
          <Field
            label="Total marks"
            optional
            hint={paper.length > 0 ? `${paperTotal} of ${marks} used by the paper.` : undefined}
          >
            <Input
              type="number"
              min={1}
              value={maxMarks}
              onChange={(event) => setMaxMarks(event.target.value)}
              aria-invalid={paperOverLimit}
              className={paperOverLimit ? "border-danger" : undefined}
            />
          </Field>
        </div>

        <div className="rounded-lg border border-line">
          <button
            type="button"
            onClick={() => {
              setPaperOpen((value) => !value);
              if (!paperOpen && rows.length === 0) setRows([{ ...BLANK_QUESTION }]);
            }}
            aria-expanded={paperOpen}
            className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-2"
          >
            <IconSparkle size={14} className="shrink-0 text-accent" />
            <span className="flex-1 text-[13px] font-medium text-ink">
              Question paper
              <span className="ml-1.5 font-normal text-ink-4">Optional</span>
            </span>
            <span className={cx("text-[12.5px]", paperOverLimit ? "text-danger" : "text-ink-3")}>
              {paper.length > 0
                ? `${paper.length} question${paper.length === 1 ? "" : "s"} · ${paperTotal} of ${marks} marks`
                : paperOpen
                  ? "Hide"
                  : "Write it or photograph it"}
            </span>
          </button>
          {paperOpen ? (
            <div className="border-t border-line px-3.5 py-3.5">
              <QuestionRowsEditor
                rows={rows}
                onRows={setRows}
                limit={marks}
                extract={(file) => extractQuestionsForClassroom(classroom.id, file)}
              />
            </div>
          ) : null}
        </div>

        <Field
          label="Grading notes for AI"
          optional
          hint="Plain English. The AI works out the rest from the answer sheets."
        >
          <Textarea
            rows={3}
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="Give partial marks when the method is right but the arithmetic slips. Be strict about units."
          />
        </Field>

        <div className="flex items-start gap-2 rounded-md border border-accent-line bg-accent-soft px-3 py-2.5 text-[12.5px] leading-snug text-accent">
          <IconSparkle size={14} className="mt-[1px] shrink-0" />
          <span>
            No rubric to build. Upload the answer sheets and GradeFlow grades against the paper
            itself, following any notes you leave here.
          </span>
        </div>
      </form>
    </Dialog>
  );
}
