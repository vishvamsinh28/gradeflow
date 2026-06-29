"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { api } from "@/lib/api";
import { Assignment, Submission } from "@/lib/types";

type Analytics = {
  submission_count: number;
  scored_count: number;
  review_required_count: number;
  average_percentage: number;
  common_errors: { category: string; count: number }[];
};

const panelClass = "rounded-2xl border border-[#8496b01f] bg-[#132338] p-5 shadow-[0_18px_48px_rgba(0,0,0,.12)] sm:p-6";
const inputClass = "app-input w-full rounded-xl border border-[#8496b02e] bg-[#0B1829] px-4 py-3 text-sm text-[#F8FAFC]";

export default function AssignmentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [studentName, setStudentName] = useState("");
  const [error, setError] = useState("");
  const [gradingId, setGradingId] = useState<string | null>(null);

  async function load() {
    try {
      const [assignmentRow, submissionRows, stats] = await Promise.all([
        api<Assignment>(`/assignments/${id}`),
        api<Submission[]>(`/assignments/${id}/submissions`),
        api<Analytics>(`/analytics/assignments/${id}`),
      ]);
      setAssignment(assignmentRow);
      setSubmissions(submissionRows);
      setAnalytics(stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load assignment");
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    setError("");
    const body = new FormData();
    body.append("file", file);
    if (studentName.trim()) body.append("student_name", studentName.trim());
    try {
      await api(`/assignments/${id}/submissions`, { method: "POST", body });
      setFile(null);
      setStudentName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  const totalErrors = analytics?.common_errors?.reduce((sum, item) => sum + item.count, 0) ?? 0;

  async function grade(submissionId: string) {
    setError("");
    setGradingId(submissionId);
    try {
      await api(`/submissions/${submissionId}/grade`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Grading failed");
    } finally {
      setGradingId(null);
    }
  }

  async function deleteAssignment() {
    if (!assignment || !window.confirm(`Delete "${assignment.title}" and all of its submissions?`)) return;
    setError("");
    try {
      await api<void>(`/assignments/${id}`, { method: "DELETE" });
      router.push(`/classes/${assignment.class_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete assignment");
    }
  }

  async function deleteSubmission(submissionId: string, label: string) {
    if (!window.confirm(`Delete submission "${label}"?`)) return;
    setError("");
    try {
      await api<void>(`/submissions/${submissionId}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete submission");
    }
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
          <MetricCard value={analytics?.review_required_count ?? 0} label="Need review" tone="amber" />
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

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_350px]">
          <section className={panelClass}>
            <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div><h2 className="font-display text-2xl font-semibold">Submissions</h2><p className="mt-1 text-sm text-[#8496B0]">Open a submission for question-level feedback and teacher review.</p></div>
              <span className="font-mono text-xs text-[#8496B0]">{submissions.length} total</span>
            </div>
            <div className="space-y-3">
              {submissions.map((submission) => (
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
              {!submissions.length && <div className="rounded-xl border border-dashed border-[#8496b033] bg-[#0B182966] p-8 text-center"><div className="text-3xl">📄</div><h3 className="mt-3 font-display font-semibold">No submissions uploaded</h3><p className="mt-1 text-sm text-[#8496B0]">Use the upload panel to add the first worksheet.</p></div>}
            </div>
          </section>

          <aside className="space-y-6">
            <form className={panelClass} onSubmit={upload}>
              <div className="mb-5"><div className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#00C9A7]">New submission</div><h2 className="font-display text-xl font-semibold">Upload work</h2></div>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">Student name</span>
                <input
                  className={inputClass}
                  list="assignment-students"
                  onChange={(event) => setStudentName(event.target.value)}
                  placeholder="Type or choose a student"
                  value={studentName}
                />
                <datalist id="assignment-students">
                  {assignment?.students?.map((student) => <option value={student.name} key={student.id} />)}
                </datalist>
              </label>
              <label className="mt-4 block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">Worksheet</span>
                <input className={inputClass} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required />
              </label>
              <button className="app-btn app-btn-primary app-btn-full app-btn-lg mt-5">Upload submission</button>
            </form>
          </aside>
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
