"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { EmptyState, cx } from "@/components/ui/primitives";
import { IconAlert, Logo, Spinner } from "@/components/ui/icons";
import { fetchShared } from "@/lib/api";
import { formatDate, formatMark, formatPercent, markTone } from "@/lib/format";
import type { ShareResult } from "@/lib/types";

const TONE_TEXT = {
  strong: "text-accent",
  fine: "text-ink",
  watch: "text-warn",
  low: "text-danger",
  none: "text-ink-4",
} as const;

/**
 * A student's own marks, opened from a link their teacher sent.
 *
 * No sign-in, no other student's work, and nothing a teacher wrote for
 * themselves.
 */
export default function ResultsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<ShareResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchShared(token)
      .then(setData)
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "This results link is not valid."),
      );
  }, [token]);

  return (
    <div className="min-h-svh bg-paper">
      <header className="border-b border-line px-5 py-4 sm:px-8">
        <span className="mx-auto flex w-full max-w-[720px] items-center gap-2">
          <Logo size={20} />
          <span className="text-[14.5px] font-semibold tracking-[-0.028em] text-ink">GradeFlow</span>
        </span>
      </header>

      <main className="mx-auto w-full max-w-[720px] px-5 py-10 sm:px-8">
        {error ? (
          <EmptyState
            icon={<IconAlert size={17} />}
            title="This link is not valid"
            description="It may have been withdrawn. Ask your teacher for a new one."
          />
        ) : !data ? (
          <p className="flex items-center gap-2 text-[13.5px] text-ink-3">
            <Spinner size={14} />
            Loading your results…
          </p>
        ) : (
          <>
            <h1 className="font-display text-[34px] text-ink sm:text-[40px]">{data.student.name}</h1>
            <p className="mt-2 text-[14px] text-ink-3">{data.classroom.name}</p>

            {data.results.length === 0 ? (
              <div className="mt-8 rounded-xl border border-line bg-surface">
                <EmptyState
                  title="No results yet"
                  description="Marks appear here once your teacher has finished grading a test."
                />
              </div>
            ) : (
              <ul className="mt-8 space-y-3">
                {data.results.map((result, index) => (
                  <li key={index} className="rounded-xl border border-line bg-surface p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-[15.5px] font-semibold tracking-[-0.02em] text-ink">
                          {result.title}
                        </h2>
                        <p className="mt-0.5 text-[12.5px] text-ink-3">
                          {result.subject ? `${result.subject} · ` : ""}
                          {formatDate(result.date)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={cx(
                            "font-mono text-[22px] font-medium tnum",
                            TONE_TEXT[markTone(result.percent)],
                          )}
                        >
                          {formatMark(result.score ?? 0)}
                          <span className="text-ink-4">/{result.out_of}</span>
                        </p>
                        <p className="font-mono text-[12.5px] text-ink-3 tnum">
                          {formatPercent(result.percent)}
                          {result.grade ? ` · ${result.grade}` : ""}
                        </p>
                      </div>
                    </div>

                    {result.summary ? (
                      <p className="mt-3 text-[13.5px] leading-relaxed text-ink-2">{result.summary}</p>
                    ) : null}

                    {result.questions.length > 0 ? (
                      <ul className="mt-3 divide-y divide-line border-t border-line">
                        {result.questions.map((question) => (
                          <li key={question.number} className="flex gap-3 py-2">
                            <span className="w-8 shrink-0 font-mono text-[12px] text-ink-3">
                              {question.number}
                            </span>
                            <p className="flex-1 text-[12.5px] leading-relaxed text-ink-2">
                              {question.note}
                            </p>
                            <span className="shrink-0 font-mono text-[12.5px] text-ink tnum">
                              {formatMark(question.awarded)}
                              <span className="text-ink-4">/{formatMark(question.out_of)}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {data.missed && data.missed.length > 0 ? (
              <p className="mt-6 text-[13px] text-ink-3">
                Marked absent for {data.missed.map((test) => test.title).join(", ")}.
              </p>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
