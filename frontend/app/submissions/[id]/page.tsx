"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";
import { Header } from "@/components/Header";
import { InlineLoading, PageLoading } from "@/components/LoadingState";
import { useToast } from "@/components/ToastProvider";
import { API_URL, api, getAuthToken } from "@/lib/api";
import { Submission } from "@/lib/types";

const panelClass = "rounded-2xl border border-[#8496b01f] bg-[#132338] p-5 shadow-[0_18px_48px_rgba(0,0,0,.12)] sm:p-6";
const inputClass = "app-input w-full rounded-xl border border-[#8496b02e] bg-[#0B1829] px-4 py-3 text-sm text-[#F8FAFC]";
const textareaClass = "app-textarea min-h-[100px] w-full resize-y rounded-xl border border-[#8496b02e] bg-[#0B1829] px-4 py-3 text-sm leading-6 text-[#F8FAFC]";

export default function SubmissionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const confirm = useConfirm();
  const { notify } = useToast();
  const [data, setData] = useState<Submission | null>(null);
  const [score, setScore] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    try {
      if (!data) setLoading(true);
      const row = await api<Submission>(`/submissions/${id}`);
      setData(row);
      setScore(String(row.score ?? ""));
      setNote(row.feedback?.teacher_note ?? "");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load submission";
      setError(message);
      notify(message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function review(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api(`/submissions/${id}/review`, {
        method: "PATCH",
        body: JSON.stringify({ score: Number(score), teacher_note: note || null }),
      });
      notify("Review saved", "success");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Review update failed";
      setError(message);
      notify(message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function approveAsIs() {
    setSaving(true);
    setError("");
    try {
      await api(`/submissions/${id}/approve`, { method: "POST" });
      notify("Submission approved", "success");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Approval failed";
      setError(message);
      notify(message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSubmission() {
    if (!data) return;
    const label = data.student?.name || data.original_filename;
    const confirmed = await confirm({
      title: `Delete ${label}?`,
      message: "This removes the uploaded work and its question-level grading results.",
      confirmLabel: "Delete submission",
    });
    if (!confirmed) return;
    setError("");
    setDeleting(true);
    try {
      await api<void>(`/submissions/${id}`, { method: "DELETE" });
      notify("Submission deleted", "success");
      router.push("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not delete submission";
      setError(message);
      notify(message, "error");
    } finally {
      setDeleting(false);
    }
  }

  const confidence = data?.confidence != null ? Math.round(data.confidence * 100) : null;
  const extractedQuestions = data?.extracted_answers?.questions ?? [];

  return (
    <div className="app-background min-h-screen">
      <Header />
      <main className="mx-auto w-[min(1180px,92vw)] pb-20 pt-10 sm:pt-12">
        <Link className="inline-flex items-center gap-2 text-sm text-[#8496B0] transition hover:text-[#00C9A7]" href={data?.assignment?.id ? `/assignments/${data.assignment.id}` : "/dashboard"}>← Back to assignment</Link>
        <div className="mt-5 flex flex-col justify-between gap-4 border-b border-[#8496b01f] pb-8 md:flex-row md:items-end">
          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-[#00C9A7]">Submission review</div>
            <h1 className="font-display text-4xl font-bold tracking-[-1.5px] sm:text-5xl">{data?.student?.name || data?.original_filename || "Submission"}</h1>
            <p className="mt-3 text-[#8496B0]">{data?.score != null ? `${data.score} / ${data.max_score} points` : "Not graded yet"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {data && <StatusBadge status={data.status} />}
            {data && (
              <button
                className="app-btn app-btn-danger"
                disabled={deleting}
                onClick={deleteSubmission}
                type="button"
              >
                {deleting ? "Deleting..." : "Delete submission"}
              </button>
            )}
          </div>
        </div>

        {error && <div className="mt-6 rounded-xl border border-[#f8717159] bg-[#f8717112] px-4 py-3 text-sm text-[#FCA5A5]">{error}</div>}

        {loading && !data ? (
          <PageLoading title="Loading submission" detail="Fetching the uploaded work, question results, and teacher review tools." />
        ) : (
        <div className="mt-6 space-y-6">
          <section className={panelClass}>
            <div className="mb-6 flex flex-col justify-between gap-3 border-b border-[#8496b01a] pb-5 sm:flex-row sm:items-center">
              <div><h2 className="font-display text-2xl font-semibold">Original work</h2><p className="mt-1 text-sm text-[#8496B0]">Uploaded worksheet used for extraction and grading.</p></div>
              {data?.mime_type && <span className="rounded-full border border-[#8496b033] bg-[#8496b014] px-2.5 py-1 font-mono text-[11px] text-[#8496B0]">{data.mime_type}</span>}
            </div>
            {data ? <SubmissionFilePreview submissionId={id} filename={data.original_filename} mimeType={data.mime_type} /> : null}
            <div className="mt-5 rounded-xl border border-[#8496b01f] bg-[#0B1829] p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">Extraction notes</div>
              <p className="text-sm leading-6 text-[#E2EAF4]">{data?.extracted_answers?.document_notes || "No extraction notes were recorded."}</p>
              {extractedQuestions.length > 0 && (
                <div className="mt-4 space-y-2">
                  {extractedQuestions.map((question, index) => (
                    <pre className="overflow-auto rounded-lg bg-[#132338] p-3 text-xs leading-5 text-[#CFE7FF]" key={index}>{JSON.stringify(question, null, 2)}</pre>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className={panelClass}>
            <div className="mb-6 flex flex-col justify-between gap-3 border-b border-[#8496b01a] pb-5 sm:flex-row sm:items-center">
              <div><h2 className="font-display text-2xl font-semibold">Question results</h2><p className="mt-1 text-sm text-[#8496B0]">AI-extracted work, scoring rationale, and confidence.</p></div>
              <span className="font-mono text-xs text-[#8496B0]">{data?.question_results?.length ?? 0} questions</span>
            </div>
            <div className="space-y-4">
              {data?.question_results?.map((question) => {
                const questionConfidence = Math.round(question.confidence * 100);
                return (
                  <article className="rounded-2xl border border-[#8496b01f] bg-[#0B1829] p-5" key={question.id}>
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#00C9A7]">Question {question.question_number}</span>
                        <h3 className="mt-1 font-display text-xl font-semibold">{question.score} / {question.max_score} points</h3>
                      </div>
                      <ConfidenceBadge value={questionConfidence} />
                    </div>
                    <div className="mt-5 rounded-xl border border-[#8496b01a] bg-[#132338] p-4">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">Student work</div>
                      <p className="font-mono text-sm leading-6 text-[#E2EAF4]">{question.student_work || "No readable work"}</p>
                    </div>
                    <div className="mt-4">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">Feedback</div>
                      <p className="text-sm leading-6 text-[#E2EAF4]">{question.feedback}</p>
                    </div>
                    {question.error_category && <span className="mt-4 inline-flex rounded-full border border-[#f59e0b40] bg-[#f59e0b14] px-2.5 py-1 text-[11px] font-semibold text-[#F59E0B]">{question.error_category}</span>}
                  </article>
                );
              })}
              {loading ? <InlineLoading rows={2} /> : !data?.question_results?.length && <div className="rounded-xl border border-dashed border-[#8496b033] bg-[#0B182966] p-8 text-center"><div className="text-3xl">⚡</div><h3 className="mt-3 font-display font-semibold">No question results yet</h3><p className="mt-1 text-sm text-[#8496B0]">Run grading from the assignment page to generate detailed results.</p></div>}
            </div>
          </section>

          <aside className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.72fr)]">
            <div className={panelClass}>
              <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-xl font-semibold">AI summary</h2><span className="text-lg">🧠</span></div>
              <p className="text-sm leading-6 text-[#E2EAF4]">{data?.feedback?.summary || "No summary yet."}</p>
              {data?.feedback?.teacher_action && <div className="mt-4 rounded-xl border border-[#f59e0b33] bg-[#f59e0b0d] p-3 text-sm leading-6 text-[#FCD68A]">{data.feedback.teacher_action}</div>}
              {confidence != null && (
                <div className="mt-6 border-t border-[#8496b01a] pt-5">
                  <div className="flex items-end justify-between"><div><div className="font-mono text-3xl text-[#00C9A7]">{confidence}%</div><div className="mt-1 text-xs text-[#8496B0]">Overall confidence</div></div><ConfidenceBadge value={confidence} /></div>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#8496b01f]"><div className={`${confidence < 70 ? "bg-[#F59E0B]" : "bg-[#00C9A7]"} h-full rounded-full`} style={{ width: `${confidence}%` }} /></div>
                </div>
              )}
            </div>

            <form className={panelClass} onSubmit={review}>
              <div className="mb-5"><div className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#00C9A7]">Human in the loop</div><h2 className="font-display text-xl font-semibold">Teacher review</h2><p className="mt-1 text-xs leading-5 text-[#8496B0]">Override the score or leave a final note before approval.</p></div>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">Final score</span>
                <input className={inputClass} type="number" min="0" max={data?.max_score} step="0.5" value={score} onChange={(event) => setScore(event.target.value)} required />
              </label>
              <label className="mt-4 block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">Teacher note</span>
                <textarea className={textareaClass} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note for the student" />
              </label>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button disabled={saving} className="app-btn app-btn-primary app-btn-full app-btn-lg" type="submit">{saving ? "Saving..." : "Save review"}</button>
                <button disabled={saving} className="app-btn app-btn-secondary app-btn-full app-btn-lg" onClick={approveAsIs} type="button">{saving ? "Approving..." : "Approve as-is"}</button>
              </div>
            </form>
          </aside>
        </div>
        )}
      </main>
    </div>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const low = value < 70;
  return <span className={`w-fit rounded-full border px-2.5 py-1 font-mono text-[11px] ${low ? "border-[#f59e0b4d] bg-[#f59e0b14] text-[#F59E0B]" : "border-[#00c9a74d] bg-[#00c9a714] text-[#00C9A7]"}`}>{value}% confidence</span>;
}

function SubmissionFilePreview({ submissionId, filename, mimeType }: { submissionId: string; filename: string; mimeType?: string }) {
  const [fileUrl, setFileUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";

    async function loadFile() {
      setLoading(true);
      setError("");
      try {
        const token = getAuthToken();
        const response = await fetch(`${API_URL}/submissions/${submissionId}/file`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Could not load original file");
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setFileUrl(objectUrl);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load original file");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadFile();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [submissionId]);

  const isImage = mimeType?.startsWith("image/");
  const isPdf = mimeType === "application/pdf";

  return (
    <div className="overflow-hidden rounded-xl border border-[#8496b01f] bg-[#0B1829]">
      <div className="flex flex-col justify-between gap-3 border-b border-[#8496b01a] bg-[#071321] px-4 py-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <div className="truncate font-display text-sm font-semibold text-[#F8FAFC]">{filename}</div>
          <div className="mt-1 text-xs text-[#8496B0]">{mimeType || "Uploaded file"}</div>
        </div>
        {fileUrl && (
          <div className="flex flex-wrap gap-2">
            <a className="app-btn app-btn-secondary app-btn-sm" href={fileUrl} rel="noreferrer" target="_blank">Open</a>
            <a className="app-btn app-btn-ghost app-btn-sm" download={filename} href={fileUrl}>Download</a>
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-5">
          <InlineLoading rows={3} />
        </div>
      ) : error ? (
        <div className="p-8 text-center">
          <h3 className="font-display text-lg font-semibold">Could not show the original work</h3>
          <p className="mt-2 text-sm leading-6 text-[#8496B0]">{error}. Try refreshing after signing in again.</p>
        </div>
      ) : isImage && fileUrl ? (
        <div className="bg-[#06101c] p-3">
          <img className="mx-auto max-h-[760px] w-full rounded-lg object-contain" src={fileUrl} alt={filename} />
        </div>
      ) : isPdf && fileUrl ? (
        <iframe className="h-[760px] w-full bg-[#06101c]" src={fileUrl} title={filename} />
      ) : (
        <div className="p-8 text-center">
          <h3 className="font-display text-lg font-semibold">Preview unavailable</h3>
          <p className="mt-2 text-sm leading-6 text-[#8496B0]">This file type can still be opened or downloaded from the actions above.</p>
        </div>
      )}
    </div>
  );
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
  return <span className={`w-fit rounded-full border px-3 py-1.5 text-xs font-semibold capitalize ${tone}`}>{status.replaceAll("_", " ")}</span>;
}
