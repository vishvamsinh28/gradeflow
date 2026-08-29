"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui/primitives";
import { IconCheck, IconFile, IconSparkle, Spinner } from "@/components/ui/icons";

/** Runs a step function on an interval, but only while the node is on screen. */
function useTicker(onTick: () => void, ms: number, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let timer = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        window.clearInterval(timer);
        if (entry.isIntersecting) timer = window.setInterval(onTick, ms);
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => {
      window.clearInterval(timer);
      observer.disconnect();
    };
  }, [onTick, ms, ref]);
}

const ROSTER = [
  { name: "Aarav Shah", id: "STU-001", score: "34/40" },
  { name: "Ananya Iyer", id: "STU-002", score: "37/40" },
  { name: "Kabir Mehta", id: "STU-003", score: "29/40" },
  { name: "Priya Patel", id: "STU-004", score: "31/40" },
  { name: "Rahul Sharma", id: "STU-005", score: "36/40" },
  { name: "Riya Shah", id: "STU-006", score: "27/40" },
];

/**
 * The grading queue, running. It walks the roster, marking one student at a
 * time, then starts again — the single most useful thing to show someone who
 * has never seen the product.
 */
export function LiveGrading({ on = "night" }: { on?: "night" | "panel" }) {
  const ref = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(2);

  useTicker(() => setDone((value) => (value >= ROSTER.length ? 0 : value + 1)), 1100, ref);

  const total = 24;
  const graded = Math.round((done / ROSTER.length) * (total - 6)) + 6;
  const dark = on === "night";

  return (
    <div
      ref={ref}
      className={cx(
        "rounded-xl border p-4 backdrop-blur-sm",
        dark ? "border-white/10 bg-white/[0.06]" : "border-line bg-surface",
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cx(
            "flex items-center gap-1.5 text-[12.5px] font-medium",
            dark ? "text-white/80" : "text-accent",
          )}
        >
          <Spinner size={11} />
          Grading {total} submissions…
        </span>
        <span
          className={cx("font-mono text-[12px] tnum", dark ? "text-white/60" : "text-ink-3")}
        >
          {graded}/{total}
        </span>
      </div>

      <div
        className={cx(
          "mt-2.5 h-[3px] w-full overflow-hidden rounded-full",
          dark ? "bg-white/15" : "bg-surface-3",
        )}
      >
        <div
          className={cx(
            "h-full rounded-full transition-[width] duration-700 ease-out",
            dark ? "bg-[#7fd6ab]" : "bg-accent",
          )}
          style={{ width: `${(graded / total) * 100}%` }}
        />
      </div>

      <ul className="mt-4 space-y-[7px]">
        {ROSTER.map((row, index) => {
          const state = index < done ? "done" : index === done ? "grading" : "queued";
          return (
            <li key={row.id} className="flex items-center gap-2.5">
              <span
                className={cx(
                  "flex h-4 w-4 shrink-0 items-center justify-center transition-colors duration-300",
                  state === "done"
                    ? dark
                      ? "text-[#7fd6ab]"
                      : "text-accent"
                    : state === "grading"
                      ? dark
                        ? "text-white/70"
                        : "text-accent"
                      : dark
                        ? "text-white/25"
                        : "text-ink-4",
                )}
              >
                {state === "done" ? (
                  <IconCheck size={12} />
                ) : state === "grading" ? (
                  <Spinner size={11} />
                ) : (
                  <span className="h-[3px] w-[3px] rounded-full bg-current" />
                )}
              </span>

              <span
                className={cx(
                  "flex-1 truncate text-[12.5px] transition-colors duration-300",
                  state === "queued"
                    ? dark
                      ? "text-white/40"
                      : "text-ink-4"
                    : dark
                      ? "text-white/90"
                      : "text-ink",
                )}
              >
                {row.name}
              </span>

              <span
                className={cx(
                  "font-mono text-[11.5px] tnum transition-opacity duration-500",
                  state === "done" ? "opacity-100" : "opacity-0",
                  dark ? "text-[#7fd6ab]" : "text-accent",
                )}
              >
                {row.score}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const HANDWRITING = [
  { q: "Q1", text: "x = (−b ± √(b² − 4ac)) / 2a", mark: "7.5 / 7.5", tone: "good" },
  { q: "Q2", text: "Area = πr²  =  π(4.2)² = 55.4 cm²", mark: "6 / 7.5", tone: "part" },
  { q: "Q3", text: "sin²θ + cos²θ = 1", mark: "7.5 / 7.5", tone: "good" },
];

/** Handwriting being read line by line, then marked. */
export function LiveExtraction() {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(1);

  useTicker(() => setStep((value) => (value >= HANDWRITING.length + 1 ? 0 : value + 1)), 1400, ref);

  return (
    <div ref={ref} className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="flex items-center gap-1.5 border-b border-line px-3 py-2 text-[11px] text-ink-3">
        <IconFile size={11} />
        <span className="font-mono">stu-001-answer.pdf</span>
        <span className="ml-auto inline-flex items-center gap-1 text-accent">
          <IconSparkle size={10} />
          Reading
        </span>
      </div>
      <ul className="divide-y divide-line">
        {HANDWRITING.map((row, index) => {
          const revealed = index < step;
          return (
            <li
              key={row.q}
              className={cx(
                "flex items-center gap-2.5 px-3 py-2 transition-all duration-500",
                revealed ? "opacity-100" : "opacity-30",
              )}
            >
              <span className="font-mono text-[11px] text-ink-3">{row.q}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-ink-2">
                {row.text}
              </span>
              <span
                className={cx(
                  "font-mono text-[11.5px] font-medium tnum transition-opacity duration-500",
                  revealed ? "opacity-100" : "opacity-0",
                  row.tone === "good" ? "text-accent" : "text-warn",
                )}
              >
                {row.mark}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const MATCHES = [
  { file: "scan_0431.jpg", student: "Aarav Shah", via: "Read from sheet" },
  { file: "stu-002.pdf", student: "Ananya Iyer", via: "Student ID" },
  { file: "kabir_mehta.jpg", student: "Kabir Mehta", via: "Name" },
  { file: "roll-04.jpg", student: "Priya Patel", via: "Roll number" },
];

/** Files snapping onto the students they belong to. */
export function LiveMatching() {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(1);

  useTicker(() => setStep((value) => (value >= MATCHES.length + 1 ? 0 : value + 1)), 900, ref);

  return (
    <div ref={ref} className="overflow-hidden rounded-lg border border-line bg-surface">
      <ul className="divide-y divide-line">
        {MATCHES.map((row, index) => {
          const matched = index < step;
          return (
            <li key={row.file} className="flex items-center gap-2 px-3 py-[7px]">
              <IconFile size={11} className="shrink-0 text-ink-4" />
              <span className="w-[38%] truncate font-mono text-[11px] text-ink-2">{row.file}</span>
              <span
                aria-hidden="true"
                className={cx(
                  "h-px flex-1 origin-left transition-transform duration-500",
                  matched ? "scale-x-100 bg-accent-line" : "scale-x-0 bg-line",
                )}
              />
              <span
                className={cx(
                  "shrink-0 rounded border px-1.5 py-[1px] text-[10.5px] font-medium transition-all duration-500",
                  matched
                    ? "border-accent-line bg-accent-soft text-accent opacity-100"
                    : "border-line bg-surface-2 text-ink-4 opacity-40",
                )}
              >
                {matched ? row.student : row.via}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
