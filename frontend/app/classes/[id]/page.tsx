"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/Header";
import { api } from "@/lib/api";
import { Classroom } from "@/lib/types";

const exampleKey = JSON.stringify({ questions: [{ number: "1", prompt: "Solve 2x + 3 = 11", expected_answer: "x = 4", max_score: 5 }] }, null, 2);
const exampleRubric = JSON.stringify({ general_rules: ["Award method marks for a correct approach."], questions: { "1": { criteria: [{ description: "Subtracts 3", points: 2 }, { description: "Divides by 2", points: 2 }, { description: "States x = 4", points: 1 }] } } }, null, 2);

const inputClass = "app-input w-full rounded-xl border border-[#8496b02e] bg-[#0B1829] px-4 py-3 text-sm text-[#F8FAFC]";
const textareaClass = "app-textarea min-h-[150px] w-full resize-y rounded-xl border border-[#8496b02e] bg-[#0B1829] px-4 py-3 font-mono text-xs leading-6 text-[#E2EAF4]";
const panelClass = "rounded-2xl border border-[#8496b01f] bg-[#132338] p-5 shadow-[0_18px_48px_rgba(0,0,0,.12)] sm:p-6";

export default function ClassPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Classroom | null>(null);
  const [studentName, setStudentName] = useState("");
  const [title, setTitle] = useState("");
  const [points, setPoints] = useState("5");
  const [answerKey, setAnswerKey] = useState(exampleKey);
  const [rubric, setRubric] = useState(exampleRubric);
  const [error, setError] = useState("");

  async function load() {
    try {
      setData(await api<Classroom>(`/classes/${id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load class");
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function addStudent(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api(`/classes/${id}/students`, { method: "POST", body: JSON.stringify({ name: studentName }) });
      setStudentName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add student");
    }
  }

  async function addAssignment(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api(`/classes/${id}/assignments`, {
        method: "POST",
        body: JSON.stringify({ title, total_points: Number(points), answer_key: JSON.parse(answerKey), rubric: JSON.parse(rubric), status: "active" }),
      });
      setTitle("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check that the JSON is valid");
    }
  }

  return (
    <div className="app-background min-h-screen">
      <Header />
      <main className="mx-auto w-[min(1180px,92vw)] pb-20 pt-10 sm:pt-12">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-[#8496B0] transition hover:text-[#00C9A7]">← All classes</Link>
        <div className="mt-5 flex flex-col justify-between gap-4 border-b border-[#8496b01f] pb-8 md:flex-row md:items-end">
          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-[#00C9A7]">{data?.subject || "Class workspace"}</div>
            <h1 className="font-display text-4xl font-bold tracking-[-1.5px] sm:text-5xl">{data?.name ?? "Class"}</h1>
            <p className="mt-3 text-[#8496B0]">{data?.grade_level || "Grade level not specified"}</p>
          </div>
          <div className="flex gap-3">
            <MetricMini value={data?.students?.length ?? 0} label="Students" />
            <MetricMini value={data?.assignments?.length ?? 0} label="Assignments" />
          </div>
        </div>

        {error && <div className="mt-6 rounded-xl border border-[#f8717159] bg-[#f8717112] px-4 py-3 text-sm text-[#FCA5A5]">{error}</div>}

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_340px]">
          <section className="space-y-6">
            <div className={panelClass}>
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl font-semibold">Assignments</h2>
                  <p className="mt-1 text-sm text-[#8496B0]">Open an assignment to upload and grade submissions.</p>
                </div>
                <span className="rounded-full border border-[#00c9a733] bg-[#00c9a714] px-3 py-1 font-mono text-xs text-[#00C9A7]">{data?.assignments?.length ?? 0}</span>
              </div>
              <div className="space-y-3">
                {data?.assignments?.map((assignment) => (
                  <Link
                    key={assignment.id}
                    href={`/assignments/${assignment.id}`}
                    className="group flex items-center justify-between gap-4 rounded-xl border border-[#8496b01f] bg-[#0B1829] p-4 transition hover:border-[#00c9a759]"
                  >
                    <div>
                      <strong className="font-display font-semibold">{assignment.title}</strong>
                      <div className="mt-1 text-xs text-[#8496B0]">{assignment.total_points} points</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-[#00c9a714] px-2.5 py-1 text-[11px] font-semibold capitalize text-[#00C9A7]">{assignment.status}</span>
                      <span className="text-[#8496B0] transition group-hover:translate-x-1 group-hover:text-[#00C9A7]">→</span>
                    </div>
                  </Link>
                ))}
                {!data?.assignments?.length && <EmptyState icon="📝" title="No assignments yet" text="Use the form below to create your first answer key and rubric." />}
              </div>
            </div>

            <form className={panelClass} onSubmit={addAssignment}>
              <div className="mb-6">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#00C9A7]">New grading workflow</div>
                <h2 className="font-display text-2xl font-semibold">Create assignment</h2>
                <p className="mt-1 text-sm text-[#8496B0]">Define the answer key and scoring rules the AI should follow.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">Title</span>
                  <input className={inputClass} required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Linear equations quiz" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">Total points</span>
                  <input className={inputClass} type="number" min="1" required value={points} onChange={(event) => setPoints(event.target.value)} />
                </label>
              </div>
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">Answer key (JSON)</span>
                  <textarea className={textareaClass} value={answerKey} onChange={(event) => setAnswerKey(event.target.value)} />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">Rubric (JSON)</span>
                  <textarea className={textareaClass} value={rubric} onChange={(event) => setRubric(event.target.value)} />
                </label>
              </div>
              <button className="mt-5 rounded-xl bg-[#00C9A7] px-5 py-3 font-display font-bold text-[#0B1829] transition hover:-translate-y-0.5 hover:bg-[#00A88C]">Create assignment</button>
            </form>
          </section>

          <aside className="space-y-6">
            <form className={panelClass} onSubmit={addStudent}>
              <div className="mb-5 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#00c9a714]">＋</div>
                <div><h2 className="font-display text-xl font-semibold">Add student</h2><p className="text-xs text-[#8496B0]">Build the class roster.</p></div>
              </div>
              <input className={inputClass} required value={studentName} onChange={(event) => setStudentName(event.target.value)} placeholder="Student name" />
              <button className="mt-4 w-full rounded-xl border border-[#00c9a74d] bg-[#00c9a714] px-5 py-3 font-display font-semibold text-[#00C9A7] transition hover:bg-[#00c9a724]">Add student</button>
            </form>

            <div className={panelClass}>
              <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-xl font-semibold">Students</h2><span className="font-mono text-xs text-[#8496B0]">{data?.students?.length ?? 0}</span></div>
              <div className="space-y-2">
                {data?.students?.map((student, index) => (
                  <div className="flex items-center gap-3 rounded-xl border border-[#8496b01a] bg-[#0B1829] px-3 py-3" key={student.id}>
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-[#00c9a714] font-mono text-[11px] text-[#00C9A7]">{String(index + 1).padStart(2, "0")}</div>
                    <span className="text-sm text-[#E2EAF4]">{student.name}</span>
                  </div>
                ))}
                {!data?.students?.length && <p className="text-sm text-[#8496B0]">No students yet.</p>}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function MetricMini({ value, label }: { value: number; label: string }) {
  return <div className="min-w-[92px] rounded-xl border border-[#8496b01f] bg-[#132338] px-4 py-3 text-center"><div className="font-mono text-xl text-[#00C9A7]">{value}</div><div className="text-[11px] text-[#8496B0]">{label}</div></div>;
}

function EmptyState({ icon, title, text }: { icon: string; title: string; text: string }) {
  return <div className="rounded-xl border border-dashed border-[#8496b033] bg-[#0B182966] p-6 text-center"><div className="text-2xl">{icon}</div><h3 className="mt-3 font-display font-semibold">{title}</h3><p className="mt-1 text-sm text-[#8496B0]">{text}</p></div>;
}
