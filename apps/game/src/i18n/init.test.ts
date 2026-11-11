import { afterEach, describe, expect, it, vi } from "vitest";

type I18nModule = typeof import("./index");

/**
 * Loads `./index` again so the test gets an i18next instance that the shared test setup has not
 * initialized yet.
 */
async function loadFreshModule(): Promise<I18nModule> {
  vi.resetModules();
  return import("./index");
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("initI18n", () => {
  it("returns Vietnamese text directly after initI18n('vi') on a fresh instance", async () => {
    const { i18n, initI18n } = await loadFreshModule();
    expect(i18n.isInitialized).toBeFalsy();

    initI18n("vi");

    // No await: resources are bundled and initialization is synchronous.
    expect(i18n.isInitialized).toBe(true);
    expect(i18n.language).toBe("vi");
    expect(i18n.t("actions.returnToMenu")).toBe("Về menu chính");
    expect(i18n.t("common:loading")).toBe("Đang tải");
    expect(document.documentElement.lang).toBe("vi");
  });

  it("bundles resources: no backend plugin and no language detector are registered", async () => {
    const { i18n, initI18n, NAMESPACES } = await loadFreshModule();
    initI18n("en");

    expect(i18n.modules.backend).toBeUndefined();
    expect(i18n.modules.languageDetector).toBeUndefined();
    expect(i18n.services.backendConnector.backend).toBeFalsy();
    for (const ns of NAMESPACES) {
      expect(i18n.hasResourceBundle("en", ns)).toBe(true);
      expect(i18n.hasResourceBundle("vi", ns)).toBe(true);
    }
  });

  it("disables React Suspense", async () => {
    const { i18n, initI18n } = await loadFreshModule();
    initI18n("en");

    expect(i18n.options.react?.useSuspense).toBe(false);
  });

  it("ignores navigator.language: a 'vi' browser still starts in the requested default locale", async () => {
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("vi");
    vi.spyOn(window.navigator, "languages", "get").mockReturnValue(["vi"]);
    const { i18n, initI18n, DEFAULT_LOCALE } = await loadFreshModule();

    initI18n(DEFAULT_LOCALE);

    expect(DEFAULT_LOCALE).toBe("en");
    expect(i18n.language).toBe("en");
    expect(i18n.t("actions.returnToMenu")).toBe("Return to menu");
    expect(document.documentElement.lang).toBe("en");
  });

  it("only applies the locale on later calls", async () => {
    const { i18n, initI18n } = await loadFreshModule();
    const first = initI18n("en");
    const second = initI18n("vi");

    expect(second).toBe(first);
    expect(i18n.language).toBe("vi");
    expect(i18n.t("loading")).toBe("Đang tải");
  });
});

describe("isSupportedLocale", () => {
  it("accepts only 'en' and 'vi'", async () => {
    const { isSupportedLocale } = await import("./locales");

    expect(isSupportedLocale("en")).toBe(true);
    expect(isSupportedLocale("vi")).toBe(true);
    for (const value of ["", "EN", "Vi", "en-US", "vi-VN", "fr", " en", "english", null, undefined, 0, {}, ["en"]]) {
      expect(isSupportedLocale(value)).toBe(false);
    }
  });
});

describe("format helpers", () => {
  // 8 November 2026 at noon UTC, so no time zone moves the calendar day.
  const date = new Date(Date.UTC(2026, 10, 8, 12));
  const longDate: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" };

  it("formats percentages for both locales", async () => {
    const { formatPercent } = await import("./format");

    expect(formatPercent("en", 0.8)).toBe("80%");
    expect(formatPercent("vi", 0.8)).toBe("80%");
    expect(formatPercent("en", 0)).toBe("0%");
    expect(formatPercent("vi", 1)).toBe("100%");
  });

  it("formats dates for both locales", async () => {
    const { formatDate } = await import("./format");

    expect(formatDate("en", date, longDate)).toBe("November 8, 2026");
    expect(formatDate("vi", date, longDate)).toBe("8 tháng 11, 2026");
    expect(formatDate("en", date, { dateStyle: "short", timeZone: "UTC" })).toBe("11/8/26");
    expect(formatDate("vi", date, { dateStyle: "short", timeZone: "UTC" })).toBe("8/11/26");
  });
});
