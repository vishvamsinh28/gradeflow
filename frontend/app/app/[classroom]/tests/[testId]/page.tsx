"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Menu,
  MenuItem,
  MenuSeparator,
  Progress,
  Select,
  Textarea,
  cx,
} from "@/components/ui/primitives";
import { Dialog, useConfirm, useToast } from "@/components/ui/overlays";
import {
  IconAlert,
  IconArrowRight,
  IconCheck,
  IconChevronLeft,
  IconEdit,
  IconFile,
  IconMinusCircle,
  IconMore,
  IconRefresh,
  IconSparkle,
  IconTrash,
  IconUpload,
  IconX,
  Spinner,
} from "@/components/ui/icons";
import { Dropzone } from "@/components/app/dropzone";
import { RegradeDialog } from "@/components/app/regrade-dialog";
import { ResultSheet } from "@/components/app/result-sheet";
import { TestStatusBadge } from "@/components/app/test-bits";
import {
  gradeTest,
  removeSubmission,
  removeTest,
  setAttendance,
  testProgress,
  updateTest,
  uploadSheets,
  useClassroom,
  useTestWorkspace,
} from "@/lib/workspace";
import { formatDate, formatMark, formatPercent, markTone, pluralize } from "@/lib/format";
import type { Student, Submission, UploadOutcome } from "@/lib/types";

type RowFilter = "all" | "awaiting" | "ready" | "graded" | "review" | "absent";

const TONE_TEXT = {
  strong: "text-accent",
  fine: "text-ink",
  watch: "text-warn",
  low: "text-danger",
  none: "text-ink-4",
} as const;

export default function TestWorkspacePage() {
  const params = useParams<{ classroom: string; testId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();

  const { data: workspace, loading, reload } = useTestWorkspace(params.testId);
  const { data: classroom } = useClassroom(params.classroom);

  const [filter, setFilter] = useState<RowFilter>(
    (searchParams.get("filter") as RowFilter) ?? "all",
  );
  const [editOpen, setEditOpen] = useState(false);
  const [regradeOpen, setRegradeOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [outcome, setOutcome] = useState<UploadOutcome | null>(null);
  const [openResultId, setOpenResultId] = useState<string | null>(null);

  const test = workspace?.test;
  const students = useMemo(() => workspace?.students ?? [], [workspace]);
  const submissions = useMemo(() => workspace?.submissions ?? [], [workspace]);
  const attendance = useMemo(() => workspace?.attendance ?? [], [workspace]);

  const rows = useMemo(
    () =>
      students.map((student) => ({
        student,
        submission: submissions.find((item) => item.student_id === student.id),
        absent:
          attendance.find((row) => row.student_id === student.id)?.mark === "absent",
      })),
    [students, submissions, attendance],
  );

  const visible = useMemo(
    () =>
      rows.filter((row) => {
        switch (filter) {
          case "absent":
            return row.absent;
          case "awaiting":
            return !row.absent && !row.submission;
          case "ready":
            return !row.absent && row.submission?.status === "awaiting";
          case "graded":
            return row.submission?.status === "graded";
          case "review":
            return row.submission?.status === "graded" && row.submission.needs_review;
          default:
            return true;
        }
      }),
    [rows, filter],
  );

  const stepList = useMemo(
    () =>
      visible
        .map((row) => row.submission)
        .filter((item): item is Submission => item?.status === "graded"),
    [visible],
  );
  const liveResult = openResultId
    ? (submissions.find((item) => item.id === openResultId) ?? null)
    : null;
  const stepIndex = liveResult ? stepList.findIndex((item) => item.id === liveResult.id) : -1;

  const stepResult = useCallback(
    (direction: -1 | 1) => {
      if (stepIndex < 0 || stepList.length === 0) return;
      const next = (stepIndex + direction + stepList.length) % stepList.length;
      setOpenResultId(stepList[next].id);
    },
    [stepIndex, stepList],
  );

  if (loading && !workspace) {
    return (
      <div>
        <div className="skeleton h-7 w-64 rounded-md" />
        <div className="skeleton mt-6 h-96 rounded-xl" />
      </div>
    );
  }

  if (!workspace || !test || !classroom) {
    return (
      <EmptyState
        title="Test not found"
        description="It may have been deleted."
        action={
          <Button variant="primary" onClick={() => router.push(`/app/${params.classroom}/tests`)}>
            Back to tests
          </Button>
        }
      />
    );
  }

  const progress = testProgress(test, students, submissions, attendance);
  const subject = classroom.subjects.find((item) => item.id === test.subject_id);
  const ungraded = rows.filter(
    (row) => row.submission?.status === "awaiting" || row.submission?.status === "failed",
  ).length;
  const gradedCount = rows.filter((row) => row.submission?.status === "graded").length;
  const busy =
    test.status === "grading" ||
    submissions.some((item) => item.status === "queued" || item.status === "grading");

  const counts: Record<RowFilter, number> = {
    all: rows.length,
    awaiting: rows.filter((row) => !row.absent && !row.submission).length,
    ready: rows.filter((row) => !row.absent && row.submission?.status === "awaiting").length,
    graded: gradedCount,
    review: rows.filter((row) => row.submission?.needs_review).length,
    absent: rows.filter((row) => row.absent).length,
  };

  async function upload(files: File[]) {
    if (!test) return;
    setUploading(true);
    setOutcome(null);
    try {
      const result = await uploadSheets(test.id, files);
      setOutcome(result);
      const count = result.submissions.length;
      toast(
        count > 0
          ? `${pluralize(count, "sheet")} uploaded — grading now`
          : "No sheets could be matched to a student",
        count > 0 ? "success" : "error",
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not upload those sheets", "error");
    } finally {
      setUploading(false);
    }
  }

  async function remove() {
    if (!test || !classroom) return;
    const ok = await confirm({
      title: "Delete this test?",
      body: "Every answer sheet, mark and attendance record for it is removed from the server.",
      confirmLabel: "Delete test",
      danger: true,
    });
    if (!ok) return;
    try {
      await removeTest(test.id, classroom.slug);
      router.push(`/app/${classroom.slug}/tests`);
      toast("Test deleted", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not delete that test", "error");
    }
  }

  return (
    <div>
      <Link
        href={`/app/${classroom.slug}/tests`}
        className="inline-flex items-center gap-1 text-[12.5px] font-medium text-ink-3 transition-colors hover:text-ink"
      >
        <IconChevronLeft size={13} />
        All tests
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-[-0.028em] text-ink">
            {test.title ?? "Untitled test"}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-3">
            <span>{subject?.name ?? "No subject"}</span>
            <span className="text-ink-4">·</span>
            <span>{formatDate(test.test_date)}</span>
            <span className="text-ink-4">·</span>
            <span className="tnum">{test.max_marks} marks</span>
            <TestStatusBadge test={test} progress={progress} />
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {gradedCount > 0 ? (
            <Button size="sm" icon={<IconRefresh size={14} />} onClick={() => setRegradeOpen(true)}>
              Re-mark
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="primary"
            loading={busy}
            disabled={ungraded === 0 || busy}
            icon={busy ? undefined : <IconSparkle size={14} />}
            onClick={() => void gradeTest(test.id).then(reload)}
          >
            {busy ? "Grading…" : ungraded > 0 ? `Grade ${ungraded}` : "Nothing to grade"}
          </Button>
          <Menu
            trigger={({ open, toggle }) => (
              <button
                onClick={toggle}
                aria-expanded={open}
                aria-label="Test options"
                className={cx(
                  "flex h-7 w-7 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink",
                  open && "bg-surface-2 text-ink",
                )}
              >
                <IconMore size={15} />
              </button>
            )}
          >
            {(close) => (
              <>
                <MenuItem
                  icon={<IconEdit size={14} />}
                  onClick={() => {
                    close();
                    setEditOpen(true);
                  }}
                >
                  Edit test
                </MenuItem>
                <MenuItem
                  icon={<IconCheck size={14} />}
                  onClick={() => {
                    close();
                    void setAttendance(
                      test.id,
                      students.map((student) => ({ student_id: student.id, mark: "present" as const })),
                    ).then(() => toast("Everyone marked present", "success"));
                  }}
                >
                  Mark all present
                </MenuItem>
                <MenuSeparator />
                <MenuItem danger icon={<IconTrash size={14} />} onClick={() => { close(); void remove(); }}>
                  Delete test
                </MenuItem>
              </>
            )}
          </Menu>
        </div>
      </div>

      {test.instructions ? (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-line bg-surface px-3.5 py-2.5">
          <IconSparkle size={14} className="mt-[2px] shrink-0 text-accent" />
          <p className="flex-1 whitespace-pre-line text-[13px] leading-relaxed text-ink-2">
            {test.instructions}
          </p>
          <button
            onClick={() => setEditOpen(true)}
            className="shrink-0 text-[12.5px] font-medium text-ink-3 transition-colors hover:text-accent"
          >
            Edit
          </button>
        </div>
      ) : null}

      {counts.awaiting > 0 || submissions.length === 0 ? (
        <div className="mt-4">
          <Dropzone
            multiple
            accept="image/*,application/pdf"
            disabled={uploading}
            onFiles={upload}
            title={uploading ? "Uploading and reading the sheets…" : "Drop the answer sheets"}
            hint="One file per student, or a single PDF holding the whole class — it is split by reading the name on each page."
            icon={uploading ? <Spinner size={16} /> : undefined}
          />
        </div>
      ) : null}

      {outcome && outcome.unmatched.length > 0 ? (
        <div className="mt-3 rounded-lg border border-warn-line bg-warn-soft px-3.5 py-2.5">
          <p className="text-[13px] font-medium text-warn">
            {pluralize(outcome.unmatched.length, "sheet")} could not be matched to a student
          </p>
          <p className="mt-1 text-[12.5px] leading-snug text-warn/90">
            {outcome.unmatched.join(", ")} — upload these against a student directly, using the
            Upload button on their row. Nothing was guessed at.
          </p>
        </div>
      ) : null}

      {busy || (progress.submitted > 0 && progress.graded < progress.submitted) ? (
        <div className="mt-4 rounded-lg border border-accent-line bg-accent-soft/60 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-[13px] font-medium text-accent">
              {busy ? <Spinner size={13} /> : <IconSparkle size={13} />}
              {busy
                ? `Grading ${progress.submitted} submissions…`
                : `${progress.submitted - progress.graded} waiting to be graded`}
            </p>
            <span className="font-mono text-[12.5px] text-accent tnum">
              {progress.graded}/{progress.submitted}
            </span>
          </div>
          <Progress
            className="mt-2 bg-translucent"
            value={progress.submitted > 0 ? (progress.graded / progress.submitted) * 100 : 0}
          />
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-1.5">
        {(
          [
            ["all", "All"],
            ["awaiting", "Needs answer"],
            ["ready", "Ready to grade"],
            ["graded", "Graded"],
            ["review", "Review"],
            ["absent", "Absent"],
          ] as [RowFilter, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            disabled={counts[key] === 0 && key !== "all"}
            className={cx(
              "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] font-medium transition-colors disabled:opacity-40",
              filter === key
                ? "border-ink bg-ink text-paper"
                : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink",
            )}
          >
            {label}
            <span className={cx("font-mono tnum", filter === key ? "text-paper/60" : "text-ink-4")}>
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-2.5 overflow-hidden rounded-xl border border-line bg-surface">
        {students.length === 0 ? (
          <EmptyState
            title="No students in this classroom"
            description="Add students before collecting answers."
            action={
              <Button variant="primary" onClick={() => router.push(`/app/${classroom.slug}/students`)}>
                Add students
              </Button>
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState title="Nothing here" description="No students match this filter." />
        ) : (
          <ul className="divide-y divide-line">
            {visible.map(({ student, submission, absent }) => (
              <RosterRow
                key={student.id}
                student={student}
                submission={submission}
                absent={absent}
                testId={test.id}
                maxMarks={test.max_marks}
                onOpen={() => submission?.status === "graded" && setOpenResultId(submission.id)}
                onUpload={(files) => void upload(files)}
              />
            ))}
          </ul>
        )}
      </div>

      <p className="mt-3 text-[12.5px] text-ink-3">
        {progress.absent > 0
          ? `${pluralize(progress.absent, "student")} marked absent — no answer sheet is expected from them. `
          : ""}
        {progress.averagePercent !== null
          ? `Class average so far ${formatPercent(progress.averagePercent, 1)}.`
          : "Marks appear here as grading finishes."}
      </p>

      <RegradeDialog
        open={regradeOpen}
        onClose={() => setRegradeOpen(false)}
        testId={test.id}
        gradedCount={gradedCount}
        flaggedCount={counts.review}
      />

      <EditTestDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        slug={classroom.slug}
        test={test}
        subjects={classroom.subjects}
      />

      <ResultSheet
        submission={liveResult}
        student={students.find((item) => item.id === liveResult?.student_id)}
        test={test}
        onClose={() => setOpenResultId(null)}
        onStep={stepResult}
        position={stepIndex >= 0 ? { index: stepIndex, total: stepList.length } : undefined}
      />
    </div>
  );
}

/* ---------- roster row ---------- */

function RosterRow({
  student,
  submission,
  absent,
  testId,
  maxMarks,
  onOpen,
  onUpload,
}: {
  student: Student;
  submission: Submission | undefined;
  absent: boolean;
  testId: string;
  maxMarks: number;
  onOpen: () => void;
  onUpload: (files: File[]) => void;
}) {
  const graded = submission?.status === "graded";
  const percent =
    graded && submission.out_of ? ((submission.score ?? 0) / submission.out_of) * 100 : null;

  const controls = (
    <>
      <AttendanceToggle testId={testId} studentId={student.id} absent={absent} locked={graded} />
      <AnswerCell student={student} submission={submission} absent={absent} testId={testId} onUpload={onUpload} />
    </>
  );

  return (
    <li
      className={cx(
        "group/row px-3 py-2.5 transition-colors sm:px-4 sm:py-2",
        graded && "cursor-pointer hover:bg-surface-2",
        absent && "bg-surface-2/40",
      )}
      onClick={graded ? onOpen : undefined}
    >
      <div className="flex items-center gap-3">
        <Avatar name={student.name} size={26} />
        <div className="min-w-0 flex-[1.4]">
          <p className={cx("truncate text-[13.5px] font-medium", absent ? "text-ink-3" : "text-ink")}>
            {student.name}
          </p>
          <p className="font-mono text-[11.5px] text-ink-4">{student.code}</p>
        </div>

        <div
          className="hidden shrink-0 items-center gap-3 sm:flex sm:flex-1"
          onClick={(event) => event.stopPropagation()}
        >
          {controls}
        </div>

        <div className="flex w-[104px] shrink-0 items-center justify-end gap-2">
          <ResultCell submission={submission} absent={absent} graded={graded} percent={percent} maxMarks={maxMarks} />
        </div>

        <IconArrowRight
          size={14}
          className={cx(
            "shrink-0 transition-all",
            graded ? "text-ink-4 group-hover/row:translate-x-0.5 group-hover/row:text-ink-2" : "opacity-0",
          )}
        />
      </div>

      <div
        className="mt-2 flex items-center gap-2 pl-[38px] sm:hidden"
        onClick={(event) => event.stopPropagation()}
      >
        {controls}
      </div>
    </li>
  );
}

function ResultCell({
  submission,
  absent,
  graded,
  percent,
  maxMarks,
}: {
  submission: Submission | undefined;
  absent: boolean;
  graded: boolean;
  percent: number | null;
  maxMarks: number;
}) {
  if (absent) return <Badge tone="danger">Absent</Badge>;
  if (submission?.status === "grading") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-accent">
        <Spinner size={12} />
        Grading
      </span>
    );
  }
  if (submission?.status === "queued") return <span className="text-[12.5px] text-ink-4">Queued</span>;
  if (submission?.status === "failed") return <Badge tone="danger">Failed</Badge>;
  if (graded && submission) {
    return (
      <>
        {submission.needs_review ? (
          <span title="Wants a second look" className="text-warn">
            <IconAlert size={13} />
          </span>
        ) : null}
        <span className={cx("font-mono text-[13.5px] font-medium tnum", TONE_TEXT[markTone(percent)])}>
          {formatMark(submission.score ?? 0)}
          <span className="text-ink-4">/{submission.out_of ?? maxMarks}</span>
        </span>
      </>
    );
  }
  if (submission) return <span className="text-[12.5px] text-ink-3">Ready</span>;
  return <span className="text-[12.5px] text-ink-4">&mdash;</span>;
}

function AnswerCell({
  student,
  submission,
  absent,
  testId,
  onUpload,
}: {
  student: Student;
  submission: Submission | undefined;
  absent: boolean;
  testId: string;
  onUpload: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  if (absent) return <span className="text-[12.5px] text-ink-4">No sheet expected</span>;

  if (submission) {
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        <IconFile size={13} className="shrink-0 text-ink-4" />
        <span className="truncate font-mono text-[11.5px] text-ink-3">
          {submission.file_name ?? "answer"}
        </span>
        {submission.matched_by_ai ? (
          <span title="Matched to this student by reading the sheet" className="shrink-0 text-accent">
            <IconSparkle size={11} />
          </span>
        ) : null}
        {submission.status === "awaiting" ? (
          <button
            aria-label="Remove this answer sheet"
            onClick={() =>
              void removeSubmission(testId, submission.id).catch(() =>
                toast("Could not remove that sheet", "error"),
              )
            }
            className="shrink-0 text-ink-4 transition-opacity hover:text-danger sm:opacity-0 sm:focus-visible:opacity-100 sm:group-hover/row:opacity-100"
          >
            <IconX size={12} />
          </button>
        ) : null}
      </span>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        aria-label={`Upload an answer sheet for ${student.name}`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onUpload([file]);
          event.target.value = "";
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="inline-flex h-6 items-center gap-1.5 rounded-md border border-dashed border-line-strong px-2 text-[12px] font-medium text-ink-3 transition-colors hover:border-accent-line hover:bg-accent-soft hover:text-accent"
      >
        <IconUpload size={11} />
        Upload
      </button>
    </>
  );
}

function AttendanceToggle({
  testId,
  studentId,
  absent,
  locked,
}: {
  testId: string;
  studentId: string;
  absent: boolean;
  locked: boolean;
}) {
  const toast = useToast();
  const set = (mark: "present" | "absent") =>
    void setAttendance(testId, [{ student_id: studentId, mark }]).catch(() =>
      toast("Could not save attendance", "error"),
    );

  return (
    <div className="inline-flex overflow-hidden rounded-md border border-line" role="group">
      <button
        aria-label="Mark present"
        aria-pressed={!absent}
        onClick={() => set("present")}
        className={cx(
          "flex h-6 w-7 items-center justify-center transition-colors",
          !absent ? "bg-accent text-accent-on" : "bg-surface text-ink-4 hover:bg-surface-2 hover:text-ink-2",
        )}
      >
        <IconCheck size={12} />
      </button>
      <button
        aria-label="Mark absent"
        aria-pressed={absent}
        disabled={locked}
        title={locked ? "This answer is already graded" : undefined}
        onClick={() => set("absent")}
        className={cx(
          "flex h-6 w-7 items-center justify-center border-l border-line transition-colors disabled:cursor-not-allowed disabled:opacity-40",
          absent ? "bg-danger text-danger-on" : "bg-surface text-ink-4 hover:bg-surface-2 hover:text-ink-2",
        )}
      >
        <IconMinusCircle size={12} />
      </button>
    </div>
  );
}

/* ---------- edit ---------- */

function EditTestDialog({
  open,
  onClose,
  slug,
  test,
  subjects,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  test: { id: string; title: string | null; test_date: string; subject_id: string | null; max_marks: number; instructions: string | null };
  subjects: { id: string; name: string }[];
}) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [maxMarks, setMaxMarks] = useState("100");
  const [instructions, setInstructions] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(test.title ?? "");
    setDate(test.test_date);
    setSubjectId(test.subject_id ?? "");
    setMaxMarks(String(test.max_marks));
    setInstructions(test.instructions ?? "");
  }, [open, test]);

  async function save() {
    setSaving(true);
    try {
      await updateTest(test.id, slug, {
        title: title.trim() || undefined,
        test_date: date,
        subject_id: subjectId || null,
        max_marks: Number(maxMarks) || 100,
        instructions: instructions.trim() || undefined,
      });
      onClose();
      toast("Test updated", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save those changes", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Edit test"
      width={520}
      footer={
        <>
          <Button size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" loading={saving} onClick={() => void save()}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Test date">
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field label="Subject" optional>
            <Select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
              <option value="">No subject</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
          <Field label="Title" optional>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} />
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
        <Field label="Grading notes for AI" optional>
          <Textarea
            rows={3}
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="Give partial marks when the method is right but the arithmetic slips."
          />
        </Field>
      </div>
    </Dialog>
  );
}
