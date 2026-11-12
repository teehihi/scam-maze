// WCAG 2.x contrast checks for the call presentation colors (Requirements 6.6, 7.7, 7.8).
// Colors are read from the class strings in `theme.ts`, so a theme change is checked here.
// Design reference: .kiro/specs/game-3d-phone-call-ui/design.md ("PhoneScreenUI.tsx",
// "PlayerChoiceOverlay.tsx", "PhoneScreenHost", "CallPresentation.tsx", "PhoneModel3D.tsx").
import { describe, expect, it } from "vitest";
import { BRAND, UI } from "../theme";

type Rgb = readonly [number, number, number];

function hexToRgb(hex: string): Rgb {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`Not a 6-digit hex color: ${hex}`);
  const value = parseInt(match[1], 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function channelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Source-over alpha compositing in sRGB space. CSS blends this way, and so does a
 * transparent three.js material drawn straight to the canvas (sRGB output, no render target).
 */
function composite(top: Rgb, alpha: number, bottom: Rgb): Rgb {
  return [0, 1, 2].map((i) => top[i] * alpha + bottom[i] * (1 - alpha)) as unknown as Rgb;
}

/**
 * Returns the color of a Tailwind token such as `text-[#f7f5ff]` or `hover:bg-[#26233a]` from a
 * class string. `variant` is `""` for the base style, or a prefix such as `"hover:"`. Returns
 * `null` when the class string has no such token. Alpha suffixes (`/70`) are returned separately.
 */
function tokenColor(
  classes: string,
  variant: string,
  property: "text" | "bg" | "outline",
): { hex: string; alpha: number } | null {
  const pattern = new RegExp(`^${variant}${property}-\\[(#[0-9a-fA-F]{6})\\](?:/(\\d+))?$`);
  for (const token of classes.split(/\s+/)) {
    const match = pattern.exec(token);
    if (match) return { hex: match[1], alpha: match[2] === undefined ? 1 : Number(match[2]) / 100 };
  }
  return null;
}

/** Like `tokenColor`, but falls back to the base style when the variant does not override it. */
function stateColor(classes: string, variant: string, property: "text" | "bg" | "outline"): string {
  const color = tokenColor(classes, variant, property) ?? tokenColor(classes, "", property);
  if (!color) throw new Error(`No ${property} color for variant "${variant}" in: ${classes}`);
  if (color.alpha !== 1) throw new Error(`Expected an opaque ${property} color in: ${classes}`);
  return color.hex;
}

const TEXT_MIN = 4.5;
const FOCUS_MIN = 3;

/** Opaque phone screen background (design, "PhoneScreenHost"). */
const SCREEN_BG = BRAND.navy;
/** Caller_Line card on the screen (`UI.card`). */
const CARD_BG = stateColor(UI.card, "", "bg");

/** Text styles that `PhoneScreenUI` uses, as in the current 2D call screens. */
const SCREEN_TEXT: Record<string, string> = {
  "caller name (ivory)": BRAND.ivory,
  "UI.heading": stateColor(UI.heading, "", "text"),
  "UI.body (number)": stateColor(UI.body, "", "text"),
  "UI.label (caption, speaker)": stateColor(UI.label, "", "text"),
  "UI.textMuted (call status)": stateColor(UI.textMuted, "", "text"),
  "UI.textPositive": stateColor(UI.textPositive, "", "text"),
  "UI.textWarning": stateColor(UI.textWarning, "", "text"),
};

/** Button states. Focus and pressed use the base colors unless the class string overrides them. */
const STATES = [
  { name: "default", variant: "" },
  { name: "hover", variant: "hover:" },
  { name: "pressed", variant: "active:" },
  { name: "keyboard focus", variant: "focus-visible:" },
  { name: "disabled", variant: "disabled:" },
] as const;

const CALL_BUTTONS = { "UI.buttonAccept": UI.buttonAccept, "UI.buttonWarning": UI.buttonWarning };

/**
 * Opaque surface of the Choice_Overlay root (`UI.choicePanel`, owner decision 2026-11-13). The
 * options label, the narration and the option focus outline sit on this surface.
 */
const CHOICE_PANEL = tokenColor(UI.choicePanel, "", "bg");
if (!CHOICE_PANEL) throw new Error("UI.choicePanel has no background color");
const CHOICE_PANEL_BG = CHOICE_PANEL.hex;

/** Tailwind spacing scale: one unit is 4 px (`p-4` is 16 px). */
function paddingPx(classes: string): number | null {
  for (const token of classes.split(/\s+/)) {
    const match = /^p-(\d+(?:\.\d+)?)$/.exec(token);
    if (match) return Number(match[1]) * 4;
  }
  return null;
}

/**
 * Dimming layers behind the Choice_Overlay panel: fallback and pending modes use the DOM
 * backdrop color (`UI.backdrop`, the same value as the `bg-[#171521]/70` layer in
 * "CallPresentation.tsx"); model mode uses the graphite plane at opacity 0.6 (design,
 * "PhoneModel3D.tsx").
 */
const backdropColor = tokenColor(UI.backdrop, "", "bg");
if (!backdropColor) throw new Error("UI.backdrop has no background color");
const DIMMING_LAYERS = {
  "fallback/pending DOM backdrop": { hex: backdropColor.hex, alpha: backdropColor.alpha },
  "model-mode dimming plane": { hex: BRAND.graphite, alpha: 0.6 },
} as const;
/** The 3D street can show any color behind the layer; white and black are the extremes. */
const WORLD_EXTREMES = { "white world": "#ffffff", "black world": "#000000" } as const;

function dimmedWorlds(): { name: string; rgb: Rgb }[] {
  const result: { name: string; rgb: Rgb }[] = [];
  for (const [layerName, layer] of Object.entries(DIMMING_LAYERS)) {
    for (const [worldName, world] of Object.entries(WORLD_EXTREMES)) {
      result.push({
        name: `${layerName} over ${worldName}`,
        rgb: composite(hexToRgb(layer.hex), layer.alpha, hexToRgb(world)),
      });
    }
  }
  return result;
}

function expectRatio(fg: Rgb | string, bg: Rgb | string, min: number): void {
  const a = typeof fg === "string" ? hexToRgb(fg) : fg;
  const b = typeof bg === "string" ? hexToRgb(bg) : bg;
  const ratio = contrastRatio(a, b);
  expect(ratio, `contrast ${ratio.toFixed(2)}:1, needs ${min}:1`).toBeGreaterThanOrEqual(min);
}

describe("contrast helpers", () => {
  it("matches the WCAG reference values", () => {
    expect(contrastRatio(hexToRgb("#000000"), hexToRgb("#ffffff"))).toBeCloseTo(21, 5);
    expect(contrastRatio(hexToRgb("#777777"), hexToRgb("#777777"))).toBeCloseTo(1, 5);
    // #767676 on white is the well-known 4.54:1 pair.
    expect(contrastRatio(hexToRgb("#767676"), hexToRgb("#ffffff"))).toBeCloseTo(4.54, 2);
  });
});

describe("Phone_Screen_UI text (Req 7.7)", () => {
  for (const [name, hex] of Object.entries(SCREEN_TEXT)) {
    it(`${name} on the screen background`, () => expectRatio(hex, SCREEN_BG, TEXT_MIN));
    it(`${name} on the Caller_Line card`, () => expectRatio(hex, CARD_BG, TEXT_MIN));
  }
});

describe("call buttons (Req 7.7, 7.8)", () => {
  for (const [name, classes] of Object.entries(CALL_BUTTONS)) {
    for (const state of STATES) {
      it(`${name} label, ${state.name}`, () =>
        expectRatio(stateColor(classes, state.variant, "text"), stateColor(classes, state.variant, "bg"), TEXT_MIN));
    }
    it(`${name} disabled state has no opacity change`, () => {
      expect(classes).not.toMatch(/(^|\s)disabled:opacity-/);
    });
    it(`${name} focus outline against the screen background`, () =>
      expectRatio(stateColor(classes, "focus-visible:", "outline"), SCREEN_BG, FOCUS_MIN));
  }
});

describe("Choice_Overlay options (Req 7.7, 7.8)", () => {
  for (const state of STATES) {
    it(`UI.choiceOption text, ${state.name}`, () =>
      expectRatio(
        stateColor(UI.choiceOption, state.variant, "text"),
        stateColor(UI.choiceOption, state.variant, "bg"),
        TEXT_MIN,
      ));
  }
  it("UI.choiceOption disabled state has no opacity change", () => {
    expect(UI.choiceOption).not.toMatch(/(^|\s)disabled:opacity-/);
  });
  // The outline is drawn 2 px outside the button, inside the panel padding, so the adjacent
  // background is the Choice_Overlay panel.
  it("UI.choiceOption focus outline against the Choice_Overlay panel", () =>
    expectRatio(stateColor(UI.choiceOption, "focus-visible:", "outline"), CHOICE_PANEL_BG, FOCUS_MIN));
});

/** Text that the Choice_Overlay shows outside the option buttons. */
const OVERLAY_TEXT: Record<string, string> = {
  "UI.label (options label)": stateColor(UI.label, "", "text"),
  "UI.body (narration)": stateColor(UI.body, "", "text"),
  "ivory (narration)": BRAND.ivory,
};

describe("Choice_Overlay panel (Req 6.6, 7.7, 7.8)", () => {
  it("UI.choicePanel background is opaque", () => {
    expect(CHOICE_PANEL.alpha).toBe(1);
  });
  it("UI.choicePanel padding keeps the option focus outline (2 px + 2 px offset) on the panel", () => {
    const padding = paddingPx(UI.choicePanel);
    expect(padding, "UI.choicePanel needs a uniform p-* padding").not.toBeNull();
    expect(padding as number).toBeGreaterThanOrEqual(12);
  });
  it("UI.choicePanel scrolls vertically and has no horizontal overflow", () => {
    expect(UI.choicePanel).toMatch(/(^|\s)overflow-y-auto(\s|$)/);
    expect(UI.choicePanel).not.toMatch(/(^|\s)overflow-x-(auto|scroll|visible)(\s|$)/);
  });
  for (const [textName, hex] of Object.entries(OVERLAY_TEXT)) {
    it(`${textName} on the Choice_Overlay panel`, () => expectRatio(hex, CHOICE_PANEL_BG, TEXT_MIN));
  }
});

describe("dimming layer behind the Choice_Overlay (Req 6.6)", () => {
  // No Choice_Overlay text or outline sits directly on the dimming layer. These checks composite
  // the panel over each dimmed world, so they fail if the panel ever becomes translucent.
  for (const world of dimmedWorlds()) {
    const surface = composite(hexToRgb(CHOICE_PANEL_BG), CHOICE_PANEL.alpha, world.rgb);
    for (const [textName, hex] of Object.entries(OVERLAY_TEXT)) {
      it(`${textName} on the panel over the ${world.name}`, () => expectRatio(hex, surface, TEXT_MIN));
    }
    it(`UI.choiceOption focus outline on the panel over the ${world.name}`, () =>
      expectRatio(stateColor(UI.choiceOption, "focus-visible:", "outline"), surface, FOCUS_MIN));
  }
});
