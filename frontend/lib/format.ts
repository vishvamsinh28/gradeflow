export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function relativeDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const then = new Date(y, (m ?? 1) - 1, d ?? 1);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.round((then.getTime() - now.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === -1) return "Yesterday";
  if (diff === 1) return "Tomorrow";
  if (diff < 0 && diff > -7) return `${-diff} days ago`;
  if (diff > 0 && diff < 7) return `In ${diff} days`;
  return formatDateShort(iso);
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Marks are stored as halves; render them without trailing ".0". */
export function formatMark(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function formatPercent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

/** A calm four-band scale — no letter-grade fetishism, just a readable signal. */
export function markTone(percent: number | null | undefined): "strong" | "fine" | "watch" | "low" | "none" {
  if (percent === null || percent === undefined) return "none";
  if (percent >= 80) return "strong";
  if (percent >= 60) return "fine";
  if (percent >= 40) return "watch";
  return "low";
}

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;
}
