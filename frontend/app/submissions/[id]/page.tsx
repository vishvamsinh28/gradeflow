"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/Header";
import { api } from "@/lib/api";
import { Submission } from "@/lib/types";

const panelClass = "rounded-2xl border border-[#8496b01f] bg-[#132338] p-5 shadow-[0_18px_48px_rgba(0,0,0,.12)] sm:p-6";
const inputClass = "app-input w-full rounded-xl border border-[#8496b02e] bg-[#0B1829] px-4 py-3 text-sm text-[#F8FAFC]";
const textareaClass = "app-textarea min-h-[100px] w-full resize-y rounded-xl border border-[#8496b02e] bg-[#0B1829] px-4 py-3 text-sm leading-6 text-[#F8FAFC]";

export default function SubmissionPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Submission | null>(null);
  const [score, setScore] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const row = await api<Submission>(`/submissions/${id}`);
      setData(row);
      setScore(String(row.score ?? ""));
      setNote(row.feedback?.teacher_note ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load submission");
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
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review update failed");
    } finally {
      setSaving(false);
    }
  }

  const confidence = data?.confidence != null ? Math.round(data.confidence * 100) : null;

  return (
    <div className="app-background min-h-screen">
      <Header />
      <main className="mx-auto w-[min(1180px,92vw)] pb-20 pt-10 sm:pt-12">
        <Link className="inline-flex items-center gap-2 text-sm text-[#8496B0] transition hover:text-[#00C9A7]" href="/dashboard">← Dashboard</Link>
        <div className="mt-5 flex flex-col justify-between gap-4 border-b border-[#8496b01f] pb-8 md:flex-row md:items-end">
          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-[#00C9A7]">Submission review</div>
            <h1 className="font-display text-4xl font-bold tracking-[-1.5px] sm:text-5xl">{data?.student?.name || data?.original_filename || "Submission"}</h1>
            <p className="mt-3 text-[#8496B0]">{data?.score != null ? `${data.score} / ${data.max_score} points` : "Not graded yet"}</p>
          </div>
          {data && <StatusBadge status={data.status} />}
        </div>

        {error && <div className="mt-6 rounded-xl border border-[#f8717159] bg-[#f8717112] px-4 py-3 text-sm text-[#FCA5A5]">{error}</div>}

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_350px]">
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
              {!data?.question_results?.length && <div className="rounded-xl border border-dashed border-[#8496b033] bg-[#0B182966] p-8 text-center"><div className="text-3xl">⚡</div><h3 className="mt-3 font-display font-semibold">No question results yet</h3><p className="mt-1 text-sm text-[#8496B0]">Run grading from the assignment page to generate detailed results.</p></div>}
            </div>
          </section>

          <aside className="space-y-6">
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
              <button disabled={saving} className="mt-5 w-full rounded-xl bg-[#00C9A7] px-5 py-3 font-display font-bold text-[#0B1829] transition hover:-translate-y-0.5 hover:bg-[#00A88C] disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Saving…" : "Approve result"}</button>
            </form>
          </aside>
        </div>
      </main>
    </div>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const low = value < 70;
  return <span className={`w-fit rounded-full border px-2.5 py-1 font-mono text-[11px] ${low ? "border-[#f59e0b4d] bg-[#f59e0b14] text-[#F59E0B]" : "border-[#00c9a74d] bg-[#00c9a714] text-[#00C9A7]"}`}>{value}% confidence</span>;
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
