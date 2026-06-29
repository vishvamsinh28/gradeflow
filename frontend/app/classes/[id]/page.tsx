"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";
import { Header } from "@/components/Header";
import { InlineLoading, PageLoading } from "@/components/LoadingState";
import { useToast } from "@/components/ToastProvider";
import { api } from "@/lib/api";
import { Classroom, TeacherSettings } from "@/lib/types";

type QuestionDraft = {
  number: string;
  prompt: string;
  expectedAnswer: string;
  maxScore: string;
  criteria: string;
  commonMistakes: string;
};

const newQuestion = (number = "1"): QuestionDraft => ({
  number,
  prompt: "",
  expectedAnswer: "",
  maxScore: "5",
  criteria: "",
  commonMistakes: "",
});

const inputClass = "app-input w-full rounded-xl border border-[#8496b02e] bg-[#0B1829] px-4 py-3 text-sm text-[#F8FAFC]";
const textareaClass = "app-textarea min-h-[96px] w-full resize-y rounded-xl border border-[#8496b02e] bg-[#0B1829] px-4 py-3 text-sm leading-6 text-[#E2EAF4]";
const panelClass = "rounded-2xl border border-[#8496b01f] bg-[#132338] p-5 shadow-[0_18px_48px_rgba(0,0,0,.12)] sm:p-6";

export default function ClassPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const confirm = useConfirm();
  const { notify } = useToast();
  const [data, setData] = useState<Classroom | null>(null);
  const [studentName, setStudentName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [generalRules, setGeneralRules] = useState("");
  const [questions, setQuestions] = useState<QuestionDraft[]>([newQuestion()]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [addingStudent, setAddingStudent] = useState(false);
  const [creatingAssignment, setCreatingAssignment] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  async function load() {
    try {
      if (!data) setLoading(true);
      const [classroom, settings] = await Promise.all([
        api<Classroom>(`/classes/${id}`),
        api<TeacherSettings>("/settings"),
      ]);
      setData(classroom);
      setGeneralRules((current) => current || settings.default_grading_rules);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load class";
      setError(message);
      notify(message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function addStudent(event: FormEvent) {
    event.preventDefault();
    setError("");
    setAddingStudent(true);
    try {
      await api(`/classes/${id}/students`, { method: "POST", body: JSON.stringify({ name: studentName }) });
      setStudentName("");
      notify("Student added", "success");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not add student";
      setError(message);
      notify(message, "error");
    } finally {
      setAddingStudent(false);
    }
  }

  async function addAssignment(event: FormEvent) {
    event.preventDefault();
    setError("");
    setCreatingAssignment(true);
    try {
      const cleanedQuestions = questions.map((question, index) => ({
        ...question,
        number: question.number.trim() || String(index + 1),
        maxScore: question.maxScore || "0",
      }));
      const totalPoints = cleanedQuestions.reduce((sum, question) => sum + Number(question.maxScore || 0), 0);
      const answerKey = {
        questions: cleanedQuestions.map((question) => ({
          number: question.number,
          prompt: question.prompt,
          expected_answer: question.expectedAnswer,
          max_score: Number(question.maxScore || 0),
          acceptable_alternates: [],
        })),
      };
      const rubric = {
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
      };
      await api(`/classes/${id}/assignments`, {
        method: "POST",
        body: JSON.stringify({ title, description: description || null, total_points: totalPoints, answer_key: answerKey, rubric, status: "draft" }),
      });
      setTitle("");
      setDescription("");
      setQuestions([newQuestion()]);
      notify("Draft assignment created", "success");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not create assignment";
      setError(message);
      notify(message, "error");
    } finally {
      setCreatingAssignment(false);
    }
  }

  function updateQuestion(index: number, changes: Partial<QuestionDraft>) {
    setQuestions((current) => current.map((question, questionIndex) => questionIndex === index ? { ...question, ...changes } : question));
  }

  function addQuestion() {
    setQuestions((current) => [...current, newQuestion(String(current.length + 1))]);
  }

  function removeQuestion(index: number) {
    setQuestions((current) => current.length === 1 ? current : current.filter((_, questionIndex) => questionIndex !== index));
  }

  function updateTotalPoints(value: string) {
    if (questions.length !== 1) return;
    updateQuestion(0, { maxScore: value });
  }

  async function deleteClass() {
    if (!data) return;
    const confirmed = await confirm({
      title: `Delete ${data.name}?`,
      message: "This removes the class, students, assignments, submissions, grading results, and uploaded files.",
      confirmLabel: "Delete class",
    });
    if (!confirmed) return;
    setError("");
    setActionId("delete-class");
    try {
      await api<void>(`/classes/${id}`, { method: "DELETE" });
      notify("Class deleted", "success");
      router.push("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not delete class";
      setError(message);
      notify(message, "error");
    } finally {
      setActionId(null);
    }
  }

  async function deleteAssignment(assignmentId: string, assignmentTitle: string) {
    const confirmed = await confirm({
      title: `Delete ${assignmentTitle}?`,
      message: "This removes the assignment, all linked submissions, grading results, and uploaded files.",
      confirmLabel: "Delete assignment",
    });
    if (!confirmed) return;
    setError("");
    setActionId(`delete-assignment-${assignmentId}`);
    try {
      await api<void>(`/assignments/${assignmentId}`, { method: "DELETE" });
      notify("Assignment deleted", "success");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not delete assignment";
      setError(message);
      notify(message, "error");
    } finally {
      setActionId(null);
    }
  }

  async function deleteStudent(studentId: string, name: string) {
    const confirmed = await confirm({
      title: `Delete ${name}?`,
      message: "Existing submissions will stay in the assignment history, but they will no longer be attached to this student.",
      confirmLabel: "Delete student",
    });
    if (!confirmed) return;
    setError("");
    setActionId(`delete-student-${studentId}`);
    try {
      await api<void>(`/classes/${id}/students/${studentId}`, { method: "DELETE" });
      notify("Student deleted", "success");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not delete student";
      setError(message);
      notify(message, "error");
    } finally {
      setActionId(null);
    }
  }

  async function copyResultsLink(token?: string) {
    if (!token) return;
    setActionId(`copy-${token}`);
    const url = `${window.location.origin}/results/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      notify("Student results link copied", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not copy link";
      notify(message, "error");
    } finally {
      setActionId(null);
    }
  }

  const totalPoints = questions.reduce((sum, question) => sum + Number(question.maxScore || 0), 0);
  const totalPointsValue = questions.length === 1 ? questions[0]?.maxScore ?? "" : String(totalPoints);

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
          <div className="flex flex-wrap gap-3">
            <MetricMini value={data?.students?.length ?? 0} label="Students" />
            <MetricMini value={data?.assignments?.length ?? 0} label="Assignments" />
            {data && (
              <button
                className="app-btn app-btn-danger app-btn-lg"
                disabled={actionId === "delete-class"}
                onClick={deleteClass}
                type="button"
              >
                {actionId === "delete-class" ? "Deleting..." : "Delete class"}
              </button>
            )}
          </div>
        </div>

        {error && <div className="mt-6 rounded-xl border border-[#f8717159] bg-[#f8717112] px-4 py-3 text-sm text-[#FCA5A5]">{error}</div>}

        {loading && !data ? (
          <PageLoading title="Loading class" detail="Fetching assignments, roster, and grading defaults." />
        ) : (
        <div className="mt-6 space-y-6">
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
                  <div
                    key={assignment.id}
                    className="group flex items-center justify-between gap-4 rounded-xl border border-[#8496b01f] bg-[#0B1829] p-4 transition hover:border-[#00c9a759]"
                  >
                    <Link href={`/assignments/${assignment.id}`} className="min-w-0 flex-1">
                      <strong className="font-display font-semibold transition hover:text-[#00C9A7]">{assignment.title}</strong>
                      <div className="mt-1 text-xs text-[#8496B0]">{assignment.total_points} points</div>
                    </Link>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-[#00c9a714] px-2.5 py-1 text-[11px] font-semibold capitalize text-[#00C9A7]">{assignment.status}</span>
                      <button
                        className="app-btn app-btn-danger app-btn-sm"
                        disabled={actionId === `delete-assignment-${assignment.id}`}
                        onClick={() => deleteAssignment(assignment.id, assignment.title)}
                        type="button"
                      >
                        {actionId === `delete-assignment-${assignment.id}` ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                ))}
                {loading ? <InlineLoading rows={2} /> : !data?.assignments?.length && <EmptyState icon="📝" title="No assignments yet" text="Use the form below to create your first answer key and rubric." />}
              </div>
            </div>

            <form className={panelClass} onSubmit={addAssignment}>
              <div className="mb-6">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#00C9A7]">New grading workflow</div>
                <h2 className="font-display text-2xl font-semibold">Create assignment</h2>
                <p className="mt-1 text-sm text-[#8496B0]">Paste the assignment instructions, question, full solution, rubric, and likely mistakes in plain language.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">Title</span>
                  <input className={inputClass} required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Linear equations quiz" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">Total points</span>
                  <input
                    className={inputClass}
                    min="0.5"
                    onChange={(event) => updateTotalPoints(event.target.value)}
                    readOnly={questions.length !== 1}
                    step="0.5"
                    type="number"
                    value={totalPointsValue}
                  />
                  <p className="mt-2 text-xs leading-5 text-[#8496B0]">
                    {questions.length === 1 ? "This updates Question 1 points." : "Calculated from the question point values below."}
                  </p>
                </label>
              </div>
              <label className="mt-4 block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">Description / student instructions</span>
                <textarea className={textareaClass} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Example: Show all setup, derivatives, critical point work, units, and minimum verification." />
              </label>
              <label className="mt-4 block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">General grading rules</span>
                <textarea className={textareaClass} value={generalRules} onChange={(event) => setGeneralRules(event.target.value)} />
              </label>

              <div className="mt-5 space-y-4">
                {questions.map((question, index) => (
                  <div className="rounded-xl border border-[#8496b01f] bg-[#0B1829] p-4" key={index}>
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h3 className="font-display font-semibold">Question {index + 1}</h3>
                      <button className="app-btn app-btn-danger app-btn-sm" onClick={() => removeQuestion(index)} type="button">Remove</button>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-[100px_1fr_140px]">
                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">No.</span>
                        <input className={inputClass} required value={question.number} onChange={(event) => updateQuestion(index, { number: event.target.value })} />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">Question prompt</span>
                        <textarea className={textareaClass} required value={question.prompt} onChange={(event) => updateQuestion(index, { prompt: event.target.value })} placeholder="Paste the full question students will answer." />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">Points</span>
                        <input className={inputClass} min="1" required type="number" value={question.maxScore} onChange={(event) => updateQuestion(index, { maxScore: event.target.value })} />
                      </label>
                    </div>
                    <div className="mt-4 grid gap-4 xl:grid-cols-3">
                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">Solution / expected answer</span>
                        <textarea className={textareaClass} required value={question.expectedAnswer} onChange={(event) => updateQuestion(index, { expectedAnswer: event.target.value })} placeholder="Paste the correct solution steps and final answer." />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">Rubric / scoring criteria</span>
                        <textarea className={textareaClass} value={question.criteria} onChange={(event) => updateQuestion(index, { criteria: event.target.value })} placeholder="One rubric item per line, with points if helpful." />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">Common mistakes</span>
                        <textarea className={textareaClass} value={question.commonMistakes} onChange={(event) => updateQuestion(index, { commonMistakes: event.target.value })} placeholder="One likely mistake per line" />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <button className="app-btn app-btn-secondary app-btn-lg" onClick={addQuestion} type="button">Add question</button>
                <button className="app-btn app-btn-primary app-btn-lg" disabled={creatingAssignment}>{creatingAssignment ? "Creating..." : "Create draft assignment"}</button>
              </div>
            </form>
          <section className="grid items-start gap-6 lg:grid-cols-[minmax(320px,0.72fr)_minmax(0,1fr)]">
            <form className={panelClass} onSubmit={addStudent}>
              <div className="mb-5 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#00c9a714]">＋</div>
                <div><h2 className="font-display text-xl font-semibold">Add student</h2><p className="text-xs text-[#8496B0]">Build the class roster.</p></div>
              </div>
              <input className={inputClass} required value={studentName} onChange={(event) => setStudentName(event.target.value)} placeholder="Student name" />
              <button className="app-btn app-btn-secondary app-btn-full app-btn-lg mt-4" disabled={addingStudent}>{addingStudent ? "Adding..." : "Add student"}</button>
            </form>

            <div className={panelClass}>
              <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-xl font-semibold">Students</h2><span className="font-mono text-xs text-[#8496B0]">{data?.students?.length ?? 0}</span></div>
              <div className="space-y-2">
                {data?.students?.map((student, index) => (
                  <div className="flex items-center gap-3 rounded-xl border border-[#8496b01a] bg-[#0B1829] px-3 py-3" key={student.id}>
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-[#00c9a714] font-mono text-[11px] text-[#00C9A7]">{String(index + 1).padStart(2, "0")}</div>
                    <Link className="flex-1 text-sm text-[#E2EAF4] transition hover:text-[#00C9A7]" href={`/classes/${id}/students/${student.id}`}>{student.name}</Link>
                    <button
                      className="app-btn app-btn-ghost app-btn-sm"
                      disabled={actionId === `copy-${student.portal_token}`}
                      onClick={() => copyResultsLink(student.portal_token)}
                      type="button"
                    >
                      {actionId === `copy-${student.portal_token}` ? "Copying..." : "Link"}
                    </button>
                    <button
                      className="app-btn app-btn-danger app-btn-sm"
                      disabled={actionId === `delete-student-${student.id}`}
                      onClick={() => deleteStudent(student.id, student.name)}
                      type="button"
                    >
                      {actionId === `delete-student-${student.id}` ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                ))}
                {loading ? <InlineLoading rows={3} /> : !data?.students?.length && <p className="text-sm text-[#8496B0]">No students yet.</p>}
              </div>
            </div>
          </section>
        </div>
        )}
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
