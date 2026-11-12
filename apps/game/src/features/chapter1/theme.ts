// Chapter 1 brand tokens and shared Tailwind class strings.
// See .kiro/specs/chapter-01-the-urgent-call/design.md, "Rendering layer", and Requirement 7.9.
//
// Tailwind v4 only generates classes it can find as complete literal strings in the source,
// so every class below is written out in full (no string building from the tokens).

/** Brand colors as hex values, for inline styles, canvas materials and SVG. */
export const BRAND = {
  graphite: "#171521",
  navy: "#1D1B2B",
  purple: "#7654D6",
  lavender: "#B9A5F5",
  ivory: "#F7F5FF",
  mist: "#A9A4C4",
  amber: "#F2B24B",
  teal: "#4FD1B5",
} as const;

export type BrandColor = keyof typeof BRAND;

/** Shared Tailwind class strings, matching the existing UI (for example `LoadingErrorState.tsx`). */
export const UI = {
  /** Full-screen dim layer behind a modal panel. */
  backdrop: "fixed inset-0 z-40 flex items-center justify-center bg-[#171521]/70 p-4",
  /** Main panel surface (dialogs, journal, decision, pause). */
  panel:
    "w-full rounded-xl border border-[#7654d6]/35 bg-[#1d1b2b]/92 p-5 text-[#f7f5ff] shadow-xl sm:p-6",
  /** Smaller surface for HUD elements (tracker, prompts, notices). */
  hudPanel:
    "rounded-lg border border-[#38344f] bg-[#171521]/85 px-3 py-2 text-sm text-[#f7f5ff]",
  /** Inner card inside a panel (evidence item, message, option). */
  card: "rounded-lg border border-[#38344f] bg-[#171521] p-3",
  heading: "text-lg font-bold tracking-wide text-[#f7f5ff] outline-none",
  body: "text-sm leading-relaxed text-[#a9a4c4]",
  label: "text-xs font-semibold uppercase tracking-wider text-[#b9a5f5]",
  /** Text colors for status labels. Always pair with text; never rely on color alone. */
  textWarning: "text-[#f2b24b]",
  textPositive: "text-[#4fd1b5]",
  textMuted: "text-[#a9a4c4]",
  buttonPrimary:
    "flex items-center justify-center gap-2 rounded-xl bg-[#7654d6] px-5 py-2.5 text-sm font-bold text-white motion-safe:transition-colors hover:bg-[#8b6be8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b9a5f5] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer",
  buttonSecondary:
    "flex items-center justify-center gap-2 rounded-xl border border-[#38344f] bg-[#171521] px-4 py-2.5 text-sm font-medium text-[#f7f5ff] motion-safe:transition-colors hover:border-[#7654d6] hover:bg-[#26233a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b9a5f5] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer",
  /** Accept-style call action (Teal). */
  buttonAccept:
    "flex items-center justify-center gap-2 rounded-xl bg-[#4fd1b5] px-5 py-2.5 text-sm font-bold text-[#171521] motion-safe:transition-colors hover:bg-[#6ee0c7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b9a5f5] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer",
  /** Decline or hang-up style action (Amber). */
  buttonWarning:
    "flex items-center justify-center gap-2 rounded-xl bg-[#f2b24b] px-5 py-2.5 text-sm font-bold text-[#171521] motion-safe:transition-colors hover:bg-[#f5c36f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b9a5f5] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer",
} as const;
