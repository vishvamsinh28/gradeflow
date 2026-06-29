"use client";

import { use, useEffect, useState } from "react";
import { PageLoading } from "@/components/LoadingState";
import { api } from "@/lib/api";

type ResultSubmission = {
  id: string;
  status: string;
  score?: number;
  max_score?: number;
  feedback?: { summary?: string; teacher_action?: string; teacher_note?: string };
  confidence?: number;
  reviewed_at?: string;
  assignment?: { id: string; title: string; total_points: number; status: string };
};

type ResultsPayload = {
  student: { name: string };
  classroom?: { name: string; subject: string; grade_level?: string };
  submissions: ResultSubmission[];
};

export default function StudentResultsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<ResultsPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api<ResultsPayload>(`/public/results/${token}`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load results"))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="app-background min-h-screen">
      <main className="mx-auto w-[min(960px,92vw)] pb-20 pt-10 sm:pt-14">
        <div className="border-b border-[#8496b01f] pb-8">
          <div className="font-display text-xl font-bold tracking-[-0.5px]">Grade<span className="text-[#00C9A7]">Flow</span></div>
          <div className="mt-8 text-xs font-semibold uppercase tracking-[0.1em] text-[#00C9A7]">Returned results</div>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-[-1.5px] sm:text-5xl">{data?.student.name ?? "Student results"}</h1>
          <p className="mt-3 text-[#8496B0]">{data?.classroom ? `${data.classroom.name} · ${data.classroom.subject}` : "Only returned assignments appear here."}</p>
        </div>

        {error && <div className="mt-6 rounded-xl border border-[#f8717159] bg-[#f8717112] px-4 py-3 text-sm text-[#FCA5A5]">{error}</div>}

        {loading && !data ? (
          <PageLoading title="Loading results" detail="Fetching returned assignments for this student link." />
        ) : (
        <section className="mt-6 space-y-4">
          {data?.submissions.map((submission) => {
            const percent = submission.score != null && submission.max_score ? Math.round((submission.score / submission.max_score) * 100) : null;
            return (
              <article className="rounded-2xl border border-[#8496b01f] bg-[#132338] p-5 shadow-[0_18px_48px_rgba(0,0,0,.12)] sm:p-6" key={submission.id}>
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <h2 className="font-display text-2xl font-semibold">{submission.assignment?.title ?? "Returned assignment"}</h2>
                    <p className="mt-1 text-sm text-[#8496B0]">{submission.reviewed_at ? `Reviewed ${new Date(submission.reviewed_at).toLocaleDateString()}` : "Reviewed by teacher"}</p>
                  </div>
                  <div className="rounded-xl border border-[#00c9a733] bg-[#00c9a714] px-4 py-3 text-right">
                    <div className="font-mono text-2xl text-[#00C9A7]">{submission.score ?? "-"} / {submission.max_score ?? "-"}</div>
                    {percent != null && <div className="text-xs text-[#CFFCF4]">{percent}%</div>}
                  </div>
                </div>
                <div className="mt-5 rounded-xl border border-[#8496b01f] bg-[#0B1829] p-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">Feedback</div>
                  <p className="text-sm leading-6 text-[#E2EAF4]">{submission.feedback?.teacher_note || submission.feedback?.summary || "No feedback was added."}</p>
                </div>
              </article>
            );
          })}
          {data && !data.submissions.length && (
            <div className="rounded-2xl border border-dashed border-[#8496b033] bg-[#132338] p-8 text-center">
              <h2 className="font-display text-2xl font-semibold">No returned results yet</h2>
              <p className="mt-2 text-sm text-[#8496B0]">Your teacher has not returned any graded assignments to this link yet.</p>
            </div>
          )}
        </section>
        )}
      </main>
    </div>
  );
}
