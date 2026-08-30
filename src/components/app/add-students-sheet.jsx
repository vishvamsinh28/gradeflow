"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, EmptyState, Segmented, Textarea, cx } from "@/components/ui/primitives";
import { Sheet, useToast } from "@/components/ui/overlays";
import { IconFile, IconSparkle, IconTrash, IconUsers, Spinner } from "@/components/ui/icons";
import { Dropzone } from "./dropzone";
import { parseRoster } from "@/lib/parse";
import { extractStudents } from "@/lib/api";
import { addStudents } from "@/lib/workspace";
import { pluralize } from "@/lib/format";
const PLACEHOLDER = `Rahul Sharma
Priya Patel
Aarav Shah
Riya Shah`;
export function AddStudentsSheet({ open, onClose, classroom }) {
  const toast = useToast();
  const [mode, setMode] = useState("paste");
  const [raw, setRaw] = useState("");
  const [review, setReview] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setMode("paste");
    setRaw("");
    setReview(null);
    setNote("");
    setBusy(false);
  }, [open]);
  const pastePreview = useMemo(() => parseRoster(raw), [raw]);
  const existing = useMemo(
    () => new Set((classroom?.students ?? []).map((student) => student.name.toLowerCase())),
    [classroom],
  );

  /** Mirrors the store: IDs continue from the highest one already issued. */
  const firstCode = useMemo(() => {
    const highest = (classroom?.students ?? []).reduce((max, student) => {
      const match = student.code.match(/(\d+)$/);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    return highest + 1;
  }, [classroom]);
  const duplicates =
    review?.filter((student) => existing.has(student.name.toLowerCase())).length ?? 0;
  const importable = (review?.length ?? 0) - duplicates;
  async function readFiles(files) {
    const file = files[0];
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      const students = parseRoster(text);
      if (students.length === 0) {
        toast("No names found in that file — try a CSV, or paste the list", "error");
        return;
      }
      setReview(students);
      setNote(`Read ${pluralize(students.length, "student")} from ${file.name}.`);
    } catch {
      toast("Could not read that file", "error");
    } finally {
      setBusy(false);
    }
  }
  async function readRegister(files) {
    const file = files[0];
    if (!file || !classroom) return;
    setBusy(true);
    try {
      const { students } = await extractStudents(classroom.id, file);
      if (students.length === 0) {
        toast("No students found on that page — try a clearer photo", "error");
        return;
      }
      setReview(
        students.map((student) => ({
          name: student.name,
          rollNo: student.roll_no ?? undefined,
        })),
      );
      setNote(`Read ${pluralize(students.length, "student")} off ${file.name}.`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not read that register", "error");
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    if (!classroom || !review) return;
    setBusy(true);
    try {
      const added = await addStudents(
        classroom,
        review.map((student) => ({
          name: student.name,
          roll_no: student.rollNo,
        })),
      );
      onClose();
      toast(
        added === 0
          ? "Everyone on that list is already in this classroom"
          : `Added ${added} ${added === 1 ? "student" : "students"}`,
        added === 0 ? "info" : "success",
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not add those students", "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add students"
      description={classroom?.name}
      footer={
        review ? (
          <>
            <span className="mr-auto text-[12.5px] text-ink-3">
              {importable} to add
              {duplicates > 0 ? ` · ${duplicates} already in this classroom` : ""}
            </span>
            <Button size="sm" onClick={() => setReview(null)}>
              Back
            </Button>
            <Button
              size="sm"
              variant="primary"
              loading={busy}
              onClick={() => void commit()}
              disabled={importable === 0}
            >
              Add {importable} {importable === 1 ? "student" : "students"}
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={mode !== "paste" || pastePreview.length === 0}
              onClick={() => {
                setReview(pastePreview);
                setNote(`${pluralize(pastePreview.length, "name")} read from your list.`);
              }}
            >
              Review {pastePreview.length > 0 ? pastePreview.length : ""}
            </Button>
          </>
        )
      }
    >
      {review ? (
        <ReviewTable
          students={review}
          note={note}
          existing={existing}
          onChange={setReview}
          firstCode={firstCode}
        />
      ) : (
        <div className="px-5 py-4">
          <Segmented
            value={mode}
            onChange={setMode}
            className="mb-4"
            options={[
              {
                value: "paste",
                label: "Type or paste",
                icon: <IconUsers size={13} />,
              },
              {
                value: "file",
                label: "CSV file",
                icon: <IconFile size={13} />,
              },
              {
                value: "ai",
                label: "Read a register",
                icon: <IconSparkle size={13} />,
              },
            ]}
          />

          {mode === "paste" ? (
            <div>
              <Textarea
                data-autofocus
                rows={14}
                value={raw}
                onChange={(event) => setRaw(event.target.value)}
                placeholder={PLACEHOLDER}
                className="font-mono text-[13px]"
              />
              <p className="mt-2 text-[12.5px] text-ink-3">
                One student per line. Roll numbers and commas are handled automatically —{" "}
                <span className="text-ink-2">{pluralize(pastePreview.length, "name")}</span>{" "}
                detected so far.
              </p>
            </div>
          ) : null}

          {mode === "file" ? (
            <Dropzone
              accept=".csv,.tsv,.txt"
              onFiles={readFiles}
              disabled={busy}
              title={busy ? "Reading…" : "Drop a CSV file"}
              hint="CSV or TSV exported from your school system. Headers are detected automatically."
              icon={busy ? <Spinner size={16} /> : <IconFile size={16} />}
            />
          ) : null}

          {mode === "ai" ? (
            <div>
              <Dropzone
                accept="image/*,.pdf"
                onFiles={readRegister}
                disabled={busy}
                title={busy ? "Reading the register…" : "Photograph your class register"}
                hint="A photo, scan, or PDF of the attendance register. Names and roll numbers are read off the page."
                icon={busy ? <Spinner size={16} /> : <IconSparkle size={16} />}
              />
              <p className="mt-2 text-[12.5px] text-ink-3">
                You review every name before anything is added.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </Sheet>
  );
}
function ReviewTable({ students, note, existing, onChange, firstCode }) {
  if (students.length === 0) {
    return (
      <EmptyState
        icon={<IconUsers size={17} />}
        title="No names found"
        description="Go back and try a different file, or paste the names directly."
      />
    );
  }
  let assigned = firstCode;
  return (
    <div>
      <div className="flex items-center gap-2 border-b border-line bg-accent-soft/50 px-5 py-2.5 text-[12.5px] text-accent">
        <IconSparkle size={13} className="shrink-0" />
        {note} Edit anything that looks wrong before importing.
      </div>
      <table className="w-full border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr className="text-left">
            <th className="sticky top-0 z-10 w-[92px] border-b border-line bg-surface px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
              ID
            </th>
            <th className="sticky top-0 z-10 border-b border-line bg-surface py-2 pr-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
              Name
            </th>
            <th className="sticky top-0 z-10 w-[96px] border-b border-line bg-surface py-2 pr-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
              Roll
            </th>
            <th className="sticky top-0 z-10 w-11 border-b border-line bg-surface px-2" />
          </tr>
        </thead>
        <tbody>
          {students.map((student, index) => {
            const duplicate = existing.has(student.name.toLowerCase());
            const code = duplicate ? "—" : `STU-${String(assigned).padStart(3, "0")}`;
            if (!duplicate) assigned += 1;
            return (
              <tr key={index} className="group/row">
                <td
                  className={cx(
                    "border-b border-line px-5 py-1 font-mono text-[12px]",
                    duplicate ? "text-ink-4" : "text-ink-3",
                  )}
                >
                  {code}
                </td>
                <td className="border-b border-line py-1 pr-3">
                  <input
                    value={student.name}
                    onChange={(event) => {
                      const next = [...students];
                      next[index] = {
                        ...student,
                        name: event.target.value,
                      };
                      onChange(next);
                    }}
                    className={cx(
                      "w-full rounded-[5px] border border-transparent bg-transparent px-1.5 py-1 text-[13px] outline-none transition-colors focus:border-accent focus:bg-surface",
                      duplicate ? "text-ink-4 line-through" : "text-ink",
                    )}
                  />
                </td>
                <td className="border-b border-line py-1 pr-3">
                  <input
                    value={student.rollNo ?? ""}
                    placeholder="—"
                    onChange={(event) => {
                      const next = [...students];
                      next[index] = {
                        ...student,
                        rollNo: event.target.value,
                      };
                      onChange(next);
                    }}
                    className="w-full rounded-[5px] border border-transparent bg-transparent px-1.5 py-1 font-mono text-[12px] text-ink-2 outline-none transition-colors placeholder:text-ink-4 focus:border-accent focus:bg-surface"
                  />
                </td>
                <td className="border-b border-line px-2">
                  <button
                    aria-label={`Remove ${student.name}`}
                    onClick={() => onChange(students.filter((_, i) => i !== index))}
                    className="flex h-6 w-6 items-center justify-center rounded-[5px] text-ink-4 opacity-0 transition-all hover:bg-danger-soft hover:text-danger focus-visible:opacity-100 group-hover/row:opacity-100"
                  >
                    <IconTrash size={13} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="px-5 py-3">
        <button
          onClick={() =>
            onChange([
              ...students,
              {
                name: "",
              },
            ])
          }
          className="text-[12.5px] font-medium text-ink-3 transition-colors hover:text-accent"
        >
          + Add another row
        </button>
      </div>
    </div>
  );
}
