// Visual tokens of the phone: the wallpaper, glass colors and one theme per app. Pure data (no React).
// The wallpaper shares its navy and teal with the laptop desktop, and the apps that exist on both
// devices (mail, bank, calendar, files, housing, jobs) reuse the laptop tile colors, so an app looks
// the same on both. Static gradients and plain shadows only: no blur and no backdrop filters,
// because the phone screen is projected onto the 3D model and has to stay cheap.
import { APP_THEMES, DESKTOP_COLORS } from "../room/desktop/desktopTheme";

export interface PhoneAppTheme {
  /** Main color of the app: focus ring and header accent. */
  accent: string;
  /** Icon tile gradient on the home screen and in the app header. */
  tileFrom: string;
  tileTo: string;
  /** App header bar and body. Every app body is dark, a different tint for each app. */
  headerBg: string;
  bodyBg: string;
}

export const PHONE_COLORS = {
  /** Same navy and teal glow as the laptop wallpaper, with a second glow that gives the screen depth. */
  wallpaper:
    "radial-gradient(ellipse 90% 45% at 100% 100%, rgba(32,150,160,0.50), rgba(32,150,160,0) 70%), " +
    "radial-gradient(ellipse 80% 40% at 0% 0%, rgba(76,110,210,0.46), rgba(76,110,210,0) 70%), " +
    "radial-gradient(ellipse 60% 30% at 70% 38%, rgba(140,110,230,0.20), rgba(140,110,230,0) 70%), " +
    "linear-gradient(170deg, #112844 0%, #0a1a2e 52%, #0a2833 100%)",
  /** A faint horizon line across the wallpaper. */
  horizon: DESKTOP_COLORS.wallpaperLine,
  text: "#f2f7fb",
  textMuted: "#a9bccb",
  /** Cards on the wallpaper (notifications, widgets). Solid translucent fills, no blur. */
  glass: "rgba(14,28,46,0.62)",
  glassBorder: "rgba(160,200,220,0.20)",
  glassHover: "rgba(24,46,72,0.78)",
  badge: "#ff5a4f",
  badgeText: "#ffffff",
  notice: "#b9a5f5",
  focus: "#8fe0e8",
  tileShadow: "0 5px 12px rgba(0,0,0,0.38)",
  /** Home indicator pill. */
  indicator: "rgba(242,247,251,0.82)",
} as const;

const FALLBACK: PhoneAppTheme = {
  accent: "#7654d6",
  tileFrom: "#9b7bf0",
  tileTo: "#6a47d6",
  headerBg: "#1d1830",
  bodyBg: "#151227",
};

function fromLaptop(id: string, headerBg: string, bodyBg: string): PhoneAppTheme {
  const base = APP_THEMES[id];
  return { accent: base.accent, tileFrom: base.tileFrom, tileTo: base.tileTo, headerBg, bodyBg };
}

/** Themes by route key: `messages`, `calls`, `voicemail` and the device apps (`mail`, `bank`, ...). */
export const PHONE_APP_THEMES: Readonly<Record<string, PhoneAppTheme>> = {
  messages: { accent: "#38bdf8", tileFrom: "#4cc9ff", tileTo: "#0369a1", headerBg: "#0e2233", bodyBg: "#0b1823" },
  calls: { accent: "#7ad04f", tileFrom: "#92e06a", tileTo: "#3f8f1f", headerBg: "#15260f", bodyBg: "#0f1b0b" },
  voicemail: { accent: "#9b7bf0", tileFrom: "#b49cf6", tileTo: "#6a47d6", headerBg: "#241b42", bodyBg: "#17112d" },
  browser: fromLaptop("browser", "#1d2229", "#12161b"),
  mail: fromLaptop("device-mail", "#102448", "#0b1830"),
  bank: fromLaptop("device-bank", "#0b2c24", "#081d18"),
  calendar: fromLaptop("device-calendar", "#33171a", "#220f12"),
  files: fromLaptop("device-files", "#32230f", "#21170a"),
  housing: fromLaptop("device-housing", "#13353d", "#0d2227"),
  jobs: fromLaptop("device-jobs", "#2a2342", "#17132a"),
  map: { accent: "#ec7bb0", tileFrom: "#f59ac4", tileTo: "#b8457f", headerBg: "#361527", bodyBg: "#240e1a" },
};

export function phoneThemeFor(key: string): PhoneAppTheme {
  return Object.hasOwn(PHONE_APP_THEMES, key) ? PHONE_APP_THEMES[key] : FALLBACK;
}

/** The tile gradient of an app icon. */
export function tileBackground(theme: PhoneAppTheme): string {
  return `linear-gradient(150deg, ${theme.tileFrom}, ${theme.tileTo})`;
}
