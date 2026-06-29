"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";
import { Header } from "@/components/Header";
import { useToast } from "@/components/ToastProvider";
import { api, clearAuthToken } from "@/lib/api";
import { Classroom, TeacherSettings, User } from "@/lib/types";

const inputClass = "app-input w-full rounded-xl border border-[#8496b02e] bg-[#0B1829] px-4 py-3 text-sm text-[#F8FAFC]";
const panelClass = "rounded-2xl border border-[#8496b01f] bg-[#132338] p-5 shadow-[0_18px_48px_rgba(0,0,0,.12)] sm:p-6";

type ReviewQueueItem = {
  id: string;
  original_filename: string;
  score?: number;
  max_score?: number;
  confidence?: number;
  students?: { name: string };
  assignment: { id: string; title: string };
  classroom: { id: string; name: string };
};

export default function Dashboard() {
  const router = useRouter();
  const confirm = useConfirm();
  const { notify } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [settings, setSettings] = useState<TeacherSettings | null>(null);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      const [me, classRows, reviewRows, settingsRow] = await Promise.all([
        api<User>("/auth/me"),
        api<Classroom[]>("/classes"),
        api<ReviewQueueItem[]>("/submissions/review-queue"),
        api<TeacherSettings>("/settings"),
      ]);
      setUser(me);
      setClasses(classRows);
      setReviewQueue(reviewRows);
      setSettings(settingsRow);
      setSubject((current) => current || settingsRow.default_subject);
      setGrade((current) => current || settingsRow.default_grade_level || "");
    } catch (err) {
      if (err instanceof Error && "status" in err && err.status === 401) {
        clearAuthToken();
        router.replace("/");
        return;
      }
      const message = err instanceof Error ? err.message : "Could not load dashboard";
      setError(message);
      notify(message, "error");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createClass(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api("/classes", {
        method: "POST",
        body: JSON.stringify({ name, grade_level: grade || null, subject }),
      });
      setName("");
      setGrade(settings?.default_grade_level || "");
      setSubject(settings?.default_subject || "Mathematics");
      notify("Class created", "success");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not create class";
      setError(message);
      notify(message, "error");
    }
  }

  async function deleteClass(classId: string, className: string) {
    const confirmed = await confirm({
      title: `Delete ${className}?`,
      message: "This removes the class, its students, assignments, submissions, grading results, and uploaded files.",
      confirmLabel: "Delete class",
    });
    if (!confirmed) return;
    setError("");
    try {
      await api<void>(`/classes/${classId}`, { method: "DELETE" });
      notify("Class deleted", "success");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not delete class";
      setError(message);
      notify(message, "error");
    }
  }

  return (
    <div className="app-background min-h-screen">
      <Header />
      <main className="mx-auto w-[min(1180px,92vw)] pb-20 pt-10 sm:pt-12">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-[#00C9A7]">Teacher workspace</div>
            <h1 className="font-display text-4xl font-bold tracking-[-1.5px] sm:text-5xl">
              {user ? `${user.full_name}’s classes` : "Your classes"}
            </h1>
            <p className="mt-3 max-w-2xl text-[#8496B0]">Create a classroom, add students, build assignments, and review AI-assisted grades.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <MiniMetric value={classes.length} label="Classes" />
            <MiniMetric value={classes.reduce((sum, item) => sum + (item.assignments?.length ?? 0), 0)} label="Assignments" />
            <MiniMetric value={reviewQueue.length} label="Need review" tone="amber" />
          </div>
        </div>

        {error && <div className="mb-6 rounded-xl border border-[#f8717159] bg-[#f8717112] px-4 py-3 text-sm text-[#FCA5A5]">{error}</div>}

        <section className={`${panelClass} mb-6`}>
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#00C9A7]">Review queue</div>
              <h2 className="font-display text-2xl font-semibold">Submissions needing your eyes</h2>
              <p className="mt-1 text-sm text-[#8496B0]">Low-confidence grades across every class, ordered by most recent activity.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="w-fit rounded-full border border-[#f59e0b40] bg-[#f59e0b14] px-3 py-1.5 font-mono text-xs text-[#F59E0B]">{reviewQueue.length} pending</span>
              <Link className="app-btn app-btn-secondary app-btn-sm" href="/review">Open queue</Link>
            </div>
          </div>
          {reviewQueue.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {reviewQueue.slice(0, 6).map((item) => (
                <Link className="rounded-xl border border-[#8496b01f] bg-[#0B1829] p-4 transition hover:border-[#00c9a759]" href={`/submissions/${item.id}`} key={item.id}>
                  <div className="text-xs text-[#8496B0]">{item.classroom.name} · {item.assignment.title}</div>
                  <h3 className="mt-2 font-display font-semibold">{item.students?.name || item.original_filename}</h3>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#8496B0]">
                    <span>{item.score != null ? `${item.score} / ${item.max_score}` : "Not scored"}</span>
                    {item.confidence != null && <span>{Math.round(item.confidence * 100)}% confidence</span>}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[#8496b033] bg-[#0B182966] p-6">
              <h3 className="font-display font-semibold">Nothing needs review right now</h3>
              <p className="mt-1 text-sm text-[#8496B0]">Upload and grade work; uncertain results will appear here automatically.</p>
            </div>
          )}
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {classes.map((item) => (
              <article
                className="group rounded-2xl border border-[#8496b01f] bg-[#132338] p-5 transition hover:-translate-y-1 hover:border-[#00c9a759] hover:shadow-[0_18px_48px_rgba(0,0,0,.16)]"
                key={item.id}
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="rounded-full border border-[#00c9a733] bg-[#00c9a714] px-2.5 py-1 text-[11px] font-semibold text-[#00C9A7]">{item.subject}</span>
                  <button
                    className="app-btn app-btn-danger app-btn-sm"
                    onClick={() => deleteClass(item.id, item.name)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
                <Link href={`/classes/${item.id}`}>
                  <h2 className="mt-8 font-display text-xl font-semibold tracking-[-0.4px] transition hover:text-[#00C9A7]">{item.name}</h2>
                  <p className="mt-1 text-sm text-[#8496B0]">{item.grade_level || "Grade not specified"}</p>
                  <div className="mt-6 flex items-center gap-4 border-t border-[#8496b01a] pt-4 text-xs text-[#8496B0]">
                    <span>{item.students?.length ?? 0} students</span>
                    <span>·</span>
                    <span>{item.assignments?.length ?? 0} assignments</span>
                  </div>
                </Link>
              </article>
            ))}
            {!classes.length && (
              <div className={`${panelClass} sm:col-span-2 xl:col-span-3`}>
                <div className="grid h-12 w-12 place-items-center rounded-xl border border-[#00c9a733] bg-[#00c9a714] text-2xl">🏫</div>
                <h2 className="mt-5 font-display text-2xl font-semibold">No classes yet</h2>
                <p className="mt-2 max-w-lg text-sm leading-6 text-[#8496B0]">Use the form to create your first class. GradeFlow works across subjects, grade levels, and custom rubrics.</p>
              </div>
            )}
          </section>

          <form className={panelClass} onSubmit={createClass}>
            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#00c9a714]">＋</div>
              <div>
                <h2 className="font-display text-xl font-semibold">New class</h2>
                <p className="text-xs text-[#8496B0]">Set up a workspace in seconds.</p>
              </div>
            </div>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">Class name</span>
              <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} required placeholder="Algebra A" />
            </label>
            <label className="mt-4 block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">Subject</span>
              <input className={inputClass} value={subject} onChange={(event) => setSubject(event.target.value)} required placeholder="Mathematics" />
            </label>
            <label className="mt-4 block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">Grade level</span>
              <input className={inputClass} value={grade} onChange={(event) => setGrade(event.target.value)} placeholder="Grade 8" />
            </label>
            <button className="app-btn app-btn-primary app-btn-full app-btn-lg mt-6">Create class</button>
          </form>
        </div>
      </main>
    </div>
  );
}

function MiniMetric({ value, label, tone = "teal" }: { value: number; label: string; tone?: "teal" | "amber" }) {
  return (
    <div className="rounded-xl border border-[#8496b01f] bg-[#132338] px-4 py-3 text-sm text-[#E2EAF4]">
      <div className={`font-mono text-xl ${tone === "amber" ? "text-[#F59E0B]" : "text-[#00C9A7]"}`}>{value}</div>
      <div className="text-[11px] text-[#8496B0]">{label}</div>
    </div>
  );
}
