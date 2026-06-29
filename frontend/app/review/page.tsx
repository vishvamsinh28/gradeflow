"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { InlineLoading } from "@/components/LoadingState";
import { useToast } from "@/components/ToastProvider";
import { api } from "@/lib/api";

type ReviewQueueItem = {
  id: string;
  original_filename: string;
  status: string;
  score?: number;
  max_score?: number;
  confidence?: number;
  students?: { name: string };
  assignment: { id: string; title: string };
  classroom: { id: string; name: string };
};

const panelClass = "rounded-2xl border border-[#8496b01f] bg-[#132338] p-5 shadow-[0_18px_48px_rgba(0,0,0,.12)] sm:p-6";

export default function ReviewPage() {
  const { notify } = useToast();
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    try {
      if (!items.length) setLoading(true);
      setItems(await api<ReviewQueueItem[]>("/submissions/review-queue"));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load review queue";
      setError(message);
      notify(message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(id: string) {
    setError("");
    setSavingId(id);
    try {
      await api(`/submissions/${id}/approve`, { method: "POST" });
      notify("Submission approved", "success");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not approve submission";
      setError(message);
      notify(message, "error");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="app-background min-h-screen">
      <Header />
      <main className="mx-auto w-[min(1180px,92vw)] pb-20 pt-10 sm:pt-12">
        <div className="flex flex-col justify-between gap-4 border-b border-[#8496b01f] pb-8 md:flex-row md:items-end">
          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-[#00C9A7]">Review center</div>
            <h1 className="font-display text-4xl font-bold tracking-[-1.5px] sm:text-5xl">Teacher review queue</h1>
            <p className="mt-3 max-w-2xl text-[#8496B0]">Resolve low-confidence grades across every class before returning results.</p>
          </div>
          <div className="rounded-xl border border-[#f59e0b40] bg-[#f59e0b14] px-4 py-3 text-right">
            <div className="font-mono text-2xl text-[#F59E0B]">{items.length}</div>
            <div className="text-xs text-[#FCD68A]">Pending</div>
          </div>
        </div>

        {error && <div className="mt-6 rounded-xl border border-[#f8717159] bg-[#f8717112] px-4 py-3 text-sm text-[#FCA5A5]">{error}</div>}

        <section className={`${panelClass} mt-6`}>
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-display text-2xl font-semibold">Needs attention</h2>
              <p className="mt-1 text-sm text-[#8496B0]">Open uncertain work for evidence, or approve a result when the score already looks right.</p>
            </div>
            <Link className="app-btn app-btn-secondary" href="/dashboard">Dashboard</Link>
          </div>

          {loading ? (
            <InlineLoading rows={4} />
          ) : items.length ? (
            <div className="grid gap-3">
              {items.map((item) => {
                const confidence = item.confidence != null ? Math.round(item.confidence * 100) : null;
                return (
                  <article className="grid gap-4 rounded-xl border border-[#8496b01f] bg-[#0B1829] p-4 md:grid-cols-[1fr_auto] md:items-center" key={item.id}>
                    <div>
                      <div className="text-xs text-[#8496B0]">{item.classroom.name} · {item.assignment.title}</div>
                      <h3 className="mt-2 font-display text-lg font-semibold">{item.students?.name || item.original_filename}</h3>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#8496B0]">
                        <span>{item.score != null ? `${item.score} / ${item.max_score}` : "Not scored"}</span>
                        {confidence != null && <span>{confidence}% confidence</span>}
                        <span className="capitalize">{item.status.replaceAll("_", " ")}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link className="app-btn app-btn-secondary app-btn-sm" href={`/submissions/${item.id}`}>Open review</Link>
                      <button className="app-btn app-btn-primary app-btn-sm" disabled={savingId === item.id} onClick={() => approve(item.id)} type="button">
                        {savingId === item.id ? "Approving..." : "Approve"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[#8496b033] bg-[#0B182966] p-8 text-center">
              <h3 className="font-display text-xl font-semibold">Review queue is clear</h3>
              <p className="mt-2 text-sm text-[#8496B0]">New low-confidence results will appear here automatically after grading.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
