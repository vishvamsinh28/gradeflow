"use client";

import { useId, useRef, useState } from "react";
import { cx } from "@/components/ui/primitives";
import { IconUpload } from "@/components/ui/icons";
export function Dropzone({ accept, multiple, onFiles, title, hint, icon, compact, disabled }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);
  const labelId = useId();
  function handle(list) {
    if (!list || list.length === 0) return;
    onFiles(Array.from(list));
  }
  return (
    <button
      type="button"
      disabled={disabled}
      aria-labelledby={labelId}
      onClick={() => inputRef.current?.click()}
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
        "relative block w-full rounded-lg border border-dashed text-left transition-colors",
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
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
      <div className="flex flex-col items-center text-center">
        <span
          className={cx(
            "mb-2.5 inline-flex items-center justify-center rounded-lg border border-line bg-surface text-ink-3",
            compact ? "h-7 w-7" : "h-9 w-9",
          )}
        >
          {icon ?? <IconUpload size={compact ? 14 : 16} />}
        </span>
        <p id={labelId} className="text-[13.5px] font-medium text-ink">
          {title}
        </p>
        {hint ? (
          <p className="mt-1 max-w-[46ch] text-[12.5px] leading-snug text-ink-3">{hint}</p>
        ) : null}
      </div>
    </button>
  );
}
