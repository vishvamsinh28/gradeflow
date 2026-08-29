"use client";

import { useRef, useState, type ReactNode } from "react";
import { cx } from "@/components/ui/primitives";
import { IconUpload } from "@/components/ui/icons";

export function Dropzone({
  accept,
  multiple,
  onFiles,
  title,
  hint,
  icon,
  compact,
  disabled,
}: {
  accept?: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  title: string;
  hint?: ReactNode;
  icon?: ReactNode;
  compact?: boolean;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  function handle(list: FileList | null) {
    if (!list || list.length === 0) return;
    onFiles(Array.from(list));
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        if (!disabled) handle(event.dataTransfer.files);
      }}
      className={cx(
        "relative rounded-lg border border-dashed transition-colors",
        compact ? "px-4 py-5" : "px-6 py-9",
        disabled
          ? "border-line bg-surface-2 opacity-60"
          : over
            ? "border-accent bg-accent-soft"
            : "border-line-strong bg-surface-2/50 hover:border-accent-line hover:bg-accent-soft/40",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(event) => {
          handle(event.target.files);
          event.target.value = "";
        }}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        aria-label={title}
      />
      <div className="pointer-events-none flex flex-col items-center text-center">
        <span
          className={cx(
            "mb-2.5 inline-flex items-center justify-center rounded-lg border border-line bg-surface text-ink-3",
            compact ? "h-7 w-7" : "h-9 w-9",
          )}
        >
          {icon ?? <IconUpload size={compact ? 14 : 16} />}
        </span>
        <p className="text-[13.5px] font-medium text-ink">{title}</p>
        {hint ? <p className="mt-1 max-w-[46ch] text-[12.5px] leading-snug text-ink-3">{hint}</p> : null}
      </div>
    </div>
  );
}
