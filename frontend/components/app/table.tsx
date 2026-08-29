"use client";

import type { ReactNode } from "react";
import { cx } from "@/components/ui/primitives";
import { IconArrowDown, IconArrowUp } from "@/components/ui/icons";

/* The table scrolls inside its own container (an overflow-x wrapper is a
   scrollport on both axes), so headers stick to that container, not the page. */
export const TH =
  "sticky top-0 z-10 border-b border-line bg-surface px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3";

/* No colour here: cells that carry a tone (a mark, a warning) pass their own
   text-* class, and a baked-in text-ink would compete with it at the same
   specificity. The table element sets the default colour instead. */
export const TD = "border-b border-line px-3 py-2 text-[13px]";

export type SortDirection = "asc" | "desc";

export function SortHeader<T extends string>({
  id,
  label,
  sort,
  onSort,
  align = "left",
  className,
  title,
}: {
  id: T;
  label: ReactNode;
  sort: { key: T; direction: SortDirection };
  onSort: (key: T) => void;
  align?: "left" | "right";
  className?: string;
  title?: string;
}) {
  const active = sort.key === id;
  return (
    <th scope="col" className={cx(TH, align === "right" && "text-right", className)} title={title}>
      <button
        onClick={() => onSort(id)}
        className={cx(
          "inline-flex items-center gap-1 uppercase tracking-[0.06em] transition-colors hover:text-ink",
          active && "text-ink",
          align === "right" && "flex-row-reverse",
        )}
      >
        {label}
        <span className={cx("transition-opacity", active ? "opacity-100" : "opacity-0")}>
          {sort.direction === "asc" ? <IconArrowUp size={11} /> : <IconArrowDown size={11} />}
        </span>
      </button>
    </th>
  );
}

/** Compares two values that may be null, always sinking nulls to the bottom. */
export function compareValues(
  a: string | number | null,
  b: string | number | null,
  direction: SortDirection,
): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const result = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b));
  return direction === "asc" ? result : -result;
}

export function nextSort<T extends string>(
  sort: { key: T; direction: SortDirection },
  key: T,
  defaultDirection: SortDirection = "asc",
): { key: T; direction: SortDirection } {
  if (sort.key === key) {
    return { key, direction: sort.direction === "asc" ? "desc" : "asc" };
  }
  return { key, direction: defaultDirection };
}
