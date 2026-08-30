"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { Spinner } from "./icons";
export function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

/* ---------- Button ---------- */

const BUTTON_BASE =
  "inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium tracking-[-0.005em] transition-[background-color,border-color,color,box-shadow,opacity] duration-150 disabled:pointer-events-none disabled:opacity-45";
const BUTTON_VARIANT = {
  primary: "bg-ink text-paper hover:bg-ink-hover",
  accent: "bg-accent text-accent-on hover:bg-accent-hover",
  secondary:
    "border border-line bg-surface text-ink shadow-[0_1px_1px_rgba(26,26,23,0.03)] hover:bg-surface-2 hover:border-line-strong",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  danger: "border border-danger-line bg-surface text-danger hover:bg-danger-soft",
  onDark: "bg-white text-[#07121d] hover:bg-white/90",
  onDarkOutline: "border border-white/25 text-white hover:border-white/50 hover:bg-white/10",
};
const BUTTON_SIZE = {
  sm: "h-7 px-2.5 text-[13px]",
  md: "h-9 px-3.5 text-[13.5px]",
  lg: "h-11 px-5 text-[14.5px]",
};
export const Button = forwardRef(function Button(
  { variant = "secondary", size = "md", loading, icon, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(BUTTON_BASE, BUTTON_VARIANT[variant], BUTTON_SIZE[size], className)}
      {...props}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
});

/** Square icon-only button — used in table rows and toolbars. */
export const IconButton = forwardRef(function IconButton(
  { label, variant = "ghost", size = "md", className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={cx(
        BUTTON_BASE,
        BUTTON_VARIANT[variant],
        size === "sm" ? "h-7 w-7" : "h-9 w-9",
        "shrink-0 p-0",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});

/* ---------- Form controls ---------- */

const CONTROL =
  "w-full rounded-md border border-line bg-surface px-3 text-[13.5px] text-ink shadow-[0_1px_1px_rgba(26,26,23,0.02)] transition-[border-color,box-shadow] placeholder:text-ink-4 focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/12 disabled:bg-surface-2 disabled:text-ink-3";
export const Input = forwardRef(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cx(CONTROL, "h-9", className)} {...props} />;
});
export const Textarea = forwardRef(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cx(CONTROL, "resize-y py-2 leading-[1.55]", className)}
      {...props}
    />
  );
});
export function Field({ label, hint, optional, children, className }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 flex items-baseline gap-2">
        <span className="text-[13px] font-medium text-ink">{label}</span>
        {optional ? <span className="text-[12px] text-ink-4">Optional</span> : null}
      </span>
      {children}
      {hint ? (
        <span className="mt-1.5 block text-[12.5px] leading-snug text-ink-3">{hint}</span>
      ) : null}
    </label>
  );
}

/* ---------- Badge ---------- */

const BADGE_TONE = {
  neutral: "border-line bg-surface-2 text-ink-2",
  accent: "border-accent-line bg-accent-soft text-accent",
  warn: "border-warn-line bg-warn-soft text-warn",
  danger: "border-danger-line bg-danger-soft text-danger",
  muted: "border-transparent bg-transparent text-ink-3",
};
export function Badge({ tone = "neutral", children, className, icon }) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-[5px] border px-1.5 py-[1px] text-[11.5px] font-medium leading-[18px] tracking-[-0.005em]",
        BADGE_TONE[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/* ---------- Keyboard hint ---------- */

export function Kbd({ children }) {
  return (
    <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] border border-line bg-surface px-1 font-sans text-[11px] font-medium text-ink-3">
      {children}
    </kbd>
  );
}

/* ---------- Avatar ---------- */

/* Five muted tints so a roster is scannable at a glance. */
const AVATAR_TINTS = [
  "bg-[#1b2a22] text-[#7cc0a0]",
  "bg-[#2a251a] text-[#c9ac72]",
  "bg-[#1c242e] text-[#8fb0d1]",
  "bg-[#2c1f1d] text-[#cf9a92]",
  "bg-[#23202c] text-[#a99cd0]",
];
export function Avatar({ name, size = 26 }) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  const text = (first + last || name.slice(0, 2)).toUpperCase();
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return (
    <span
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
      }}
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-[0.01em]",
        AVATAR_TINTS[hash % AVATAR_TINTS.length],
      )}
    >
      {text}
    </span>
  );
}

/* ---------- Progress ---------- */

export function Progress({ value, className }) {
  return (
    <div className={cx("h-[5px] w-full overflow-hidden rounded-full bg-surface-3", className)}>
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
        }}
      />
    </div>
  );
}

/* ---------- Empty state ---------- */

export function EmptyState({ icon, title, description, action, className }) {
  return (
    <div className={cx("flex flex-col items-center px-6 py-14 text-center", className)}>
      {icon ? (
        <span className="mb-3.5 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface-2 text-ink-3">
          {icon}
        </span>
      ) : null}
      <p className="text-[15px] font-semibold tracking-[-0.015em] text-ink">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-[42ch] text-[13.5px] leading-relaxed text-ink-3">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/* ---------- Segmented control ---------- */

export function Segmented({ value, onChange, options, className }) {
  return (
    <div
      role="tablist"
      className={cx(
        "inline-flex items-center gap-0.5 rounded-lg border border-line bg-surface-2 p-0.5",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cx(
              "inline-flex h-7 items-center gap-1.5 rounded-[6px] px-2.5 text-[13px] font-medium transition-colors",
              active
                ? "bg-surface text-ink shadow-[0_1px_2px_rgba(26,26,23,0.06)]"
                : "text-ink-3 hover:text-ink",
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Dropdown menu ---------- */

export function Menu({ trigger, children, align = "end" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event) {
      if (!ref.current?.contains(event.target)) setOpen(false);
    }
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      {trigger({
        open,
        toggle: () => setOpen((value) => !value),
      })}
      {open ? (
        <div
          className={cx(
            "anim-pop absolute top-[calc(100%+5px)] z-50 min-w-[184px] rounded-lg border border-line bg-surface p-1 shadow-lg",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}
export function MenuItem({ children, onClick, danger, icon }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "flex w-full items-center gap-2 rounded-[6px] px-2 py-[6px] text-left text-[13px] font-medium transition-colors",
        danger
          ? "text-danger hover:bg-danger-soft"
          : "text-ink-2 hover:bg-surface-2 hover:text-ink",
      )}
    >
      {icon ? <span className="text-ink-3">{icon}</span> : null}
      {children}
    </button>
  );
}
export function MenuSeparator() {
  return <div className="my-1 h-px bg-line" />;
}
