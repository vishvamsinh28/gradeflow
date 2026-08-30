"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cx } from "./primitives";
import { IconCalendar, IconChevronLeft, IconChevronRight } from "./icons";
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
function parse(value) {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}
function toISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function sameDay(a, b) {
  return Boolean(a) && toISO(a) === toISO(b);
}

/**
 * A themed date picker.
 *
 * `<input type="date">` draws an operating-system calendar that ignores the
 * app's palette entirely. Typing still works — the text field accepts a date
 * directly — the calendar is just ours.
 */
export function DateField({
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
  "data-autofocus": autofocus,
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const [cursor, setCursor] = useState(() => parse(value) ?? new Date());
  const wrapRef = useRef(null);
  const popRef = useRef(null);
  const selected = parse(value);
  useEffect(() => {
    if (open) setCursor(parse(value) ?? new Date());
  }, [open, value]);
  useEffect(() => {
    if (!open) return;
    setRect(wrapRef.current?.getBoundingClientRect() ?? null);
    function close(event) {
      if (!popRef.current?.contains(event.target) && !wrapRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    function onKey(event) {
      if (event.key !== "Escape") return;
      // Capture phase, so this runs before the dialog's own Escape handler:
      // closing the calendar should not also close the dialog around it.
      event.stopPropagation();
      setOpen(false);
    }
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);
  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = (first.getDay() + 6) % 7; // weeks start Monday
    const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells = Array.from(
      {
        length: start,
      },
      () => null,
    );
    for (let day = 1; day <= days; day += 1) {
      cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), day));
    }
    return cells;
  }, [cursor]);
  const today = new Date();
  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        inputMode="numeric"
        value={value}
        aria-label={ariaLabel ?? "Date"}
        placeholder="YYYY-MM-DD"
        data-autofocus={autofocus}
        onChange={(event) => onChange(event.target.value)}
        onClick={() => setOpen(true)}
        className={cx(
          "h-9 w-full rounded-md border border-line bg-surface pl-3 pr-9 font-mono text-[13.5px] text-ink transition-[border-color,box-shadow] placeholder:font-sans placeholder:text-ink-4 focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/12",
          className,
        )}
      />
      <button
        type="button"
        aria-label="Open calendar"
        onClick={() => setOpen((current) => !current)}
        className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <IconCalendar size={15} />
      </button>

      {open && rect
        ? createPortal(
            <div
              ref={popRef}
              style={{
                position: "fixed",
                top: Math.min(rect.bottom + 4, window.innerHeight - 300),
                left: Math.min(rect.left, window.innerWidth - 268),
              }}
              className="anim-pop z-[300] w-[260px] rounded-lg border border-line bg-surface p-3 shadow-lg"
            >
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() =>
                    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
                  }
                  className="flex h-6 w-6 items-center justify-center rounded text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  <IconChevronLeft size={14} />
                </button>
                <span className="text-[13px] font-medium text-ink">
                  {cursor.toLocaleDateString(undefined, {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() =>
                    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
                  }
                  className="flex h-6 w-6 items-center justify-center rounded text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  <IconChevronRight size={14} />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-0.5">
                {WEEKDAYS.map((day, index) => (
                  <span
                    key={index}
                    className="flex h-6 items-center justify-center text-[10.5px] font-medium text-ink-4"
                  >
                    {day}
                  </span>
                ))}
                {grid.map((date, index) =>
                  date ? (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        onChange(toISO(date));
                        setOpen(false);
                      }}
                      className={cx(
                        "flex h-7 items-center justify-center rounded-[5px] font-mono text-[12px] transition-colors",
                        sameDay(selected, date)
                          ? "bg-accent text-accent-on"
                          : sameDay(today, date)
                            ? "text-accent hover:bg-surface-2"
                            : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                      )}
                    >
                      {date.getDate()}
                    </button>
                  ) : (
                    <span key={index} />
                  ),
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  onChange(toISO(new Date()));
                  setOpen(false);
                }}
                className="mt-2 w-full rounded-md border border-line py-1 text-[12.5px] font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
              >
                Today
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
