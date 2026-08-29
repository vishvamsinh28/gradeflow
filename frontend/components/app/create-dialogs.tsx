"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select, Textarea, cx } from "@/components/ui/primitives";
import { Dialog, useToast } from "@/components/ui/overlays";
import { IconPlus, IconSparkle, IconX } from "@/components/ui/icons";
import { createClassroom, createTest } from "@/lib/store";
import { todayISO } from "@/lib/format";
import type { Classroom } from "@/lib/types";

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

function SubjectInput({
  subjects,
  onChange,
}: {
  subjects: string[];
  onChange: (subjects: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function add(value: string) {
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

export function CreateClassroomDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setSubjects([]);
    }
  }, [open]);

  function submit() {
    if (!name.trim()) return;
    const classroom = createClassroom({ name, description, subjects });
    onClose();
    toast(`${classroom.name} created`, "success");
    router.push(`/app/${classroom.slug}`);
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
          <Button size="sm" variant="primary" onClick={submit} disabled={!name.trim()}>
            Create classroom
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
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

export function CreateTestDialog({
  open,
  onClose,
  classroom,
}: {
  open: boolean;
  onClose: () => void;
  classroom: Classroom | undefined;
}) {
  const router = useRouter();
  const toast = useToast();
  const [date, setDate] = useState(todayISO());
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [maxMarks, setMaxMarks] = useState("100");
  const [instructions, setInstructions] = useState("");

  useEffect(() => {
    if (!open) return;
    setDate(todayISO());
    setSubjectId(classroom?.subjects[0]?.id ?? "");
    setTitle("");
    setMaxMarks("100");
    setInstructions("");
  }, [open, classroom]);

  const marks = useMemo(() => Number(maxMarks) || 100, [maxMarks]);

  function submit() {
    if (!classroom || !date) return;
    const test = createTest(classroom.id, {
      date,
      subjectId: subjectId || undefined,
      title: title || undefined,
      instructions: instructions || undefined,
      maxMarks: marks,
    });
    onClose();
    toast("Test created — upload answers when you're ready", "success");
    router.push(`/app/${classroom.slug}/tests/${test.id}`);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New test"
      description={classroom ? `In ${classroom.name}` : undefined}
      width={520}
      footer={
        <>
          <Button size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" onClick={submit} disabled={!date}>
            Create test
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Test date">
            <Input
              data-autofocus
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
          <Field label="Subject" optional>
            <Select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
              <option value="">No subject</option>
              {classroom?.subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </Select>
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
          <Field label="Total marks" optional>
            <Input
              type="number"
              min={1}
              value={maxMarks}
              onChange={(event) => setMaxMarks(event.target.value)}
            />
          </Field>
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
