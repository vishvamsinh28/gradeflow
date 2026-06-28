"use client";

import { useCallback, useEffect, useState } from "react";
import { AuthModal } from "@/components/AuthModal";

type AuthMode = "login" | "register";

const primaryButton = "inline-flex items-center justify-center rounded-[10px] bg-[#00C9A7] px-8 py-3.5 font-display text-base font-bold text-[#0B1829] transition hover:-translate-y-0.5 hover:bg-[#00A88C]";
const ghostButton = "inline-flex items-center justify-center rounded-[10px] border border-[#8496b04d] bg-transparent px-7 py-3.5 font-display text-base font-medium text-[#E2EAF4] transition hover:border-[#8496B0] hover:bg-[#8496b00f]";

export default function Home() {
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("register");
  const [barsVisible, setBarsVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setBarsVisible(true), 450);
    return () => window.clearTimeout(timer);
  }, []);

  const closeAuth = useCallback(() => setAuthOpen(false), []);

  function openAuth(mode: AuthMode) {
    setAuthMode(mode);
    setAuthOpen(true);
  }

  return (
    <main className="bg-[#0B1829] text-[#F8FAFC]">
      <nav className="fixed inset-x-0 top-0 z-[100] flex h-[60px] items-center justify-between border-b border-[#8496b026] bg-[#0b1829d9] px-[6vw] backdrop-blur-xl">
        <a href="#top" className="font-display text-xl font-bold tracking-[-0.5px]">
          Grade<span className="text-[#00C9A7]">Flow</span>
        </a>
        <ul className="hidden list-none items-center gap-7 md:flex">
          <li><a className="text-sm text-[#8496B0] transition hover:text-[#F8FAFC]" href="#how">How it works</a></li>
          <li><a className="text-sm text-[#8496B0] transition hover:text-[#F8FAFC]" href="#features">Features</a></li>
          <li><a className="text-sm text-[#8496B0] transition hover:text-[#F8FAFC]" href="#testimonials">Reviews</a></li>
          <li><button className="text-sm text-[#8496B0] transition hover:text-[#F8FAFC]" onClick={() => openAuth("login")}>Sign in</button></li>
        </ul>
        <button
          onClick={() => openAuth("register")}
          className="rounded-lg bg-[#00C9A7] px-5 py-2 font-display text-sm font-semibold text-[#0B1829] transition hover:bg-[#00A88C]"
        >
          Start free trial
        </button>
      </nav>

      <section id="top" className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-[6vw] pb-[60px] pt-[100px] text-center">
        <div className="hero-glow pointer-events-none absolute inset-0" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#00c9a740] bg-[#00c9a71a] px-3.5 py-1 text-[13px] font-medium tracking-[0.02em] text-[#00C9A7]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00C9A7]" />
            AI-powered grading workspace
          </div>
          <h1 className="max-w-[900px] font-display text-[clamp(40px,6vw,72px)] font-bold leading-[1.1] tracking-[-2px] text-[#F8FAFC]">
            Grade 30 worksheets<br />in the time it takes<br />to grade <em className="not-italic text-[#00C9A7]">three</em>
          </h1>
          <p className="mx-auto mt-6 max-w-[580px] text-[clamp(16px,2vw,19px)] leading-[1.65] text-[#8496B0]">
            Upload any worksheet image or PDF. GradeFlow extracts student work, scores it against your answer key and rubric, and flags the ones that need your eye.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3.5">
            <button className={primaryButton} onClick={() => openAuth("register")}>Try GradeFlow free</button>
            <a className={ghostButton} href="#how">See how it works</a>
          </div>
        </div>

        <div className="relative z-10 mx-auto mt-[60px] w-full max-w-[780px]">
          <div className="rounded-2xl border border-[#8496b026] bg-[#132338] p-4 text-left sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
              <span className="font-display text-sm font-semibold text-[#E2EAF4]">Period 3 — Fractions Unit Test · 28 students</span>
              <span className="text-xs text-[#8496B0]">Graded in 47 sec · 3 flagged for review</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StudentPreview
                name="Anika P."
                problem={<>3/4 + 1/3 = 13/12 ✓<br />LCD = 12, correct</>}
                score="8"
                scoreTone="text-[#4ADE80]"
                confidence="94%"
                confidenceTone="bg-[#00C9A7]"
                tag="Strong process"
                barsVisible={barsVisible}
              />
              <StudentPreview
                name="Marcus T."
                problem={<>2/5 + 3/5 = 5/10 ?<br />Numerators added ✗</>}
                score="3"
                scoreTone="text-[#F87171]"
                confidence="61%"
                confidenceTone="bg-[#F59E0B]"
                tag="Needs attention"
                flagged
                barsVisible={barsVisible}
              />
              <StudentPreview
                name="Priya N."
                problem={<>5/6 − 1/4 = 7/12 ✓<br />LCD = 12, correct</>}
                score="10"
                scoreTone="text-[#4ADE80]"
                confidence="99%"
                confidenceTone="bg-[#00C9A7]"
                tag="Full marks"
                barsVisible={barsVisible}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <DemoStat value="82%" label="Class avg" tone="text-[#00C9A7]" />
              <DemoStat value="25" label="Auto-graded" />
              <DemoStat value="3" label="Needs review" tone="text-[#F59E0B]" />
              <DemoStat value="47s" label="Total time" />
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="bg-[#132338] px-[6vw] py-24">
        <SectionHeading eyebrow="How it works" title={<>From stack of papers<br />to graded class — fast</>} />
        <div className="mt-14 grid overflow-hidden rounded-2xl border border-[#8496b01a] bg-[#8496b01a] sm:grid-cols-2 xl:grid-cols-4">
          <Step number="01" icon="📤" title="Upload worksheets">Drag in a batch of scanned images or PDFs. GradeFlow handles handwriting, photos, and multi-page documents.</Step>
          <Step number="02" icon="🗝️" title="Set your answer key">Type in your answer key and rubric once. Award partial credit, define acceptable methods, or weight questions differently.</Step>
          <Step number="03" icon="⚡" title="AI extracts and scores">Every student&apos;s work is pulled out, matched against your rubric, and assigned a score with a confidence rating.</Step>
          <Step number="04" icon="🚩" title="Review flagged papers">Low-confidence grades surface for your eyes only. Approve, adjust, or override with one click — never lose control.</Step>
        </div>
      </section>

      <section id="features" className="px-[6vw] py-24">
        <SectionHeading eyebrow="Features" title={<>Everything a grading<br />workflow needs</>} />
        <div className="mt-14 grid gap-6 md:grid-cols-2">
          <Feature icon="🧠" title="Handwriting recognition" accent>
            Reads messy student handwriting, crossed-out answers, and margin work across classroom subjects — not just typed text.
          </Feature>
          <Feature icon="📐" title="Flexible rubrics" iconTone="amber">
            Full credit, partial credit, method-based scoring. Copy a rubric across assignments or tweak each question in seconds.
          </Feature>
          <Feature icon="💬" title="Per-student feedback">
            Auto-generated feedback based on each student&apos;s specific errors — ready to paste into your LMS or print.
          </Feature>
          <Feature icon="🚩" title="Confidence flagging" iconTone="amber" accent>
            Every score has a confidence rating. Anything below your threshold lands in a review queue — you decide the bar.
          </Feature>
          <div className="rounded-[14px] border border-[#8496b01f] bg-[#132338] p-7 md:col-span-2">
            <div className="grid items-center gap-8 md:grid-cols-2">
              <div>
                <div className="mb-4 grid h-10 w-10 place-items-center rounded-[10px] bg-[#00c9a71a] text-lg">📊</div>
                <h3 className="font-display text-lg font-semibold">Class-level analytics</h3>
                <p className="mt-2 text-sm leading-[1.65] text-[#8496B0]">
                  See which questions tripped up the most students, track score distributions, and spot learning gaps before they compound.
                </p>
              </div>
              <div>
                <AnalyticsBar label="Question 1" width="92%" value="92%" />
                <AnalyticsBar label="Question 2" width="78%" value="78%" />
                <AnalyticsBar label="Question 3" width="43%" value="43%" warning />
                <AnalyticsBar label="Question 4" width="89%" value="89%" />
                <AnalyticsBar label="Question 5" width="61%" value="61%" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="testimonials" className="bg-[#132338] px-[6vw] py-24">
        <SectionHeading eyebrow="Teacher reviews" title={<>Loved by teachers who<br />have better things to do</>} />
        <div className="mt-[52px] grid gap-5 md:grid-cols-3">
          <Quote initials="SR" name="Sarah R." role="Grade 6 Math · Chicago">
            I used to spend Sunday evenings grading. Now I upload the batch on Friday afternoon and it&apos;s done before I leave school.
          </Quote>
          <Quote initials="DK" name="David K." role="High School Algebra · Austin">
            The flagging system is what sold me. I still see every paper that needs judgment — I just don&apos;t wade through the obvious ones.
          </Quote>
          <Quote initials="ML" name="Maya L." role="Middle School Science · Seattle">
            Question-level analytics showed me that most of my class missed the same concept. I retaught it Monday and scores jumped.
          </Quote>
        </div>
      </section>

      <section id="cta" className="px-[6vw] pb-[120px] pt-24 text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.1em] text-[#00C9A7]">Get started</div>
        <h2 className="mx-auto mt-3.5 max-w-[640px] font-display text-[clamp(28px,4vw,46px)] font-bold leading-[1.15] tracking-[-1px]">Start grading smarter this week</h2>
        <p className="mx-auto mt-5 max-w-[500px] text-[17px] text-[#8496B0]">Create your workspace, add a class, and import your first student submission in minutes.</p>
        <div className="mt-10 flex flex-wrap justify-center gap-3.5">
          <button className={primaryButton} onClick={() => openAuth("register")}>Create a free account</button>
          <a className={ghostButton} href="#top">Watch the demo</a>
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#8496b01f] px-[6vw] py-7">
        <div className="font-display text-base font-bold text-[#8496B0]">Grade<span className="text-[#00C9A7]">Flow</span></div>
        <div className="text-[13px] text-[#8496b080]">Built for teachers, not admins.</div>
      </footer>

      <AuthModal open={authOpen} initialMode={authMode} onClose={closeAuth} />
    </main>
  );
}

function StudentPreview({
  name,
  problem,
  score,
  scoreTone,
  confidence,
  confidenceTone,
  tag,
  flagged = false,
  barsVisible,
}: {
  name: string;
  problem: React.ReactNode;
  score: string;
  scoreTone: string;
  confidence: string;
  confidenceTone: string;
  tag: string;
  flagged?: boolean;
  barsVisible: boolean;
}) {
  return (
    <article className={`relative rounded-[10px] border p-3.5 ${flagged ? "border-[#f59e0b66] bg-[#f59e0b0a]" : "border-[#8496b01f] bg-[#1E344F]"}`}>
      {flagged && <span className="absolute right-2.5 top-2.5 rounded border border-[#f59e0b40] bg-[#f59e0b1a] px-1.5 py-0.5 text-[10px] text-[#F59E0B]">⚑ Review</span>}
      <div className="mb-1.5 text-xs text-[#8496B0]">{name}</div>
      <div className="mb-2.5 font-mono text-[11px] leading-6 text-[#f8fafc80]">{problem}</div>
      <div className="flex items-center gap-2"><span className={`font-mono text-xl font-medium ${scoreTone}`}>{score}</span><span className="text-xs text-[#8496B0]">/ 10</span></div>
      <div className="mt-2 h-[3px] overflow-hidden rounded-sm bg-[#8496b026]">
        <div className={`confidence-fill h-full rounded-sm ${confidenceTone}`} style={{ width: barsVisible ? confidence : 0 }} />
      </div>
      <span className={`mt-2 inline-block rounded border px-2 py-0.5 text-[10px] ${flagged ? "border-[#f59e0b40] bg-[#f59e0b1a] text-[#F59E0B]" : "border-[#00c9a733] bg-[#00c9a71a] text-[#00C9A7]"}`}>{tag}</span>
    </article>
  );
}

function DemoStat({ value, label, tone = "text-[#F8FAFC]" }: { value: string; label: string; tone?: string }) {
  return <div className="rounded-lg border border-[#8496b01a] bg-[#1E344F] px-3.5 py-3 text-center"><div className={`font-mono text-[22px] font-medium ${tone}`}>{value}</div><div className="mt-0.5 text-[11px] text-[#8496B0]">{label}</div></div>;
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: React.ReactNode }) {
  return <><div className="mb-3.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#00C9A7]">{eyebrow}</div><h2 className="font-display text-[clamp(28px,4vw,46px)] font-bold leading-[1.15] tracking-[-1px]">{title}</h2></>;
}

function Step({ number, icon, title, children }: { number: string; icon: string; title: string; children: React.ReactNode }) {
  return <article className="bg-[#132338] p-7 xl:p-8"><div className="mb-4 font-mono text-[11px] font-medium tracking-[0.05em] text-[#00C9A7]">{number}</div><div className="mb-4 grid h-11 w-11 place-items-center rounded-[10px] border border-[#00c9a733] bg-[#00c9a714] text-xl">{icon}</div><h3 className="font-display text-base font-semibold">{title}</h3><p className="mt-2 text-sm leading-[1.6] text-[#8496B0]">{children}</p></article>;
}

function Feature({ icon, title, children, accent = false, iconTone = "teal" }: { icon: string; title: string; children: React.ReactNode; accent?: boolean; iconTone?: "teal" | "amber" }) {
  return <article className={`rounded-[14px] border p-7 ${accent ? "border-[#00c9a740] bg-[#00c9a70a]" : "border-[#8496b01f] bg-[#132338]"}`}><div className={`mb-4 grid h-10 w-10 place-items-center rounded-[10px] text-lg ${iconTone === "amber" ? "bg-[#f59e0b1a]" : "bg-[#00c9a71a]"}`}>{icon}</div><h3 className="font-display text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-[1.65] text-[#8496B0]">{children}</p></article>;
}

function AnalyticsBar({ label, width, value, warning = false }: { label: string; width: string; value: string; warning?: boolean }) {
  return <div className="mb-2.5 flex items-center gap-2.5"><span className="w-20 shrink-0 text-xs text-[#8496B0]">{label}</span><div className="h-2 flex-1 overflow-hidden rounded bg-[#8496b01f]"><div className={`h-full rounded ${warning ? "bg-[#F59E0B]" : "bg-[#00C9A7]"}`} style={{ width }} /></div><span className={`w-9 text-right font-mono text-[11px] ${warning ? "text-[#F59E0B]" : "text-[#8496B0]"}`}>{value}</span></div>;
}

function Quote({ initials, name, role, children }: { initials: string; name: string; role: string; children: React.ReactNode }) {
  return <article className="rounded-[14px] border border-[#8496b01f] bg-[#1E344F] p-7"><p className="text-[15px] leading-[1.7] text-[#E2EAF4]"><span className="mr-1 align-[-12px] text-4xl leading-none text-[#00C9A7]">“</span>{children}</p><div className="mt-5 flex items-center gap-2.5"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#00c9a726] font-display text-[13px] font-semibold text-[#00C9A7]">{initials}</div><div><div className="text-sm font-medium">{name}</div><div className="text-xs text-[#8496B0]">{role}</div></div></div></article>;
}
