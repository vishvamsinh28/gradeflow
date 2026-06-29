"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { api } from "@/lib/api";
import { Classroom, User } from "@/lib/types";

const inputClass = "app-input w-full rounded-xl border border-[#8496b02e] bg-[#0B1829] px-4 py-3 text-sm text-[#F8FAFC]";
const panelClass = "rounded-2xl border border-[#8496b01f] bg-[#132338] p-5 shadow-[0_18px_48px_rgba(0,0,0,.12)] sm:p-6";

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("Mathematics");
  const [error, setError] = useState("");

  async function load() {
    try {
      const [me, classRows] = await Promise.all([api<User>("/auth/me"), api<Classroom[]>("/classes")]);
      setUser(me);
      setClasses(classRows);
    } catch (err) {
      if (err instanceof Error && "status" in err && err.status === 401) {
        router.replace("/");
        return;
      }
      setError(err instanceof Error ? err.message : "Could not load dashboard");
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
      setGrade("");
      setSubject("Mathematics");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create class");
    }
  }

  async function deleteClass(classId: string, className: string) {
    if (!window.confirm(`Delete "${className}" and all of its assignments, submissions, and students?`)) return;
    setError("");
    try {
      await api<void>(`/classes/${classId}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete class");
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
          <div className="rounded-xl border border-[#00c9a733] bg-[#00c9a70d] px-4 py-3 text-sm text-[#E2EAF4]">
            <span className="font-mono text-[#00C9A7]">{classes.length}</span> active {classes.length === 1 ? "class" : "classes"}
          </div>
        </div>

        {error && <div className="mb-6 rounded-xl border border-[#f8717159] bg-[#f8717112] px-4 py-3 text-sm text-[#FCA5A5]">{error}</div>}

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
                    className="rounded-lg border border-[#f871714d] px-2.5 py-1 text-xs font-semibold text-[#F87171] transition hover:bg-[#f8717114]"
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
            <button className="mt-6 w-full rounded-xl bg-[#00C9A7] px-5 py-3 font-display font-bold text-[#0B1829] transition hover:-translate-y-0.5 hover:bg-[#00A88C]">Create class</button>
          </form>
        </div>
      </main>
    </div>
  );
}
