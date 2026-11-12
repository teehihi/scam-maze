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
  /**
   * Accept-style call action (Teal). Disabled (paused call) uses solid colors with no opacity
   * change, so the label keeps at least 4.5:1 contrast (`#a9a4c4` on `#38344f`). Requirement 7.7.
   */
  buttonAccept:
    "flex items-center justify-center gap-2 rounded-xl bg-[#4fd1b5] px-5 py-2.5 text-sm font-bold text-[#171521] motion-safe:transition-colors hover:bg-[#6ee0c7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b9a5f5] disabled:cursor-not-allowed disabled:bg-[#38344f] disabled:text-[#a9a4c4] cursor-pointer",
  /**
   * Decline or hang-up style action (Amber). Disabled styles as for `buttonAccept`: solid colors,
   * no opacity change. Requirement 7.7.
   */
  buttonWarning:
    "flex items-center justify-center gap-2 rounded-xl bg-[#f2b24b] px-5 py-2.5 text-sm font-bold text-[#171521] motion-safe:transition-colors hover:bg-[#f5c36f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b9a5f5] disabled:cursor-not-allowed disabled:bg-[#38344f] disabled:text-[#a9a4c4] cursor-pointer",
  /**
   * End call and Decline action (red, white text). Disabled styles as for `buttonAccept`: solid
   * colors, no opacity change. Requirement 4.3.
   */
  buttonEndCall:
    "flex items-center justify-center gap-2 rounded-xl bg-[#c93c47] px-5 py-2.5 text-sm font-bold text-white motion-safe:transition-colors hover:bg-[#b3343e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b9a5f5] disabled:cursor-not-allowed disabled:bg-[#38344f] disabled:text-[#a9a4c4] cursor-pointer",
  /**
   * Dialogue option button in the call Choice_Overlay. Built only from `BRAND` colors and the
   * border color `#38344f`. States: default, hover, pressed (`active:`), keyboard focus
   * (`focus-visible:` 2 px outline, `#b9a5f5`) and disabled (no opacity change, so the text keeps
   * at least 4.5:1 contrast). Long text wraps; it is never truncated.
   * Requirements 3.9, 7.7, 7.8.
   */
  /**
   * Opaque surface for the root of the call Choice_Overlay (owner decision, 2026-11-13). The
   * options label, the narration and the focus outline of the options sit on this surface, never
   * on the dimming layer over the 3D world, so their contrast does not depend on the street.
   * The padding (16 px) is larger than the option focus outline plus its offset (2 px + 2 px), so
   * the outline always sits on the panel. Vertical scrolling only; no horizontal overflow.
   * Requirements 6.6, 7.7, 7.8.
   */
  choicePanel:
    "rounded-xl border border-[#38344f] bg-[#171521] p-4 text-[#f7f5ff] shadow-xl overflow-y-auto overflow-x-hidden",
  choiceOption:
    "flex w-full items-start gap-2 rounded-lg border border-[#38344f] bg-[#171521] px-4 py-3 text-left text-sm font-medium leading-relaxed text-[#f7f5ff] whitespace-normal break-words motion-safe:transition-colors hover:border-[#7654d6] hover:bg-[#26233a] active:border-[#b9a5f5] active:bg-[#2f2a48] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b9a5f5] disabled:cursor-not-allowed disabled:border-[#38344f] disabled:bg-[#171521] disabled:text-[#a9a4c4] cursor-pointer",
} as const;
