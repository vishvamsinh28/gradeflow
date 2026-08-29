"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Select, cx } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/overlays";
import { IconFile, IconSparkle, IconTrash, Spinner } from "@/components/ui/icons";
import { Dropzone } from "./dropzone";
import { matchFilesToStudents, type FileMatch } from "@/lib/ai";
import { attendanceOf, useDatabase } from "@/lib/store";
import type { Classroom, Test } from "@/lib/types";

const VIA_LABEL: Record<FileMatch["via"], string> = {
  code: "Student ID",
  roll: "Roll number",
  name: "Name",
  order: "Read from sheet",
  none: "Unmatched",
};

export function BulkUploadDialog({
  open,
  onClose,
  classroom,
  test,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  classroom: Classroom;
  test: Test;
  onConfirm: (entries: { studentId: string; fileName: string; matchedByAI: boolean }[]) => void;
}) {
  const db = useDatabase();
  const [matches, setMatches] = useState<FileMatch[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setMatches(null);
      setBusy(false);
    }
  }, [open]);

  /** Absent students are never offered a submission slot. */
  const eligible = useMemo(
    () => classroom.students.filter((student) => attendanceOf(db, test.id, student.id) === "present"),
    [classroom.students, db, test.id],
  );

  async function handleFiles(files: File[]) {
    setBusy(true);
    // A short beat so the matching step reads as work being done, not a jump cut.
    await new Promise((resolve) => setTimeout(resolve, 620));
    setMatches(matchFilesToStudents(files.map((file) => file.name), eligible));
    setBusy(false);
  }

  const resolved = matches?.filter((match) => match.studentId) ?? [];
  const duplicated = useMemo(() => {
    const seen = new Set<string>();
    const dupes = new Set<string>();
    resolved.forEach((match) => {
      if (match.studentId && seen.has(match.studentId)) dupes.add(match.studentId);
      if (match.studentId) seen.add(match.studentId);
    });
    return dupes;
  }, [resolved]);

  function confirm() {
    if (!matches) return;
    onConfirm(
      matches
        .filter((match) => match.studentId)
        .map((match) => ({
          studentId: match.studentId as string,
          fileName: match.fileName,
          matchedByAI: match.via === "order",
        })),
    );
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Upload answer sheets"
      description={test.title ?? "Untitled test"}
      width={620}
      footer={
        matches ? (
          <>
            <span className="mr-auto text-[12.5px] text-ink-3">
              {resolved.length} of {matches.length} matched
              {duplicated.size > 0 ? ` · ${duplicated.size} duplicate` : ""}
            </span>
            <Button size="sm" onClick={() => setMatches(null)}>
              Back
            </Button>
            <Button size="sm" variant="primary" onClick={confirm} disabled={resolved.length === 0}>
              Upload &amp; grade {resolved.length}
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={onClose}>
            Cancel
          </Button>
        )
      }
    >
      {matches ? (
        <div>
          <div className="mb-3 flex items-start gap-2 rounded-md border border-accent-line bg-accent-soft px-3 py-2 text-[12.5px] leading-snug text-accent">
            <IconSparkle size={13} className="mt-[2px] shrink-0" />
            <span>
              Each sheet was matched to a student. Fix anything that looks wrong — grading starts as
              soon as you confirm.
            </span>
          </div>

          <div className="max-h-[46vh] overflow-y-auto rounded-lg border border-line">
            <table className="w-full border-separate border-spacing-0 text-[13px]">
              <tbody>
                {matches.map((match, index) => {
                  const duplicate = match.studentId ? duplicated.has(match.studentId) : false;
                  return (
                    <tr key={`${match.fileName}-${index}`} className="group/row">
                      <td className="w-[46%] border-b border-line px-3 py-1.5">
                        <span className="flex items-center gap-2">
                          <IconFile size={13} className="shrink-0 text-ink-4" />
                          <span className="truncate font-mono text-[12px] text-ink-2">
                            {match.fileName}
                          </span>
                        </span>
                      </td>
                      <td className="border-b border-line py-1.5 pr-2">
                        <Select
                          value={match.studentId ?? ""}
                          onChange={(event) => {
                            const next = [...matches];
                            next[index] = {
                              ...match,
                              studentId: event.target.value || null,
                              via: event.target.value ? "name" : "none",
                            };
                            setMatches(next);
                          }}
                          className={cx(
                            "h-7 text-[12.5px]",
                            duplicate && "border-warn-line bg-warn-soft",
                          )}
                        >
                          <option value="">Skip this file</option>
                          {eligible.map((student) => (
                            <option key={student.id} value={student.id}>
                              {student.name} · {student.code}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="w-[120px] border-b border-line py-1.5 pr-2 text-right">
                        {match.studentId ? (
                          <Badge tone={match.via === "order" ? "accent" : "neutral"}>
                            {VIA_LABEL[match.via]}
                          </Badge>
                        ) : (
                          <Badge tone="muted">Skipped</Badge>
                        )}
                      </td>
                      <td className="w-9 border-b border-line pr-2">
                        <button
                          aria-label={`Remove ${match.fileName}`}
                          onClick={() => setMatches(matches.filter((_, i) => i !== index))}
                          className="flex h-6 w-6 items-center justify-center rounded text-ink-4 opacity-0 transition-all hover:bg-danger-soft hover:text-danger focus-visible:opacity-100 group-hover/row:opacity-100"
                        >
                          <IconTrash size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div>
          <Dropzone
            multiple
            accept="image/*,application/pdf"
            disabled={busy}
            onFiles={handleFiles}
            title={busy ? "Matching sheets to students…" : "Drop every answer sheet at once"}
            hint="Photos, scans or PDFs. GradeFlow works out whose sheet is whose, then grades the batch."
            icon={busy ? <Spinner size={16} /> : undefined}
          />
          <p className="mt-3 text-[12.5px] leading-relaxed text-ink-3">
            {eligible.length} students are marked present for this test.
            {classroom.students.length - eligible.length > 0
              ? ` ${classroom.students.length - eligible.length} absent students are skipped.`
              : ""}
          </p>
        </div>
      )}
    </Dialog>
  );
}
