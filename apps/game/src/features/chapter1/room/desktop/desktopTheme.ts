// Visual tokens of the laptop desktop: one theme per app and the colors of the desktop itself.
// Pure data (no React). Tailwind needs whole class names, so colors are used through inline styles;
// only layout lives in class names. Static gradients and plain box-shadows only: no blur, no
// backdrop filters, no animation beyond color changes, so the projected 3D screen stays cheap.
//
// Light apps (Mail, Browser) draw their whole window. The other apps keep their existing dark
// content (`DeviceApp`, `ThesisPanel`), so they get their own tinted window chrome and body color.

export interface AppTheme {
  /** Main color of the app: focus ring, selected row, primary button. */
  accent: string;
  /** Text on top of `accent`. */
  onAccent: string;
  /** Pale tint of the accent, for selected rows and hovers (light apps). */
  accentSoft: string;
  /** Icon tile gradient on the desktop. */
  tileFrom: string;
  tileTo: string;
  /** Window title bar. */
  chromeBg: string;
  chromeText: string;
  chromeBorder: string;
  /** Window body. */
  bodyBg: string;
  /** True: the app draws its own light surface edge to edge (no padding, no dark card look). */
  light: boolean;
}

export const DESKTOP_COLORS = {
  /** Layered wallpaper: deep navy with a teal glow. Static CSS gradients. */
  wallpaper:
    "radial-gradient(ellipse 70% 55% at 85% 100%, rgba(32,150,160,0.42), rgba(32,150,160,0) 70%), " +
    "radial-gradient(ellipse 60% 50% at 8% 0%, rgba(60,96,190,0.40), rgba(60,96,190,0) 65%), " +
    "linear-gradient(165deg, #0f2540 0%, #0a1a2e 55%, #0a2530 100%)",
  /** Faint horizon line that gives the wallpaper some depth. */
  wallpaperLine: "linear-gradient(90deg, rgba(120,200,210,0), rgba(120,200,210,0.16), rgba(120,200,210,0))",
  text: "#eaf2f8",
  textMuted: "#9db3c6",
  taskbarBg: "#0b1624",
  taskbarBorder: "rgba(140,190,210,0.16)",
  taskbarButtonHover: "rgba(255,255,255,0.08)",
  taskbarActiveBg: "rgba(86,190,200,0.16)",
  taskbarActiveBorder: "rgba(110,205,215,0.55)",
  indicator: "#6fd3dc",
  indicatorDim: "rgba(111,211,220,0.4)",
  badge: "#b9a5f5",
  focus: "#8fe0e8",
  windowShadow: "0 14px 34px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.35)",
  windowBorder: "rgba(160,200,220,0.22)",
  iconShadow: "0 6px 14px rgba(0,0,0,0.38)",
} as const;

const DEFAULT_THEME: AppTheme = {
  accent: "#5b6fd6",
  onAccent: "#ffffff",
  accentSoft: "#e7eafc",
  tileFrom: "#6b7be0",
  tileTo: "#3c4bb0",
  chromeBg: "#1c2233",
  chromeText: "#eef1ff",
  chromeBorder: "rgba(180,190,255,0.2)",
  bodyBg: "#151827",
  light: false,
};

/** Themes by app id (the laptop tab id). */
export const APP_THEMES: Readonly<Record<string, AppTheme>> = {
  // Mail: light, blue and white.
  "device-mail": {
    accent: "#2563eb",
    onAccent: "#ffffff",
    accentSoft: "#e6efff",
    tileFrom: "#4d90ff",
    tileTo: "#1f56d6",
    chromeBg: "#eef3fb",
    chromeText: "#14233d",
    chromeBorder: "#d3deef",
    bodyBg: "#ffffff",
    light: true,
  },
  // Browser: neutral gray and white.
  browser: {
    accent: "#4b5563",
    onAccent: "#ffffff",
    accentSoft: "#eceef1",
    tileFrom: "#8a94a3",
    tileTo: "#4b5563",
    chromeBg: "#e3e6ea",
    chromeText: "#1f2530",
    chromeBorder: "#c9ced6",
    bodyBg: "#ffffff",
    light: true,
  },
  // University portal: academic blue and white (reserved for the portal app).
  university: {
    accent: "#1e3a8a",
    onAccent: "#ffffff",
    accentSoft: "#e3e9f8",
    tileFrom: "#3f63c4",
    tileTo: "#1e3a8a",
    chromeBg: "#e8edf8",
    chromeText: "#14214a",
    chromeBorder: "#c7d2ec",
    bodyBg: "#ffffff",
    light: true,
  },
  // Banking: light, emerald and white (a fintech look, apart from Mail's blue).
  "device-bank": {
    accent: "#0a7d5a",
    onAccent: "#ffffff",
    accentSoft: "#e6f6ef",
    tileFrom: "#2fd1a0",
    tileTo: "#0a8a64",
    chromeBg: "#e1f3ec",
    chromeText: "#0b3b2e",
    chromeBorder: "#bfdccf",
    bodyBg: "#ffffff",
    light: true,
  },
  // Files: light, warm neutral, like paper folders.
  "device-files": {
    accent: "#b8691f",
    onAccent: "#ffffff",
    accentSoft: "#f6e9d6",
    tileFrom: "#efb15f",
    tileTo: "#b8691f",
    chromeBg: "#efe6d8",
    chromeText: "#3a2a16",
    chromeBorder: "#d8c9b3",
    bodyBg: "#fbf7f1",
    light: true,
  },
  // Thesis: a document editor. Neutral graphite chrome, like a word processor.
  thesis: {
    accent: "#3a63c2",
    onAccent: "#ffffff",
    accentSoft: "#e4edfd",
    tileFrom: "#7aa2f2",
    tileTo: "#3a63c2",
    chromeBg: "#dde4f0",
    chromeText: "#1f2937",
    chromeBorder: "#c3cde0",
    bodyBg: "#e9edf3",
    light: true,
  },
  "device-calendar": {
    accent: "#d9503f",
    onAccent: "#ffffff",
    accentSoft: "#fdeeea",
    tileFrom: "#f58a7a",
    tileTo: "#c9402f",
    chromeBg: "#fbe6e1",
    chromeText: "#3a1e1a",
    chromeBorder: "#f0d0c9",
    bodyBg: "#fffaf8",
    light: true,
  },
  "device-housing": {
    accent: "#3aa8b8",
    onAccent: "#04242a",
    accentSoft: "#d9f1f4",
    tileFrom: "#5cc9d8",
    tileTo: "#217f8e",
    chromeBg: "#173a42",
    chromeText: "#e8f9fb",
    chromeBorder: "rgba(120,215,230,0.26)",
    bodyBg: "#0f1d21",
    light: false,
  },
  "device-jobs": {
    accent: "#8b6be8",
    onAccent: "#ffffff",
    accentSoft: "#ece6fc",
    tileFrom: "#a187f0",
    tileTo: "#6044c2",
    chromeBg: "#2a2342",
    chromeText: "#f3efff",
    chromeBorder: "rgba(190,170,250,0.26)",
    bodyBg: "#17132a",
    light: false,
  },
};

export function themeFor(appId: string): AppTheme {
  return Object.hasOwn(APP_THEMES, appId) ? APP_THEMES[appId] : DEFAULT_THEME;
}

/** Avatar colors for a sender. Neutral hues only: a color never says whether a sender is trusted. */
const AVATAR_COLORS = ["#4b7bd8", "#2f9e8f", "#8a6fd1", "#c27a3a", "#5c8a3e", "#b8577a", "#3f8fb5"] as const;

export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
