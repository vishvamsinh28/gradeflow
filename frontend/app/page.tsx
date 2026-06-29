"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthModal } from "@/components/AuthModal";
import { api } from "@/lib/api";

type AuthMode = "login" | "register";

const primaryButton = "app-btn app-btn-primary app-btn-lg";
const ghostButton = "app-btn app-btn-ghost app-btn-lg";

const gradeRows = [
  { name: "Anika Patel", score: "9.5", grade: "A", tone: "grade-a", note: "Strong process", confidence: "96%" },
  { name: "Marcus Tan", score: "6.0", grade: "C", tone: "grade-c", note: "Review flagged", confidence: "61%" },
  { name: "Priya Nair", score: "10", grade: "A", tone: "grade-a", note: "Ready to return", confidence: "99%" },
  { name: "Owen Brooks", score: "7.5", grade: "B", tone: "grade-b", note: "Partial credit", confidence: "88%" },
];

export default function Home() {
  const router = useRouter();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("register");

  useEffect(() => {
    let mounted = true;
    api("/auth/me")
      .then(() => {
        if (mounted) router.replace("/dashboard");
      })
      .catch(() => {
        // Stay on the public page when there is no valid session.
      });
    return () => {
      mounted = false;
    };
  }, [router]);

  const closeAuth = useCallback(() => setAuthOpen(false), []);

  function openAuth(mode: AuthMode) {
    setAuthMode(mode);
    setAuthOpen(true);
  }

  return (
    <main className="gradeflow-landing min-h-screen bg-[#091421] text-[#F8FAFC]">
      <nav className="fixed inset-x-0 top-0 z-[100] border-b border-white/10 bg-[#091421d9] backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-[min(1200px,92vw)] items-center justify-between gap-4">
          <a href="#top" className="font-display text-xl font-bold tracking-[-0.5px]">
            Grade<span className="text-[#00C9A7]">Flow</span>
          </a>
          <ul className="hidden list-none items-center gap-7 md:flex">
            <li><a className="text-sm text-[#A8B7C9] transition hover:text-white" href="#workflow">Workflow</a></li>
            <li><a className="text-sm text-[#A8B7C9] transition hover:text-white" href="#features">Features</a></li>
            <li><a className="text-sm text-[#A8B7C9] transition hover:text-white" href="#proof">Product</a></li>
            <li><button className="text-sm text-[#A8B7C9] transition hover:text-white" onClick={() => openAuth("login")}>Sign in</button></li>
          </ul>
          <button onClick={() => openAuth("register")} className="app-btn app-btn-primary">
            Start grading
          </button>
        </div>
      </nav>

      <section id="top" className="relative isolate flex min-h-[92svh] items-center overflow-hidden px-[4vw] pb-16 pt-28">
        <ProductBackdrop />
        <div className="relative z-10 mx-auto grid w-[min(1200px,92vw)] items-end gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="landing-reveal pb-6">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#00c9a740] bg-[#00c9a710] px-3.5 py-1 text-[13px] font-semibold text-[#72F1DA]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#72F1DA] shadow-[0_0_18px_rgba(114,241,218,.9)]" />
              AI grading, review, and result release in one workspace
            </div>
            <h1 className="font-display text-[clamp(58px,9vw,120px)] font-bold leading-[0.88] tracking-[-4px] text-white">
              GradeFlow
            </h1>
            <p className="mt-7 max-w-[620px] text-[clamp(18px,2vw,22px)] leading-[1.55] text-[#C5D1DF]">
              Turn worksheet piles into scored submissions, review queues, class insights, returned student results, and an auditable grading history.
            </p>
            <div className="mt-9 flex flex-wrap gap-3.5">
              <button className={primaryButton} onClick={() => openAuth("register")}>Create workspace</button>
              <a className={ghostButton} href="#workflow">See workflow</a>
            </div>
            <div className="mt-9 grid max-w-[620px] grid-cols-3 gap-3">
              <HeroMetric value="47s" label="demo batch" />
              <HeroMetric value="3" label="review flags" tone="amber" />
              <HeroMetric value="7d" label="secure session" tone="violet" />
            </div>
          </div>

          <div className="landing-product-shell">
            <ProductWorkspace />
          </div>
        </div>
      </section>

      <section id="workflow" className="border-y border-white/10 bg-[#101C2C] px-[4vw] py-24">
        <div className="mx-auto w-[min(1200px,92vw)]">
          <SectionHeading eyebrow="Workflow" title="From upload to returned results" text="GradeFlow now supports the full teacher loop: create, grade, review, edit rubrics, regrade, return, and audit." />
          <div className="mt-12 grid gap-3 lg:grid-cols-5">
            <WorkflowStep number="01" title="Build the rubric" text="Create question-level answer keys and grading rules without raw JSON." />
            <WorkflowStep number="02" title="Batch upload" text="Upload images or PDFs and assign by student name as you go." />
            <WorkflowStep number="03" title="Review exceptions" text="Low-confidence work lands in a dedicated teacher review queue." />
            <WorkflowStep number="04" title="Regrade safely" text="Version rubric edits, regrade all submissions, and keep an audit trail." />
            <WorkflowStep number="05" title="Return results" text="Release completed grades to each student's secure results link." />
          </div>
        </div>
      </section>

      <section id="features" className="px-[4vw] py-24">
        <div className="mx-auto w-[min(1200px,92vw)]">
          <SectionHeading eyebrow="Product features" title="Built like an actual grading system" text="The app now has the operational pieces teachers expect before trusting AI with classroom work." />
          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <FeatureCard title="Teacher settings" stat="Model + defaults" tone="cyan">
              Configure the Gemini model, confidence threshold, default subject, grade level, and grading rules from one settings page.
            </FeatureCard>
            <FeatureCard title="Review center" stat="Cross-class queue" tone="amber">
              See every low-confidence submission across classes, approve obvious cases, or open deep evidence review.
            </FeatureCard>
            <FeatureCard title="Rubric versions" stat="Change history" tone="violet">
              Every assignment edit can create a saved version with a change note and audit event.
            </FeatureCard>
            <FeatureCard title="Regrade all" stat="After edits" tone="blue">
              Apply a revised answer key or rubric to existing submissions without manually opening each student.
            </FeatureCard>
            <FeatureCard title="Student results portal" stat="Returned only" tone="green">
              Copy a per-student results link. Students only see assignments the teacher has marked returned.
            </FeatureCard>
            <FeatureCard title="Audit logging" stat="Traceable actions" tone="red">
              Track settings changes, grading runs, approvals, overrides, deletes, returns, and regrades.
            </FeatureCard>
          </div>
        </div>
      </section>

      <section id="proof" className="bg-[#101C2C] px-[4vw] py-24">
        <div className="mx-auto grid w-[min(1200px,92vw)] items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <SectionHeading eyebrow="Grade intelligence" title="Linear grade colors for fast scanning" text="Scores read like a real gradebook: strong work, borderline answers, review flags, and released results are visually distinct without hiding the detail." />
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <GradeLegend label="A range" color="grade-a" />
              <GradeLegend label="B range" color="grade-b" />
              <GradeLegend label="C range" color="grade-c" />
              <GradeLegend label="Needs review" color="grade-r" />
            </div>
          </div>
          <div className="landing-panel p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#72F1DA]">Returned packet</div>
                <h3 className="font-display text-2xl font-semibold">Fractions Unit Test</h3>
              </div>
              <span className="rounded-full border border-[#00c9a740] bg-[#00c9a712] px-3 py-1 text-xs text-[#72F1DA]">Returned</span>
            </div>
            <div className="space-y-3">
              {gradeRows.map((row) => (
                <div className="grid grid-cols-[1fr_auto] gap-3 rounded-xl border border-white/10 bg-[#091421] p-4" key={row.name}>
                  <div>
                    <div className="font-display font-semibold">{row.name}</div>
                    <div className="mt-1 text-xs text-[#A8B7C9]">{row.note} · {row.confidence} confidence</div>
                  </div>
                  <div className={`grade-chip ${row.tone}`}>
                    <span>{row.grade}</span>
                    <strong>{row.score}/10</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="cta" className="px-[4vw] py-24 text-center">
        <div className="mx-auto max-w-[760px]">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#72F1DA]">Ready for a real workflow</div>
          <h2 className="mt-4 font-display text-[clamp(34px,5vw,64px)] font-bold leading-[1.02] tracking-[-2px]">Grade, review, return, and improve from one place.</h2>
          <p className="mx-auto mt-5 max-w-[560px] text-lg leading-8 text-[#A8B7C9]">Create a class, add a rubric, upload work, and let GradeFlow route the parts that need judgment.</p>
          <div className="mt-9 flex flex-wrap justify-center gap-3.5">
            <button className={primaryButton} onClick={() => openAuth("register")}>Start now</button>
            <button className={ghostButton} onClick={() => openAuth("login")}>Sign in</button>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-[4vw] py-8">
        <div className="mx-auto flex w-[min(1200px,92vw)] flex-wrap items-center justify-between gap-3 text-sm text-[#A8B7C9]">
          <div className="font-display text-base font-bold">Grade<span className="text-[#00C9A7]">Flow</span></div>
          <div>AI grading workspace with review, audit, and returned results.</div>
        </div>
      </footer>

      <AuthModal open={authOpen} initialMode={authMode} onClose={closeAuth} />
    </main>
  );
}

function ProductBackdrop() {
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <div className="landing-grid absolute inset-0 opacity-70" />
      <div className="absolute left-[-10%] top-[18%] h-[44rem] w-[44rem] rounded-full bg-[#00C9A7]/10 blur-3xl" />
      <div className="absolute right-[-8%] top-[8%] h-[34rem] w-[34rem] rounded-full bg-[#7C5CFF]/12 blur-3xl" />
      <div className="absolute bottom-[-18%] left-[32%] h-[30rem] w-[30rem] rounded-full bg-[#F59E0B]/10 blur-3xl" />
    </div>
  );
}

function ProductWorkspace() {
  return (
    <div className="landing-panel landing-float p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#72F1DA]">Assignment workspace</div>
          <div className="font-display text-xl font-semibold">Period 3 · Fractions Unit</div>
        </div>
        <div className="flex gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#4ADE80]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#F87171]" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-3">
          {gradeRows.map((row, index) => (
            <div className="landing-row" style={{ animationDelay: `${index * 120}ms` }} key={row.name}>
              <div className={`grade-line ${row.tone}`} />
              <div className="min-w-0">
                <div className="truncate font-display text-sm font-semibold">{row.name}</div>
                <div className="mt-1 text-xs text-[#A8B7C9]">{row.note}</div>
              </div>
              <div className={`grade-chip ${row.tone}`}>
                <span>{row.grade}</span>
                <strong>{row.score}</strong>
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <MiniPanel title="Review queue" value="3" text="Flagged for teacher judgment" tone="amber" />
          <MiniPanel title="Rubric version" value="v4" text="Updated partial-credit rule" tone="violet" />
          <MiniPanel title="Returned links" value="28" text="Student portals ready" tone="green" />
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-white/10 bg-[#101C2C] p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#A8B7C9]">Question insights</span>
          <span className="text-xs text-[#F59E0B]">common error detected</span>
        </div>
        <div className="space-y-2">
          <InsightBar label="LCD setup" width="86%" tone="green" />
          <InsightBar label="Numerator addition" width="44%" tone="amber" />
          <InsightBar label="Simplification" width="72%" tone="blue" />
        </div>
      </div>
    </div>
  );
}

function HeroMetric({ value, label, tone = "green" }: { value: string; label: string; tone?: "green" | "amber" | "violet" }) {
  return (
    <div className={`landing-metric metric-${tone}`}>
      <div className="font-mono text-2xl">{value}</div>
      <div className="mt-1 text-[11px] uppercase tracking-[0.08em] text-[#A8B7C9]">{label}</div>
    </div>
  );
}

function MiniPanel({ title, value, text, tone }: { title: string; value: string; text: string; tone: "amber" | "violet" | "green" }) {
  return (
    <div className={`mini-panel mini-${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-[#A8B7C9]">{title}</div>
          <p className="mt-1 text-xs leading-5 text-[#DCE7F4]">{text}</p>
        </div>
        <div className="font-mono text-2xl">{value}</div>
      </div>
    </div>
  );
}

function InsightBar({ label, width, tone }: { label: string; width: string; tone: "green" | "amber" | "blue" }) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-center gap-3">
      <span className="text-xs text-[#A8B7C9]">{label}</span>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full insight-${tone}`} style={{ width }} />
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#72F1DA]">{eyebrow}</div>
      <h2 className="mt-3 max-w-[760px] font-display text-[clamp(34px,5vw,62px)] font-bold leading-[1.02] tracking-[-2px]">{title}</h2>
      <p className="mt-5 max-w-[680px] text-lg leading-8 text-[#A8B7C9]">{text}</p>
    </div>
  );
}

function WorkflowStep({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <article className="workflow-step">
      <div className="font-mono text-xs text-[#72F1DA]">{number}</div>
      <h3 className="mt-6 font-display text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#A8B7C9]">{text}</p>
    </article>
  );
}

function FeatureCard({ title, stat, tone, children }: { title: string; stat: string; tone: "cyan" | "amber" | "violet" | "blue" | "green" | "red"; children: React.ReactNode }) {
  return (
    <article className={`feature-card feature-${tone}`}>
      <div className="mb-7 flex items-center justify-between gap-4">
        <div className="feature-mark" />
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-[#C5D1DF]">{stat}</span>
      </div>
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-[#A8B7C9]">{children}</p>
    </article>
  );
}

function GradeLegend({ label, color }: { label: string; color: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#091421] p-4">
      <div className={`mb-3 h-2 rounded-full grade-gradient ${color}`} />
      <div className="font-display font-semibold">{label}</div>
    </div>
  );
}
