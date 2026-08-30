"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cx } from "./primitives";
import { IconCheck, IconChevronDown } from "./icons";
/**
 * A themed listbox.
 *
 * The native <select> menu is drawn by the operating system and cannot be
 * styled, so on a dark page it renders as a bright system panel. This keeps
 * the keyboard behaviour — type to jump, arrows, Home/End, Enter, Escape —
 * without handing the rendering over.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder = "Select…",
  className,
  disabled,
  "aria-label": ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const typed = useRef({
    text: "",
    at: 0,
  });
  const listId = useId();
  const selected = options.find((option) => option.value === value);
  useEffect(() => {
    if (!open) return;
    setRect(buttonRef.current?.getBoundingClientRect() ?? null);
    setActive(
      Math.max(
        0,
        options.findIndex((option) => option.value === value),
      ),
    );
    function close(event) {
      if (!listRef.current?.contains(event.target) && !buttonRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    function reposition() {
      setRect(buttonRef.current?.getBoundingClientRect() ?? null);
    }
    function onEscape(event) {
      if (event.key !== "Escape") return;
      // Capture phase, ahead of the dialog's own Escape handler: closing the
      // list should not also close the dialog around it.
      event.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    }
    document.addEventListener("keydown", onEscape, true);
    document.addEventListener("pointerdown", close);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("keydown", onEscape, true);
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, options, value]);
  useEffect(() => {
    if (open) {
      listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({
        block: "nearest",
      });
    }
  }, [open, active]);
  function commit(index) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    buttonRef.current?.focus();
  }
  function onKeyDown(event) {
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (event.key === "Escape") {
      // Handled by the capture-phase listener above.
      event.preventDefault();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, options.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(options.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      commit(active);
    } else if (event.key.length === 1) {
      // Type-ahead, the way a real select behaves.
      const now = Date.now();
      typed.current.text =
        now - typed.current.at > 800 ? event.key : typed.current.text + event.key;
      typed.current.at = now;
      const match = options.findIndex((option) =>
        option.label.toLowerCase().startsWith(typed.current.text.toLowerCase()),
      );
      if (match >= 0) setActive(match);
    }
  }
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onKeyDown}
        className={cx(
          "flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-3 text-left text-[13.5px] text-ink transition-[border-color,box-shadow] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/12 disabled:bg-surface-2 disabled:text-ink-3",
          open && "border-accent ring-[3px] ring-accent/12",
          className,
        )}
      >
        <span className={cx("min-w-0 flex-1 truncate", !selected && "text-ink-4")}>
          {selected?.label ?? placeholder}
        </span>
        <IconChevronDown
          size={14}
          className={cx("shrink-0 text-ink-3 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && rect
        ? createPortal(
            <div
              ref={listRef}
              id={listId}
              role="listbox"
              style={{
                position: "fixed",
                top: Math.min(rect.bottom + 4, window.innerHeight - 8),
                left: rect.left,
                width: rect.width,
                maxHeight: Math.max(160, window.innerHeight - rect.bottom - 16),
              }}
              className="anim-pop z-[300] overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-lg"
            >
              {options.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  data-index={index}
                  aria-selected={option.value === value}
                  onMouseMove={() => setActive(index)}
                  onClick={() => commit(index)}
                  className={cx(
                    "flex w-full items-center gap-2 rounded-[6px] px-2 py-[6px] text-left text-[13px] transition-colors",
                    index === active ? "bg-surface-2 text-ink" : "text-ink-2",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {option.hint ? (
                    <span className="shrink-0 text-[11.5px] text-ink-4">{option.hint}</span>
                  ) : null}
                  {option.value === value ? (
                    <IconCheck size={13} className="shrink-0 text-accent" />
                  ) : null}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
