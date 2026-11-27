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
  /** Caps a panel to the viewport (the backdrop adds 1 rem of padding on each side). Use with `flex flex-col` and a scrolling body. */
  panelFit: "max-h-[calc(100dvh-2rem)]",
  /** Smaller surface for HUD elements (tracker, prompts, notices). */
  hudPanel:
    "rounded-lg border border-[#38344f] bg-[#171521]/85 px-3 py-2 text-sm text-[#f7f5ff]",
  /** Inner card inside a panel (evidence item, message, option). */
  card: "rounded-lg border border-[#38344f] bg-[#171521] p-3",
  heading: "text-lg font-bold tracking-wide text-[#f7f5ff] outline-none",
  body: "text-sm leading-relaxed text-[#a9a4c4]",
  label: "text-xs font-semibold uppercase tracking-wider text-[#b9a5f5]",
  /** Text colors for status labels. Always pair with text; never rely on color alone. */
  textWarning: "text-[#b9a5f5]",
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
   * Decline or hang-up style action (lavender). Disabled styles as for `buttonAccept`: solid colors,
   * no opacity change. Requirement 7.7.
   */
  buttonWarning:
    "flex items-center justify-center gap-2 rounded-xl bg-[#b9a5f5] px-5 py-2.5 text-sm font-bold text-[#171521] motion-safe:transition-colors hover:bg-[#e9e2ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b9a5f5] disabled:cursor-not-allowed disabled:bg-[#38344f] disabled:text-[#a9a4c4] cursor-pointer",
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

/**
 * Cinematic gameplay UI tokens. EVERY visual value of the cinematic redesign (colors, radii,
 * blur, widths, durations) lives here, so a pass against the final reference image only edits
 * this object. Components read these values through inline styles and the helpers below; they
 * never write their own numbers. Only layout classes (flex, gap, position) stay in Tailwind.
 */
export const CINE = {
  color: {
    /** Charcoal panel base as `r,g,b`, combined with the alpha values below. */
    panelRgb: "18,18,24",
    /** Alpha of a normal panel (tracker, toast, subtitle, response card). */
    panelAlpha: 0.66,
    /** Alpha of a panel that carries reading text over the 3D world. */
    panelAlphaStrong: 0.74,
    border: "rgba(185,165,245,0.18)",
    borderStrong: "rgba(185,165,245,0.34)",
    text: BRAND.ivory,
    textMuted: BRAND.mist,
    accent: BRAND.purple,
    accentText: BRAND.lavender,
    /** Hover and keyboard selection of a response card. */
    selectedBg: "rgba(118,84,214,0.30)",
    selectedBorder: "rgba(185,165,245,0.75)",
    /** Soft violet glow of the selected response card (alpha at most 0.35). */
    selectedGlow: "0 0 18px rgba(118,84,214,0.32)",
    /** Darker, unselected response card and its hairline border. */
    cardBg: "rgba(14,14,20,0.74)",
    cardBorder: "rgba(255,255,255,0.08)",
    /** Violet speaker pill above the subtitle bar. */
    namePillBg: "rgba(118,84,214,0.92)",
    namePillText: "#ffffff",
    /** Round icon holder of a response card. */
    iconCircleBg: "rgba(255,255,255,0.09)",
    iconCircleSelectedBg: "rgba(118,84,214,0.55)",
    /** Security alert banner of the laptop notification. */
    alertBg: "#b3343e",
    alertText: "#ffffff",
    /** Sidebar of the laptop window. */
    sidebarBg: "#13111b",
    sidebarSelectedBg: "rgba(118,84,214,0.28)",
    unreadDot: "#b9a5f5",
    success: BRAND.teal,
    checkboxBorder: "rgba(255,255,255,0.5)",
    keycapBg: "rgba(255,255,255,0.08)",
    keycapBorder: "rgba(255,255,255,0.22)",
    /** Soft dim behind a call: transparent in the center, darker at the edges. */
    vignette: "radial-gradient(ellipse at 62% 50%, rgba(10,9,16,0) 38%, rgba(10,9,16,0.58) 100%)",
    /** Laptop window chrome. */
    laptopBar: "#14121d",
    laptopBody: "#1a1826",
    laptopDock: "#100f18",
    laptopDots: ["#ff6b6b", "#b9a5f5", "#4fd1b5"],
  },
  blurPx: 14,
  radiusPx: { panel: 14, card: 12, keycap: 6, chip: 999 },
  /** Minimum effective text size, in px. */
  fontPx: { body: 14, small: 13, subtitle: 20 },
  widthPx: { choice: 640, subtitle: 760, toast: 320, tracker: 288, hint: 232 },
  /** Objective card: checkbox sizes and the indent of the dim sub-lines, in px. */
  objective: { boxPx: 14, smallBoxPx: 11, indentPx: 22 },
  /** Laptop window: width of the app sidebar, in px. */
  laptop: { sidebarPx: 176 },
  /** Round icon holder of a response card, in px. */
  iconCirclePx: 28,
  /** Subtitle bar metrics, in px (line height is a ratio of the font size). */
  subtitle: { lineHeight: 1.6, padXPx: 14, padYPx: 10, pillHeightPx: 22 },
  /** Anchored interaction prompt: offset from the prop, margin to the screen edge and its box estimate, in px. */
  prompt: { offsetPx: 22, marginPx: 12, boxWidthPx: 230, boxHeightPx: 34 },
  motion: {
    fastMs: 150,
    baseMs: 200,
    slideMs: 220,
    slidePx: 12,
    /** How long an evidence notice stays. */
    toastMs: 4200,
    /** Time without a change before the objective tracker fades down. */
    idleFadeAfterMs: 6000,
    /** Opacity of the tracker while idle. */
    idleOpacity: 0.5,
    /** Fade-out time of the movement hints after first use. */
    hintFadeMs: 600,
    ease: "cubic-bezier(0.22, 0.61, 0.36, 1)",
  },
  /** Evidence notice: right edge gap and z-index (above the laptop surface), in px. */
  toast: { zIndex: 60 },
  /** Maximum number of response cards shown before the list scrolls. */
  choiceVisibleCards: 4,
  /** How long the "Press Ctrl to use the mouse" note stays after the pointer lock starts or an overlay closes. */
  mouseHintMs: 6000,
  /** Distance of the movement hints from the bottom edge, in px (clear of the Ctrl/Esc footer strip). */
  hintsBottomPx: 64,
  /** If a picked reply changes nothing (the action was refused), the cards come back after this time. */
  choiceRecoverMs: 700,
  /** Key under which the movement hints remember that they were used (session only). */
  hintStorageKey: "scammaze.chapter1.movementHintsSeen",
} as const;

/** `rgba(...)` of the panel color with an alpha. */
export function cineRgba(alpha: number): string {
  return `rgba(${CINE.color.panelRgb},${alpha})`;
}

/** Inline style of a translucent charcoal panel. `strong` is for text that must stay readable. */
export function cinePanelStyle(strong = false): {
  background: string;
  border: string;
  borderRadius: number;
  backdropFilter: string;
  WebkitBackdropFilter: string;
  color: string;
} {
  const blur = `blur(${CINE.blurPx}px)`;
  return {
    background: cineRgba(strong ? CINE.color.panelAlphaStrong : CINE.color.panelAlpha),
    border: `1px solid ${CINE.color.border}`,
    borderRadius: CINE.radiusPx.panel,
    backdropFilter: blur,
    WebkitBackdropFilter: blur,
    color: CINE.color.text,
  };
}

/** Inline style of a key-cap (E, J, 1-3, W A S D). */
export const CINE_KEYCAP_STYLE = {
  background: CINE.color.keycapBg,
  border: `1px solid ${CINE.color.keycapBorder}`,
  borderRadius: CINE.radiusPx.keycap,
  color: CINE.color.text,
  minWidth: 22,
  height: 22,
  fontSize: CINE.fontPx.small,
  lineHeight: 1,
} as const;

/** Keyframes shared by the cinematic components. Render once next to an animated element. */
export const CINE_KEYFRAMES = `@keyframes scammaze-cine-slide-in {
  from { opacity: 0; transform: translateX(-${CINE.motion.slidePx}px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes scammaze-cine-rise-in {
  from { opacity: 0; transform: translateY(${CINE.motion.slidePx}px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes scammaze-cine-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}`;
