/* Small stroke-icon set (lucide-style paths) used across the workspace. */

const S = (props) => ({
  width: props.size ?? 16,
  height: props.size ?? 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: props.sw ?? 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
});

export const IconLayers = (p) => (
  <svg {...S(p)}>
    <path d="m12 2 9 5-9 5-9-5 9-5Z" />
    <path d="m3 12 9 5 9-5" />
    <path d="m3 17 9 5 9-5" />
  </svg>
);
export const IconSearch = (p) => (
  <svg {...S(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.6-3.6" />
  </svg>
);
export const IconBasemap = (p) => (
  <svg {...S(p)}>
    <path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3Z" />
    <path d="M9 3v15" />
    <path d="M15 6v15" />
  </svg>
);
export const IconLegend = (p) => (
  <svg {...S(p)}>
    <path d="M4 6h16" />
    <path d="M4 12h16" />
    <path d="M4 18h10" />
  </svg>
);
export const IconChart = (p) => (
  <svg {...S(p)}>
    <path d="M3 3v18h18" />
    <path d="m7 15 4-5 3 3 5-7" />
  </svg>
);
export const IconGrid = (p) => (
  <svg {...S(p)}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);
export const IconFlow = (p) => (
  <svg {...S(p)}>
    <path d="M4 5h6c5 0 3 14 10 14" />
    <path d="M4 19h6" />
  </svg>
);
export const IconCompare = (p) => (
  <svg {...S(p)}>
    <path d="M12 3v18" />
    <path d="M7 8 3 12l4 4" />
    <path d="m17 8 4 4-4 4" />
  </svg>
);
export const IconDownload = (p) => (
  <svg {...S(p)}>
    <path d="M12 3v12" />
    <path d="m8 11 4 4 4-4" />
    <path d="M3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2" />
  </svg>
);
export const IconPlus = (p) => (
  <svg {...S(p)} strokeWidth={p.sw ?? 2}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </svg>
);
export const IconPlay = (p) => (
  <svg width={p.size ?? 13} height={p.size ?? 13} viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 4.5v15l13-7.5z" />
  </svg>
);
export const IconPause = (p) => (
  <svg width={p.size ?? 13} height={p.size ?? 13} viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
);
export const IconStepBack = (p) => (
  <svg width={p.size ?? 15} height={p.size ?? 15} viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 5h2v14H6zm3 7 9-7v14z" />
  </svg>
);
export const IconStepFwd = (p) => (
  <svg width={p.size ?? 15} height={p.size ?? 15} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18 5h-2v14h2zM15 12 6 5v14z" />
  </svg>
);
export const IconChevronDown = (p) => (
  <svg {...S(p)} strokeWidth={p.sw ?? 2}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
export const IconChevronsLeft = (p) => (
  <svg {...S(p)}>
    <path d="m11 17-5-5 5-5" />
    <path d="m18 17-5-5 5-5" />
  </svg>
);
export const IconChevronsRight = (p) => (
  <svg {...S(p)}>
    <path d="m13 17 5-5-5-5" />
    <path d="m6 17 5-5-5-5" />
  </svg>
);
export const IconChevronsUp = (p) => (
  <svg {...S(p)}>
    <path d="m17 11-5-5-5 5" />
    <path d="m17 18-5-5-5 5" />
  </svg>
);
export const IconChevronsDown = (p) => (
  <svg {...S(p)}>
    <path d="m7 13 5 5 5-5" />
    <path d="m7 6 5 5 5-5" />
  </svg>
);
export const IconX = (p) => (
  <svg {...S(p)} strokeWidth={p.sw ?? 2}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);
export const IconSettings2 = (p) => (
  <svg {...S(p)}>
    <path d="M4 21v-7" />
    <path d="M4 10V3" />
    <path d="M12 21v-9" />
    <path d="M12 8V3" />
    <path d="M20 21v-5" />
    <path d="M20 12V3" />
    <path d="M1 14h6" />
    <path d="M9 8h6" />
    <path d="M17 16h6" />
  </svg>
);
export const IconHand = (p) => (
  <svg {...S(p)}>
    <path d="M18 11V6a2 2 0 0 0-4 0v5" />
    <path d="M14 10V4a2 2 0 0 0-4 0v6" />
    <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2a8 8 0 0 1-8-8 2 2 0 1 1 4 0" />
  </svg>
);
export const IconMarquee = (p) => (
  <svg {...S(p)} strokeDasharray="3 3">
    <rect x="4" y="4" width="16" height="16" rx="2" />
  </svg>
);
export const IconRuler = (p) => (
  <svg {...S(p)}>
    <path d="M3 15 15 3l6 6L9 21z" />
    <path d="m7 11 2 2" />
    <path d="m11 7 2 2" />
  </svg>
);
export const IconIsochrone = (p) => (
  <svg {...S(p)}>
    <circle cx="12" cy="12" r="3" />
    <circle cx="12" cy="12" r="8" />
  </svg>
);
export const IconSplit = (p) => (
  <svg {...S(p)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M12 4v16" />
  </svg>
);
export const IconExpand = (p) => (
  <svg {...S(p)}>
    <path d="M8 3H5a2 2 0 0 0-2 2v3" />
    <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
    <path d="M3 16v3a2 2 0 0 0 2 2h3" />
    <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
  </svg>
);
export const IconCalendar = (p) => (
  <svg {...S(p)}>
    <path d="M17 2v4" />
    <path d="M7 2v4" />
    <rect x="3" y="6" width="18" height="15" rx="2" />
    <path d="M3 11h18" />
  </svg>
);
export const IconGrip = (p) => (
  <svg width={p.size ?? 10} height={p.size ?? 16} viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
    <circle cx="2" cy="3" r="1.3" />
    <circle cx="8" cy="3" r="1.3" />
    <circle cx="2" cy="8" r="1.3" />
    <circle cx="8" cy="8" r="1.3" />
    <circle cx="2" cy="13" r="1.3" />
    <circle cx="8" cy="13" r="1.3" />
  </svg>
);
export const IconCheck = (p) => (
  <svg width={p.size ?? 10} height={p.size ?? 10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round">
    <path d="m5 13 4 4L19 7" />
  </svg>
);
export const IconSpinner = (p) => (
  <svg
    width={p.size ?? 14}
    height={p.size ?? 14}
    viewBox="0 0 24 24"
    fill="none"
    stroke={p.color ?? 'var(--c1)'}
    strokeWidth="2.2"
    strokeLinecap="round"
    style={{ animation: 'spin 1s linear infinite' }}
  >
    <path d="M21 12a9 9 0 1 1-6.2-8.6" />
  </svg>
);
