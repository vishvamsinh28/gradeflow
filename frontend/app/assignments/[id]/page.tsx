"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";
import { Header } from "@/components/Header";
import { useToast } from "@/components/ToastProvider";
import { api } from "@/lib/api";
import { Assignment, AssignmentVersion, AuditLog, Submission } from "@/lib/types";

type Analytics = {
  submission_count: number;
  scored_count: number;
  review_required_count: number;
  average_percentage: number;
  common_errors: { category: string; count: number }[];
};

type QuestionDraft = {
  number: string;
  prompt: string;
  expectedAnswer: string;
  maxScore: string;
  criteria: string;
  commonMistakes: string;
};

type AssignmentHistory = {
  versions: AssignmentVersion[];
  audit_logs: AuditLog[];
};

const panelClass = "rounded-2xl border border-[#8496b01f] bg-[#132338] p-5 shadow-[0_18px_48px_rgba(0,0,0,.12)] sm:p-6";
const inputClass = "app-input w-full rounded-xl border border-[#8496b02e] bg-[#0B1829] px-4 py-3 text-sm text-[#F8FAFC]";
const textareaClass = "app-textarea min-h-[96px] w-full resize-y rounded-xl border border-[#8496b02e] bg-[#0B1829] px-4 py-3 text-sm leading-6 text-[#E2EAF4]";

function questionsFromAssignment(assignment: Assignment): QuestionDraft[] {
  const answerQuestions = (assignment.answer_key?.questions as Record<string, unknown>[] | undefined) ?? [];
  const rubricQuestions = (assignment.rubric?.questions as Record<string, Record<string, unknown>> | undefined) ?? {};
  if (!answerQuestions.length) {
    return [{ number: "1", prompt: "", expectedAnswer: "", maxScore: String(assignment.total_points || 1), criteria: "", commonMistakes: "" }];
  }
  return answerQuestions.map((question, index) => {
    const number = String(question.number ?? index + 1);
    const rubric = rubricQuestions[number] ?? {};
    const criteria = Array.isArray(rubric.criteria)
      ? rubric.criteria.map((item) => typeof item === "object" && item && "description" in item ? String(item.description) : String(item)).join("\n")
      : "";
    const mistakes = Array.isArray(rubric.common_mistakes) ? rubric.common_mistakes.map(String).join("\n") : "";
    return {
      number,
      prompt: String(question.prompt ?? ""),
      expectedAnswer: String(question.expected_answer ?? ""),
      maxScore: String(question.max_score ?? 0),
      criteria,
      commonMistakes: mistakes,
    };
  });
}

function buildAssignmentPayload(questions: QuestionDraft[], generalRules: string) {
  const cleanedQuestions = questions.map((question, index) => ({
    ...question,
    number: question.number.trim() || String(index + 1),
    maxScore: question.maxScore || "0",
  }));
  return {
    totalPoints: cleanedQuestions.reduce((sum, question) => sum + Number(question.maxScore || 0), 0),
    answerKey: {
      questions: cleanedQuestions.map((question) => ({
        number: question.number,
        prompt: question.prompt,
        expected_answer: question.expectedAnswer,
        max_score: Number(question.maxScore || 0),
        acceptable_alternates: [],
      })),
    },
    rubric: {
      general_rules: generalRules.split("\n").map((rule) => rule.trim()).filter(Boolean),
      questions: Object.fromEntries(
        cleanedQuestions.map((question) => [
          question.number,
          {
            criteria: question.criteria.split("\n").map((line) => line.trim()).filter(Boolean).map((description) => ({ description })),
            common_mistakes: question.commonMistakes.split("\n").map((line) => line.trim()).filter(Boolean),
          },
        ])
      ),
    },
  };
}

export default function AssignmentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const confirm = useConfirm();
  const { notify } = useToast();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [history, setHistory] = useState<AssignmentHistory | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [newStudentName, setNewStudentName] = useState("");
  const [error, setError] = useState("");
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editRules, setEditRules] = useState("");
  const [editQuestions, setEditQuestions] = useState<QuestionDraft[]>([]);
  const [editChangeNote, setEditChangeNote] = useState("");
  const [regrading, setRegrading] = useState(false);

  async function load() {
    try {
      const [assignmentRow, submissionRows, stats, historyRows] = await Promise.all([
        api<Assignment>(`/assignments/${id}`),
        api<Submission[]>(`/assignments/${id}/submissions`),
        api<Analytics>(`/analytics/assignments/${id}`),
        api<AssignmentHistory>(`/assignments/${id}/history`),
      ]);
      setAssignment(assignmentRow);
      setEditTitle(assignmentRow.title);
      setEditDescription(assignmentRow.description ?? "");
      setEditRules(Array.isArray(assignmentRow.rubric?.general_rules) ? (assignmentRow.rubric.general_rules as string[]).join("\n") : "");
      setEditQuestions(questionsFromAssignment(assignmentRow));
      setSubmissions(submissionRows);
      setAnalytics(stats);
      setHistory(historyRows);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load assignment";
      setError(message);
      notify(message, "error");
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    if (files.length > 1) {
      setSelectedStudentId("");
      setNewStudentName("");
    }
  }, [files.length]);

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!files.length) return;
    setError("");
    try {
      for (const file of files) {
        const body = new FormData();
        body.append("file", file);
        if (files.length === 1 && selectedStudentId && selectedStudentId !== "__new__") {
          body.append("student_id", selectedStudentId);
        }
        if (files.length === 1 && selectedStudentId === "__new__" && newStudentName.trim()) {
          body.append("student_name", newStudentName.trim());
        }
        await api(`/assignments/${id}/submissions`, { method: "POST", body });
      }
      setFiles([]);
      setSelectedStudentId("");
      setNewStudentName("");
      notify("Submission uploaded", "success");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
      notify(message, "error");
    }
  }

  const totalErrors = analytics?.common_errors?.reduce((sum, item) => sum + item.count, 0) ?? 0;
  const filteredSubmissions = submissions.filter((submission) => statusFilter === "all" || submission.status === statusFilter);
  const reviewCount = submissions.filter((submission) => submission.review_required || submission.status === "review_required").length;
  const ungradedCount = submissions.filter((submission) => submission.status === "uploaded" || submission.status === "failed").length;

  async function grade(submissionId: string) {
    setError("");
    setGradingId(submissionId);
    try {
      await api(`/submissions/${submissionId}/grade`, { method: "POST" });
      notify("Grading queued", "success");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Grading failed";
      setError(message);
      notify(message, "error");
    } finally {
      setGradingId(null);
    }
  }

  async function deleteAssignment() {
    if (!assignment) return;
    const confirmed = await confirm({
      title: `Delete ${assignment.title}?`,
      message: "This removes the assignment, submissions, grading results, and uploaded files.",
      confirmLabel: "Delete assignment",
    });
    if (!confirmed) return;
    setError("");
    try {
      await api<void>(`/assignments/${id}`, { method: "DELETE" });
      notify("Assignment deleted", "success");
      router.push(`/classes/${assignment.class_id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not delete assignment";
      setError(message);
      notify(message, "error");
    }
  }

  async function deleteSubmission(submissionId: string, label: string) {
    const confirmed = await confirm({
      title: `Delete ${label}?`,
      message: "This removes the uploaded work and its question-level grading results.",
      confirmLabel: "Delete submission",
    });
    if (!confirmed) return;
    setError("");
    try {
      await api<void>(`/submissions/${submissionId}`, { method: "DELETE" });
      notify("Submission deleted", "success");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not delete submission";
      setError(message);
      notify(message, "error");
    }
  }

  async function updateStatus(status: string) {
    setError("");
    try {
      await api(`/assignments/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      notify("Assignment status updated", "success");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not update assignment status";
      setError(message);
      notify(message, "error");
    }
  }

  async function saveAssignment(event: FormEvent) {
    event.preventDefault();
    if (!assignment) return;
    setError("");
    setSavingAssignment(true);
    try {
      const built = buildAssignmentPayload(editQuestions, editRules);
      await api(`/assignments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editTitle,
          description: editDescription || null,
          total_points: built.totalPoints,
          answer_key: built.answerKey,
          rubric: built.rubric,
          change_note: editChangeNote || null,
        }),
      });
      setEditChangeNote("");
      notify("Assignment saved. Use regrade all to apply rubric changes to existing submissions.", "success");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not update assignment";
      setError(message);
      notify(message, "error");
    } finally {
      setSavingAssignment(false);
    }
  }

  async function duplicateAssignment() {
    setError("");
    try {
      const copy = await api<Assignment>(`/assignments/${id}/duplicate`, { method: "POST" });
      notify("Assignment duplicated", "success");
      router.push(`/assignments/${copy.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not duplicate assignment";
      setError(message);
      notify(message, "error");
    }
  }

  async function gradeAllUngraded() {
    setError("");
    setRegrading(true);
    try {
      const result = await api<{ queued: number }>(`/assignments/${id}/grade-ungraded`, { method: "POST" });
      notify(`Queued ${result.queued} submissions for grading`, result.queued ? "success" : "info");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not queue grading";
      setError(message);
      notify(message, "error");
    } finally {
      setRegrading(false);
    }
  }

  async function bulkApprove() {
    setError("");
    try {
      await api(`/assignments/${id}/bulk-approve`, { method: "POST" });
      notify("Completed submissions approved", "success");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not approve completed work";
      setError(message);
      notify(message, "error");
    }
  }

  async function returnResults() {
    setError("");
    try {
      await api(`/assignments/${id}/return-results`, { method: "POST" });
      notify("Results returned to student portals", "success");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not return results";
      setError(message);
      notify(message, "error");
    }
  }

  async function regradeAll() {
    const confirmed = await confirm({
      title: "Regrade all submissions?",
      message: "GradeFlow will queue every eligible submission using the current answer key and rubric. Existing scores may change when the new results finish.",
      confirmLabel: "Queue regrade",
      tone: "primary",
    });
    if (!confirmed) return;
    setError("");
    setRegrading(true);
    try {
      const result = await api<{ queued: number }>(`/assignments/${id}/regrade`, { method: "POST" });
      notify(`Queued ${result.queued} submissions for regrading`, result.queued ? "success" : "info");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not regrade submissions";
      setError(message);
      notify(message, "error");
    } finally {
      setRegrading(false);
    }
  }

  function updateEditQuestion(index: number, changes: Partial<QuestionDraft>) {
    setEditQuestions((current) => current.map((question, questionIndex) => questionIndex === index ? { ...question, ...changes } : question));
  }

  function addEditQuestion() {
    setEditQuestions((current) => [...current, { number: String(current.length + 1), prompt: "", expectedAnswer: "", maxScore: "5", criteria: "", commonMistakes: "" }]);
  }

  function removeEditQuestion(index: number) {
    setEditQuestions((current) => current.length === 1 ? current : current.filter((_, questionIndex) => questionIndex !== index));
  }

  function exportCsv() {
    const rows = [
      ["Student", "File", "Status", "Score", "Max score", "Confidence"],
      ...submissions.map((submission) => [
        submission.students?.name ?? "Unassigned",
        submission.original_filename,
        submission.status,
        submission.score ?? "",
        submission.max_score ?? "",
        submission.confidence != null ? Math.round(submission.confidence * 100) + "%" : "",
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${assignment?.title ?? "assignment"}-results.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="app-background min-h-screen">
      <Header />
      <main className="mx-auto w-[min(1180px,92vw)] pb-20 pt-10 sm:pt-12">
        <Link className="inline-flex items-center gap-2 text-sm text-[#8496B0] transition hover:text-[#00C9A7]" href={`/classes/${assignment?.class_id ?? ""}`}>← Back to class</Link>
        <div className="mt-5 flex flex-col justify-between gap-4 border-b border-[#8496b01f] pb-8 md:flex-row md:items-end">
          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-[#00C9A7]">Assignment workspace</div>
            <h1 className="font-display text-4xl font-bold tracking-[-1.5px] sm:text-5xl">{assignment?.title ?? "Assignment"}</h1>
            <p className="mt-3 text-[#8496B0]">{assignment?.total_points ?? 0} points · upload images or PDFs</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="w-fit rounded-full border border-[#00c9a733] bg-[#00c9a714] px-3 py-1.5 text-xs font-semibold capitalize text-[#00C9A7]">{assignment?.status || "active"}</span>
            {assignment && (
              <>
                <button className="app-btn app-btn-secondary" onClick={() => updateStatus("active")} type="button">Open grading</button>
                <button className="app-btn app-btn-ghost" onClick={returnResults} type="button">Return results</button>
                <button className="app-btn app-btn-ghost" onClick={duplicateAssignment} type="button">Duplicate</button>
                <button className="app-btn app-btn-ghost" onClick={() => updateStatus("archived")} type="button">Archive</button>
              </>
            )}
            {assignment && (
              <button
                className="app-btn app-btn-danger"
                onClick={deleteAssignment}
                type="button"
              >
                Delete assignment
              </button>
            )}
          </div>
        </div>

        {error && <div className="mt-6 rounded-xl border border-[#f8717159] bg-[#f8717112] px-4 py-3 text-sm text-[#FCA5A5]">{error}</div>}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard value={analytics?.submission_count ?? 0} label="Submissions" />
          <MetricCard value={analytics?.scored_count ?? 0} label="Scored" tone="teal" />
          <MetricCard value={`${analytics?.average_percentage ?? 0}%`} label="Class average" />
          <MetricCard value={reviewCount} label="Need review" tone="amber" />
        </section>

        <section className={`${panelClass} mt-6`}>
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#00C9A7]">Workflow queue</div>
              <h2 className="font-display text-2xl font-semibold">Next actions</h2>
              <p className="mt-1 text-sm leading-6 text-[#8496B0]">Grade new uploads, review uncertain work, then return results when you are ready.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="app-btn app-btn-secondary" disabled={!ungradedCount || Boolean(gradingId) || regrading} onClick={gradeAllUngraded} type="button">{regrading ? "Queueing..." : `Grade ${ungradedCount || "all"} ungraded`}</button>
              <button className="app-btn app-btn-primary" disabled={!submissions.length || Boolean(reviewCount)} onClick={bulkApprove} type="button">Approve completed</button>
              <button className="app-btn app-btn-ghost" disabled={!submissions.length} onClick={exportCsv} type="button">Export CSV</button>
            </div>
          </div>
        </section>

        <section className={`${panelClass} mt-6`}>
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#00C9A7]">Question insights</div>
              <h2 className="font-display text-2xl font-semibold">Common errors</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[#8496B0]">
                Recurring mistakes from graded submissions, with enough context to decide what to reteach or review.
              </p>
            </div>
            <span className="w-fit rounded-full border border-[#f59e0b40] bg-[#f59e0b14] px-3 py-1.5 font-mono text-xs text-[#F59E0B]">
              {totalErrors} flagged {totalErrors === 1 ? "item" : "items"}
            </span>
          </div>
          {analytics?.common_errors?.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {analytics.common_errors.map((item) => (
                <ErrorInsight
                  category={item.category}
                  count={item.count}
                  key={item.category}
                  total={totalErrors}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[#8496b033] bg-[#0B182966] p-6">
              <h3 className="font-display font-semibold">No recurring errors yet</h3>
              <p className="mt-1 text-sm leading-6 text-[#8496B0]">
                Grade a few submissions and patterns will appear here with counts and suggested review focus.
              </p>
            </div>
          )}
        </section>

        <div className="mt-6 space-y-6">
          <section className={panelClass}>
            <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div><h2 className="font-display text-2xl font-semibold">Submissions</h2><p className="mt-1 text-sm text-[#8496B0]">Open a submission for question-level feedback and teacher review.</p></div>
              <span className="font-mono text-xs text-[#8496B0]">{submissions.length} total</span>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {["all", "uploaded", "processing", "review_required", "completed", "failed"].map((status) => (
                <button
                  className={`app-btn app-btn-sm ${statusFilter === status ? "app-btn-secondary" : "app-btn-ghost"}`}
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  type="button"
                >
                  {status.replaceAll("_", " ")}
                </button>
              ))}
            </div>
            <div className="space-y-3">
              {filteredSubmissions.map((submission) => (
                <div className="flex flex-col justify-between gap-4 rounded-xl border border-[#8496b01f] bg-[#0B1829] p-4 md:flex-row md:items-center" key={submission.id}>
                  <div>
                    <Link href={`/submissions/${submission.id}`} className="font-display font-semibold transition hover:text-[#00C9A7]">
                      {submission.students?.name || submission.original_filename}
                    </Link>
                    <div className="mt-1 text-xs text-[#8496B0]">
                      {submission.score != null ? `${submission.score} / ${submission.max_score}` : "Not graded"}
                      {submission.confidence != null ? ` · ${Math.round(submission.confidence * 100)}% confidence` : ""}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <StatusBadge status={submission.status} />
                    <button
                      className="app-btn app-btn-secondary app-btn-sm"
                      disabled={submission.status === "processing" || gradingId === submission.id}
                      onClick={() => grade(submission.id)}
                      type="button"
                    >
                      {gradingId === submission.id ? "Grading…" : "Grade"}
                    </button>
                    <button
                      className="app-btn app-btn-danger app-btn-sm"
                      onClick={() => deleteSubmission(submission.id, submission.students?.name || submission.original_filename)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {!filteredSubmissions.length && <div className="rounded-xl border border-dashed border-[#8496b033] bg-[#0B182966] p-8 text-center"><div className="text-3xl">📄</div><h3 className="mt-3 font-display font-semibold">No submissions here</h3><p className="mt-1 text-sm text-[#8496B0]">Change the filter or upload work to continue.</p></div>}
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.7fr)]">
            <form className={`${panelClass} xl:col-span-2`} onSubmit={saveAssignment}>
              <div className="mb-5">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#00C9A7]">Assignment setup</div>
                <h2 className="font-display text-xl font-semibold">Edit rubric and key</h2>
                <p className="mt-1 text-xs leading-5 text-[#8496B0]">Save creates a version. Regrade existing submissions after rubric changes.</p>
              </div>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">Title</span>
                <input className={inputClass} value={editTitle} onChange={(event) => setEditTitle(event.target.value)} required />
              </label>
              <label className="mt-4 block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">Description</span>
                <textarea className={textareaClass} value={editDescription} onChange={(event) => setEditDescription(event.target.value)} />
              </label>
              <label className="mt-4 block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">General grading rules</span>
                <textarea className={textareaClass} value={editRules} onChange={(event) => setEditRules(event.target.value)} />
              </label>
              <div className="mt-5 rounded-xl border border-[#8496b01f] bg-[#0B1829] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-display font-semibold">Questions</h3>
                  <span className="font-mono text-xs text-[#8496B0]">{buildAssignmentPayload(editQuestions, editRules).totalPoints} points</span>
                </div>
                <div className="space-y-4">
                  {editQuestions.map((question, index) => (
                    <div className="rounded-xl border border-[#8496b01f] bg-[#132338] p-4" key={index}>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="font-display text-sm font-semibold">Question {index + 1}</span>
                        <button className="app-btn app-btn-danger app-btn-sm" onClick={() => removeEditQuestion(index)} type="button">Remove</button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-[80px_1fr_90px]">
                        <input className={inputClass} value={question.number} onChange={(event) => updateEditQuestion(index, { number: event.target.value })} required />
                        <input className={inputClass} value={question.prompt} onChange={(event) => updateEditQuestion(index, { prompt: event.target.value })} placeholder="Prompt" required />
                        <input className={inputClass} min="0.5" step="0.5" type="number" value={question.maxScore} onChange={(event) => updateEditQuestion(index, { maxScore: event.target.value })} required />
                      </div>
                      <textarea className={`${textareaClass} mt-3`} value={question.expectedAnswer} onChange={(event) => updateEditQuestion(index, { expectedAnswer: event.target.value })} placeholder="Expected answer" required />
                      <textarea className={`${textareaClass} mt-3`} value={question.criteria} onChange={(event) => updateEditQuestion(index, { criteria: event.target.value })} placeholder="Scoring criteria, one per line" />
                      <textarea className={`${textareaClass} mt-3`} value={question.commonMistakes} onChange={(event) => updateEditQuestion(index, { commonMistakes: event.target.value })} placeholder="Common mistakes, one per line" />
                    </div>
                  ))}
                </div>
                <button className="app-btn app-btn-secondary app-btn-full mt-4" onClick={addEditQuestion} type="button">Add question</button>
              </div>
              <label className="mt-4 block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">Change note</span>
                <input className={inputClass} value={editChangeNote} onChange={(event) => setEditChangeNote(event.target.value)} placeholder="What changed in this version?" />
              </label>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button className="app-btn app-btn-secondary app-btn-full" disabled={savingAssignment} type="submit">{savingAssignment ? "Saving..." : "Save version"}</button>
                <button className="app-btn app-btn-primary app-btn-full" disabled={regrading || !submissions.length} onClick={regradeAll} type="button">{regrading ? "Queueing..." : "Regrade all"}</button>
              </div>
            </form>

            <div className={panelClass}>
              <div className="mb-5">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#00C9A7]">History</div>
                <h2 className="font-display text-xl font-semibold">Versions and audit</h2>
              </div>
              <div className="space-y-3">
                {history?.versions?.slice(0, 4).map((version) => (
                  <div className="rounded-xl border border-[#8496b01f] bg-[#0B1829] p-4" key={version.id}>
                    <div className="font-display text-sm font-semibold">Version {version.version_number}</div>
                    <div className="mt-1 text-xs text-[#8496B0]">{new Date(version.created_at).toLocaleString()}</div>
                    {version.change_note && <p className="mt-2 text-sm leading-6 text-[#E2EAF4]">{version.change_note}</p>}
                  </div>
                ))}
                {history?.audit_logs?.slice(0, 5).map((log) => (
                  <div className="rounded-xl border border-[#8496b01f] bg-[#0B1829] p-4" key={log.id}>
                    <div className="font-display text-sm font-semibold">{log.action.replaceAll("_", " ")}</div>
                    <div className="mt-1 text-xs text-[#8496B0]">{new Date(log.created_at).toLocaleString()}</div>
                  </div>
                ))}
                {!history?.versions?.length && !history?.audit_logs?.length && <p className="text-sm text-[#8496B0]">No history yet.</p>}
              </div>
            </div>

            <form className={panelClass} onSubmit={upload}>
              <div className="mb-5"><div className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#00C9A7]">New submissions</div><h2 className="font-display text-xl font-semibold">Batch upload work</h2></div>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">Student</span>
                <select
                  className="app-select w-full rounded-xl border border-[#8496b02e] bg-[#0B1829] px-4 py-3 text-sm text-[#F8FAFC]"
                  disabled={files.length > 1}
                  onChange={(event) => setSelectedStudentId(event.target.value)}
                  value={selectedStudentId}
                >
                  <option value="">{files.length > 1 ? "Leave unassigned for batch upload" : "Choose an existing student"}</option>
                  {assignment?.students?.map((student) => <option value={student.id} key={student.id}>{student.name}</option>)}
                  <option value="__new__">Add a new student...</option>
                </select>
              </label>
              {selectedStudentId === "__new__" && files.length <= 1 && (
                <label className="mt-4 block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">New student name</span>
                  <input
                    className={inputClass}
                    onChange={(event) => setNewStudentName(event.target.value)}
                    placeholder="Enter a name only if this student is not in the roster"
                    value={newStudentName}
                  />
                </label>
              )}
              <label className="mt-4 block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">Worksheet</span>
                <input className={inputClass} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []))} required />
              </label>
              <button className="app-btn app-btn-primary app-btn-full app-btn-lg mt-5">Upload {files.length > 1 ? `${files.length} submissions` : "submission"}</button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}

function ErrorInsight({ category, count, total }: { category: string; count: number; total: number }) {
  const share = total ? Math.round((count / total) * 100) : 0;
  return (
    <article className="rounded-xl border border-[#8496b01f] bg-[#0B1829] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-base font-semibold text-[#E2EAF4]">{category}</h3>
          <p className="mt-1 text-sm leading-6 text-[#8496B0]">Review the related question work and reteach this pattern if it repeats.</p>
        </div>
        <span className="rounded-full border border-[#f59e0b40] bg-[#f59e0b14] px-2.5 py-1 font-mono text-xs text-[#F59E0B]">{count}</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded bg-[#8496b01f]">
        <div className="h-full rounded bg-[#F59E0B]" style={{ width: `${share}%` }} />
      </div>
      <div className="mt-2 text-xs text-[#8496B0]">{share}% of flagged error patterns</div>
    </article>
  );
}

function MetricCard({ value, label, tone = "default" }: { value: string | number; label: string; tone?: "default" | "teal" | "amber" }) {
  const toneClass = tone === "teal" ? "text-[#00C9A7]" : tone === "amber" ? "text-[#F59E0B]" : "text-[#F8FAFC]";
  return <div className="rounded-2xl border border-[#8496b01f] bg-[#132338] p-5"><div className={`font-mono text-3xl ${toneClass}`}>{value}</div><div className="mt-1 text-xs text-[#8496B0]">{label}</div></div>;
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const tone = normalized === "completed"
    ? "border-[#4ade804d] bg-[#4ade8014] text-[#4ADE80]"
    : normalized === "review_required"
      ? "border-[#f59e0b4d] bg-[#f59e0b14] text-[#F59E0B]"
      : normalized === "failed"
        ? "border-[#f871714d] bg-[#f8717114] text-[#F87171]"
        : "border-[#8496b033] bg-[#8496b014] text-[#8496B0]";
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${tone}`}>{status.replaceAll("_", " ")}</span>;
}
