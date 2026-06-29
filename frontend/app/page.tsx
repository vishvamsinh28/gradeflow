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
          <button onClick={() => openAuth("register")} className="app-btn app-btn-primary landing-nav-cta">
            Start grading
          </button>
        </div>
      </nav>

      <section id="top" className="relative isolate flex min-h-svh items-center overflow-hidden px-[4vw] pb-10 pt-24 sm:pb-12 lg:pt-24">
        <ProductBackdrop />
        <div className="relative z-10 mx-auto grid w-[min(1200px,92vw)] items-center gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
          <div className="landing-reveal pb-6">
            <div className="landing-hero-pill mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#72F1DA] shadow-[0_0_18px_rgba(114,241,218,.9)]" />
              <span className="sm:hidden">AI grading workspace</span>
              <span className="hidden sm:inline">AI grading, review, and result release in one workspace</span>
            </div>
            <h1 className="landing-hero-title font-display">
              <span>Grade</span><span className="landing-title-accent">Flow</span>
              <span className="landing-title-line">AI grading workspace</span>
            </h1>
            <p className="landing-hero-copy mt-6">
              Turn worksheet piles into <strong>scored submissions</strong>, review queues, class insights, returned student results, and an auditable grading history.
            </p>
            <div className="landing-hero-actions mt-8">
              <button className={`${primaryButton} landing-primary-action`} onClick={() => openAuth("register")}>Create workspace</button>
              <a className={ghostButton} href="#workflow">See workflow</a>
              <span className="landing-action-note">Create a class, add a rubric, and review AI-scored work.</span>
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
    <div className="landing-flow-console landing-float">
      <div className="landing-console-header">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#72F1DA]">Live grading run</div>
          <div className="font-display text-xl font-semibold">Fractions Unit · Period 3</div>
        </div>
        <span className="landing-run-status">47s</span>
      </div>

      <div className="landing-flow-grid">
        <div className="landing-pipeline">
          {[
            ["01", "Upload", "28 pages"],
            ["02", "Extract", "answers mapped"],
            ["03", "Grade", "rubric applied"],
            ["04", "Review", "3 flags"],
            ["05", "Return", "student links"],
          ].map(([step, title, text]) => (
            <div className="landing-flow-node" key={step}>
              <span>{step}</span>
              <strong>{title}</strong>
              <small>{text}</small>
            </div>
          ))}
        </div>

        <div className="landing-grade-board">
          {gradeRows.slice(0, 3).map((row) => (
            <div className="landing-score-row" key={row.name}>
              <div>
                <strong>{row.name}</strong>
                <span>{row.note}</span>
              </div>
              <b className={row.tone}>{row.score}</b>
            </div>
          ))}
        </div>
      </div>

      <div className="landing-console-footer">
        <div>
          <span>Review queue</span>
          <strong>3 submissions need teacher judgment</strong>
        </div>
        <button type="button">Open queue</button>
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
