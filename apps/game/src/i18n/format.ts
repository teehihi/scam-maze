import type { GameLocale } from "@scammaze/shared-types";

const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();

function cacheKey(locale: GameLocale, options: object | undefined): string {
  return `${locale}|${options ? JSON.stringify(options) : ""}`;
}

function numberFormat(locale: GameLocale, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = cacheKey(locale, options);
  let format = numberFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(locale, options);
    numberFormats.set(key, format);
  }
  return format;
}

export function formatNumber(locale: GameLocale, value: number, options?: Intl.NumberFormatOptions): string {
  return numberFormat(locale, options).format(value);
}

/** Formats a fraction (0.0 to 1.0) as a whole percentage, for example 0.8 → "80%". */
export function formatPercent(locale: GameLocale, fraction: number): string {
  return numberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(fraction);
}

export function formatDate(locale: GameLocale, date: Date, options?: Intl.DateTimeFormatOptions): string {
  const key = cacheKey(locale, options);
  let format = dateFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, options);
    dateFormats.set(key, format);
  }
  return format.format(date);
}
