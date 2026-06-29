"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/Header";
import { InlineLoading, PageLoading } from "@/components/LoadingState";
import { api } from "@/lib/api";

type StudentHistory = {
  student: { id: string; name: string } | null;
  classroom: { id: string; name: string; subject: string };
  submissions: {
    id: string;
    original_filename: string;
    status: string;
    score?: number;
    max_score?: number;
    confidence?: number;
    review_required: boolean;
    assignment?: { id: string; title: string; total_points: number };
  }[];
};

const panelClass = "rounded-2xl border border-[#8496b01f] bg-[#132338] p-5 shadow-[0_18px_48px_rgba(0,0,0,.12)] sm:p-6";

export default function StudentPage() {
  const { id, studentId } = useParams<{ id: string; studentId: string }>();
  const [data, setData] = useState<StudentHistory | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api<StudentHistory>(`/classes/${id}/students/${studentId}`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load student"))
      .finally(() => setLoading(false));
  }, [id, studentId]);

  const scored = data?.submissions.filter((submission) => submission.score != null && submission.max_score) ?? [];
  const average = scored.length
    ? Math.round(scored.reduce((sum, submission) => sum + (Number(submission.score) / Number(submission.max_score)) * 100, 0) / scored.length)
    : 0;

  return (
    <div className="app-background min-h-screen">
      <Header />
      <main className="mx-auto w-[min(1180px,92vw)] pb-20 pt-10 sm:pt-12">
        <Link className="inline-flex items-center gap-2 text-sm text-[#8496B0] transition hover:text-[#00C9A7]" href={`/classes/${id}`}>← Back to class</Link>
        <div className="mt-5 border-b border-[#8496b01f] pb-8">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-[#00C9A7]">{data?.classroom?.name ?? "Student profile"}</div>
          <h1 className="font-display text-4xl font-bold tracking-[-1.5px] sm:text-5xl">{data?.student?.name ?? "Student"}</h1>
          <p className="mt-3 text-[#8496B0]">Assignment history, review load, and performance trend.</p>
        </div>

        {error && <div className="mt-6 rounded-xl border border-[#f8717159] bg-[#f8717112] px-4 py-3 text-sm text-[#FCA5A5]">{error}</div>}

        {loading && !data ? (
          <PageLoading title="Loading student" detail="Fetching submission history and review status." />
        ) : (
        <>
        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <Metric value={data?.submissions.length ?? 0} label="Submissions" />
          <Metric value={`${average}%`} label="Average" tone="teal" />
          <Metric value={data?.submissions.filter((submission) => submission.review_required).length ?? 0} label="Needs review" tone="amber" />
        </section>

        <section className={`${panelClass} mt-6`}>
          <h2 className="font-display text-2xl font-semibold">Submission history</h2>
          <div className="mt-5 space-y-3">
            {data?.submissions.map((submission) => (
              <Link className="flex flex-col justify-between gap-3 rounded-xl border border-[#8496b01f] bg-[#0B1829] p-4 transition hover:border-[#00c9a759] sm:flex-row sm:items-center" href={`/submissions/${submission.id}`} key={submission.id}>
                <div>
                  <div className="font-display font-semibold">{submission.assignment?.title ?? submission.original_filename}</div>
                  <div className="mt-1 text-xs text-[#8496B0]">{submission.status.replaceAll("_", " ")}</div>
                </div>
                <div className="font-mono text-sm text-[#00C9A7]">{submission.score != null ? `${submission.score} / ${submission.max_score}` : "Not graded"}</div>
              </Link>
            ))}
            {loading ? <InlineLoading rows={3} /> : !data?.submissions.length && <p className="text-sm text-[#8496B0]">No submissions yet.</p>}
          </div>
        </section>
        </>
        )}
      </main>
    </div>
  );
}

function Metric({ value, label, tone = "default" }: { value: string | number; label: string; tone?: "default" | "teal" | "amber" }) {
  const toneClass = tone === "teal" ? "text-[#00C9A7]" : tone === "amber" ? "text-[#F59E0B]" : "text-[#F8FAFC]";
  return <div className="rounded-2xl border border-[#8496b01f] bg-[#132338] p-5"><div className={`font-mono text-3xl ${toneClass}`}>{value}</div><div className="mt-1 text-xs text-[#8496B0]">{label}</div></div>;
}
