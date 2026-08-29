"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Segmented, cx } from "@/components/ui/primitives";
import { IconArrowRight, Logo } from "@/components/ui/icons";
import { NightField } from "@/components/auth/night-panel";
import { LiveExtraction, LiveGrading, LiveMatching } from "@/components/landing/animated";
import {
  AppFrame,
  ClassroomMock,
  MarksMock,
  StudentsMock,
  UploadMock,
} from "@/components/landing/mockups";

export default function LandingPage() {
  useReveal();

  return (
    <div className="min-h-svh bg-paper">
      <SiteNav />
      <main>
        <Hero />
        <Bento />
        <Workspace />
        <Steps />
        <Closing />
      </main>
      <SiteFooter />
    </div>
  );
}

/* ---------- Nav ----------
   Sits transparent over the dark hero, then turns solid once past it. */

function SiteNav() {
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 72);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cx(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        solid ? "border-b border-line bg-paper/90 backdrop-blur-md" : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center px-5 sm:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Logo size={22} />
          <span
            className={cx(
              "text-[15.5px] font-semibold tracking-[-0.03em] transition-colors",
              solid ? "text-ink" : "text-white",
            )}
          >
            GradeFlow
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-1.5">
          <Link href="/signin" className="hidden sm:block">
            <Button
              size="sm"
              variant={solid ? "ghost" : "onDarkOutline"}
              className={solid ? "" : "border-transparent text-white/80 hover:text-white"}
            >
              Sign in
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm" variant={solid ? "primary" : "onDark"}>
              Get started
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ---------- Hero ---------- */

function Hero() {
  return (
    <section className="relative flex min-h-svh items-center overflow-hidden px-5 py-28 sm:px-8 sm:py-32">
      <NightField />

      <div className="relative mx-auto w-full max-w-[1120px] text-center">
        <h1 className="anim-fade-up font-display text-[clamp(44px,9vw,96px)] text-white">
          Grade every paper.
          <br />
          <span className="text-white/45">In minutes, not evenings.</span>
        </h1>

        <p
          style={{ animationDelay: "120ms" }}
          className="anim-fade-up mx-auto mt-8 max-w-[58ch] text-[15.5px] leading-[1.65] text-white/60 sm:text-[17px]"
        >
          Upload the answer sheets. GradeFlow reads every handwriting style, marks each answer
          against your notes, and flags anything it is unsure about
          <span className="text-white/85"> for you to check before results go out.</span>
        </p>

        <div
          style={{ animationDelay: "200ms" }}
          className="anim-fade-up mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          <Link href="/signup">
            <Button size="lg" variant="onDark" icon={<IconArrowRight size={16} />}>
              Start grading free
            </Button>
          </Link>
          <a href="#workspace">
            <Button size="lg" variant="onDarkOutline">
              See it work
            </Button>
          </a>
        </div>

        <p
          style={{ animationDelay: "260ms" }}
          className="anim-fade-up mt-6 text-[13px] text-white/40"
        >
          No rubrics to build. No settings to tune. Photos, scans and PDFs all work.
        </p>
      </div>
    </section>
  );
}

/* ---------- Bento ---------- */

function Bento() {
  return (
    <section className="px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto w-full max-w-[1120px]">
        <h2
          data-reveal
          className="reveal max-w-[16ch] font-display text-[clamp(30px,5vw,52px)] text-ink"
        >
          The marking, done for you.
        </h2>
        <p
          data-reveal
          style={{ transitionDelay: "60ms" }}
          className="reveal mt-4 max-w-[52ch] text-[15px] leading-relaxed text-ink-2"
        >
          Four things have to go right between a stack of paper and a marks table. GradeFlow does
          all four.
        </p>

        <div className="mt-10 grid gap-4 lg:grid-cols-5">
          <BentoCard
            className="lg:col-span-3"
            delay={0}
            kicker="Handwriting"
            title="Reads what the student actually wrote"
            body="Any hand, any layout — working, diagrams, equations. Nothing is retyped and nothing is guessed at silently."
            visual={<LiveExtraction />}
          />
          <BentoCard
            className="lg:col-span-2"
            delay={80}
            kicker="Matching"
            title="Knows whose sheet is whose"
            body="By ID, roll number, name, or read straight off the page. You confirm before anything is graded."
            visual={<LiveMatching />}
          />
          <BentoCard
            className="lg:col-span-2"
            delay={0}
            kicker="Your judgement"
            title="Marks the way you mark"
            body="One sentence of guidance is the whole configuration. No rubric builder, no answer keys."
            visual={
              <div className="space-y-2">
                {[
                  "Give method marks when the arithmetic slips.",
                  "Be strict about units.",
                  "Reward structure over spelling.",
                ].map((note) => (
                  <p
                    key={note}
                    className="rounded-md border border-accent-line bg-accent-soft px-2.5 py-1.5 text-[12px] leading-snug text-accent"
                  >
                    “{note}”
                  </p>
                ))}
              </div>
            }
          />
          <BentoCard
            className="lg:col-span-3"
            delay={80}
            kicker="In the open"
            title="Shows its working, one student at a time"
            body="Watch the batch go through. Anything the model is unsure about is flagged for you rather than quietly averaged away."
            visual={<LiveGrading on="panel" />}
          />
        </div>
      </div>
    </section>
  );
}

function BentoCard({
  kicker,
  title,
  body,
  visual,
  className,
  delay,
}: {
  kicker: string;
  title: string;
  body: string;
  visual: React.ReactNode;
  className?: string;
  delay: number;
}) {
  return (
    <div
      data-reveal
      style={{ transitionDelay: `${delay}ms` }}
      className={cx(
        "reveal flex flex-col rounded-2xl border border-line bg-surface p-6",
        className,
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-accent">{kicker}</p>
      <h3 className="mt-2.5 font-display text-[26px] text-ink sm:text-[30px]">{title}</h3>
      <p className="mt-2.5 max-w-[46ch] text-[13.5px] leading-[1.6] text-ink-2">{body}</p>
      <div className="mt-auto pt-6">{visual}</div>
    </div>
  );
}

/* ---------- Workspace showcase ---------- */

type Surface = "classroom" | "students" | "upload" | "marks";

const SURFACES: Record<Surface, { label: string; frame: string; body: React.ReactNode; caption: string }> = {
  classroom: {
    label: "Classroom",
    frame: "Class 10-A",
    body: <ClassroomMock />,
    caption: "Every test in the class, what it still needs from you, and the average.",
  },
  students: {
    label: "Students",
    frame: "Class 10-A / Add students",
    body: <StudentsMock />,
    caption: "Import from a list, a CSV or a photo. Review every row before anything is saved.",
  },
  upload: {
    label: "Answer sheets",
    frame: "Algebra Midterm / Upload",
    body: <UploadMock />,
    caption: "Drop the whole stack. Matches are shown before a single mark is given.",
  },
  marks: {
    label: "Marks",
    frame: "Class 10-A / Marks",
    body: <MarksMock />,
    caption: "Sort, filter, search and export. The whole class in one readable table.",
  },
};

function Workspace() {
  const [tab, setTab] = useState<Surface>("classroom");
  const current = SURFACES[tab];

  return (
    <section
      id="workspace"
      className="scroll-mt-20 border-y border-line bg-surface px-5 py-20 sm:px-8 sm:py-28"
    >
      <div className="mx-auto w-full max-w-[1120px]">
        <div data-reveal className="reveal text-center">
          <h2 className="mx-auto max-w-[18ch] font-display text-[clamp(30px,5vw,52px)] text-ink">
            One class, one workspace.
          </h2>
          <p className="mx-auto mt-4 max-w-[52ch] text-[15px] leading-relaxed text-ink-2">
            Students, subjects, tests, marks and attendance — nothing to keep straight, nothing to
            learn first.
          </p>
        </div>

        <div data-reveal style={{ transitionDelay: "60ms" }} className="reveal mt-8 flex justify-center">
          <Segmented
            value={tab}
            onChange={setTab}
            className="max-w-full overflow-x-auto"
            options={(Object.keys(SURFACES) as Surface[]).map((key) => ({
              value: key,
              label: SURFACES[key].label,
            }))}
          />
        </div>

        <div data-reveal style={{ transitionDelay: "120ms" }} className="reveal mt-6">
          <AppFrame key={tab} label={current.frame} className="anim-fade">
            {current.body}
          </AppFrame>
          <p className="mt-4 text-center text-[13.5px] leading-relaxed text-ink-3">
            {current.caption}
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------- Steps ---------- */

const STEPS = [
  {
    n: "01",
    title: "Set up the classroom",
    body: "Paste a list of names, drop a CSV, or hand over a photo of your register. Student IDs are generated for you.",
  },
  {
    n: "02",
    title: "Upload the answer sheets",
    body: "Drop the whole pile at once. Each sheet is matched to a student, and you confirm the matches before anything is graded.",
  },
  {
    n: "03",
    title: "Read the marks",
    body: "Every paper marked with question-level feedback, straight into a table you can sort, filter and export.",
  },
];

function Steps() {
  return (
    <section className="px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto w-full max-w-[1120px]">
        <h2
          data-reveal
          className="reveal max-w-[18ch] font-display text-[clamp(30px,5vw,52px)] text-ink"
        >
          Three steps. That is the entire product.
        </h2>

        <div className="mt-12 grid gap-y-10 sm:grid-cols-3 sm:gap-x-10">
          {STEPS.map((step, index) => (
            <div
              key={step.n}
              data-reveal
              style={{ transitionDelay: `${index * 80}ms` }}
              className="reveal border-t border-line pt-5"
            >
              <span className="font-mono text-[12px] font-medium tracking-[0.08em] text-accent">
                {step.n}
              </span>
              <h3 className="mt-3 text-[17px] font-semibold tracking-[-0.025em] text-ink">
                {step.title}
              </h3>
              <p className="mt-2 max-w-[36ch] text-[14px] leading-[1.6] text-ink-2">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Closing ---------- */

function Closing() {
  return (
    <section className="relative overflow-hidden">
      <NightField density={0.7} />
      <div className="relative mx-auto w-full max-w-[1120px] px-5 py-24 text-center sm:px-8 sm:py-32">
        <h2 className="mx-auto max-w-[18ch] font-display text-[clamp(32px,5.5vw,60px)] text-white">
          Stop spending your evenings marking papers.
        </h2>
        <p className="mx-auto mt-5 max-w-[46ch] text-[15.5px] leading-relaxed text-white/60">
          Set up a classroom, upload one test, and watch the whole thing come back marked before
          your next period starts.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link href="/signup">
            <Button size="lg" variant="onDark" icon={<IconArrowRight size={16} />}>
              Start grading free
            </Button>
          </Link>
          <Link href="/signin">
            <Button size="lg" variant="onDarkOutline">
              Sign in
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ---------- Footer ---------- */

function SiteFooter() {
  return (
    <footer className="border-t border-line px-5 py-8 sm:px-8">
      <div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center gap-x-6 gap-y-3">
        <Link href="/" className="flex items-center gap-2">
          <Logo size={18} />
          <span className="text-[13.5px] font-semibold tracking-[-0.028em] text-ink">GradeFlow</span>
        </Link>
        <p className="text-[12.5px] text-ink-3">AI grading and classroom management for teachers.</p>
        <div className="ml-auto flex items-center gap-5">
          <Link href="/signin" className="text-[12.5px] text-ink-3 transition-colors hover:text-ink">
            Sign in
          </Link>
          <Link href="/signup" className="text-[12.5px] text-ink-3 transition-colors hover:text-ink">
            Get started
          </Link>
        </div>
      </div>
    </footer>
  );
}

/* ---------- Reveal on scroll ---------- */

function useReveal() {
  useEffect(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (typeof IntersectionObserver === "undefined") {
      targets.forEach((target) => target.classList.add("is-in"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );

    targets.forEach((target) => observer.observe(target));

    // Nothing stays hidden because an observer stalled.
    const failsafe = window.setTimeout(() => {
      targets.forEach((target) => target.classList.add("is-in"));
    }, 1500);

    return () => {
      window.clearTimeout(failsafe);
      observer.disconnect();
    };
  }, []);
}
