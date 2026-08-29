import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function make(path: React.ReactNode, displayName: string) {
  const Component = ({ size = 16, ...props }: IconProps) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {path}
    </svg>
  );
  Component.displayName = displayName;
  return Component;
}

export const IconPlus = make(<><path d="M12 5v14" /><path d="M5 12h14" /></>, "IconPlus");
export const IconCheck = make(<path d="m4.5 12.5 5 5L19.5 7" />, "IconCheck");
export const IconX = make(<><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>, "IconX");
export const IconChevronDown = make(<path d="m6 9 6 6 6-6" />, "IconChevronDown");
export const IconChevronLeft = make(<path d="m15 6-6 6 6 6" />, "IconChevronLeft");
export const IconArrowRight = make(<><path d="M4 12h15" /><path d="m13 6 6 6-6 6" /></>, "IconArrowRight");
export const IconArrowUp = make(<><path d="M12 20V5" /><path d="m6 11 6-6 6 6" /></>, "IconArrowUp");
export const IconArrowDown = make(<><path d="M12 4v15" /><path d="m18 13-6 6-6-6" /></>, "IconArrowDown");
export const IconSearch = make(<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-3.6-3.6" /></>, "IconSearch");
export const IconUpload = make(
  <><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /><path d="M12 16V4" /><path d="m7.5 8.5 4.5-4.5 4.5 4.5" /></>,
  "IconUpload",
);
export const IconSparkle = make(
  <><path d="M12 3.5 13.7 9l5.3 1.8-5.3 1.9L12 18.2 10.3 12.7 5 10.8 10.3 9z" /><path d="M18.5 3.5v3" /><path d="M20 5h-3" /></>,
  "IconSparkle",
);
export const IconUsers = make(
  <><circle cx="9.5" cy="8" r="3.2" /><path d="M3.5 20a6 6 0 0 1 12 0" /><path d="M16.5 5.2a3.2 3.2 0 0 1 0 5.6" /><path d="M18 14.4a6 6 0 0 1 3 5.6" /></>,
  "IconUsers",
);
export const IconCalendar = make(
  <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 9.5h17" /><path d="M8 3.5v3" /><path d="M16 3.5v3" /></>,
  "IconCalendar",
);
export const IconTable = make(
  <><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M3.5 9.5h17" /><path d="M9.5 9.5v10" /></>,
  "IconTable",
);
export const IconLayers = make(
  <><path d="m12 3.5 8.5 4.3-8.5 4.4-8.5-4.4z" /><path d="m3.5 12.2 8.5 4.3 8.5-4.3" /><path d="m3.5 16.4 8.5 4.3 8.5-4.3" /></>,
  "IconLayers",
);
export const IconTrash = make(
  <><path d="M4.5 6.5h15" /><path d="M9.5 6.5V4.8a1.3 1.3 0 0 1 1.3-1.3h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7" /><path d="M6.5 6.5 7.4 19a1.6 1.6 0 0 0 1.6 1.5h6a1.6 1.6 0 0 0 1.6-1.5l.9-12.5" /></>,
  "IconTrash",
);
export const IconMore = make(
  <><circle cx="5.5" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="18.5" cy="12" r="1.3" fill="currentColor" stroke="none" /></>,
  "IconMore",
);
export const IconAlert = make(
  <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.8v4.7" /><path d="M12 16.1h.01" /></>,
  "IconAlert",
);
export const IconFile = make(
  <><path d="M13.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z" /><path d="M13.5 3.5V9H19" /></>,
  "IconFile",
);
export const IconCheckCircle = make(
  <><circle cx="12" cy="12" r="8.5" /><path d="m8.3 12.2 2.5 2.5 4.9-4.9" /></>,
  "IconCheckCircle",
);
export const IconMinusCircle = make(<><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12h7" /></>, "IconMinusCircle");
export const IconEdit = make(
  <><path d="M16.5 4.5a2.1 2.1 0 0 1 3 3L9 18l-4 1 1-4z" /><path d="M14.5 6.5l3 3" /></>,
  "IconEdit",
);
export const IconHome = make(
  <><path d="m4 10.5 8-6.5 8 6.5" /><path d="M6 9.4V19a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19V9.4" /></>,
  "IconHome",
);
export const IconDownload = make(
  <><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /><path d="M12 4v12" /><path d="m7.5 11.5 4.5 4.5 4.5-4.5" /></>,
  "IconDownload",
);

export const IconLogout = make(
  <><path d="M14.5 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8" /><path d="M17.5 8.5 21 12l-3.5 3.5" /><path d="M21 12H10" /></>,
  "IconLogout",
);

export const IconEye = make(
  <><path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.7" /></>,
  "IconEye",
);
export const IconEyeOff = make(
  <><path d="M9.6 6.1A8.9 8.9 0 0 1 12 5.8c6 0 9.5 6.2 9.5 6.2a17 17 0 0 1-2.9 3.6" /><path d="M6.2 8A17 17 0 0 0 2.5 12S6 18.2 12 18.2a8.7 8.7 0 0 0 3.4-.66" /><path d="M10.1 10.1a2.7 2.7 0 0 0 3.8 3.8" /><path d="M3.6 3.6 20.4 20.4" /></>,
  "IconEyeOff",
);

export function Spinner({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`anim-spin ${className}`}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.6" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * The mark: a teacher's tick, drawn the way one actually is — a short stroke
 * down, then a long one up and away. The downstroke is ink and the upstroke is
 * accent, so the gesture reads as marking something and then moving on.
 *
 * No container, which is what keeps it legible at 16px. The favicon carries its
 * own tile because a browser tab is not guaranteed to be dark.
 */
export function Logo({ size = 22, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M3.4 12.8 8.7 18.2"
        stroke="var(--ink)"
        strokeWidth="3.1"
        strokeLinecap="round"
      />
      <path
        d="M8.7 18.2 20.6 4.6"
        stroke="var(--accent)"
        strokeWidth="3.1"
        strokeLinecap="round"
      />
    </svg>
  );
}
