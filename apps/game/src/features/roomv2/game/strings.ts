/**
 * Translator used by the room engine and its canvas screens. The page installs i18next's `t`
 * (namespace `worlds`) before it builds the engine, so every line follows the game language.
 * Keys live under `roomv2.game.*` in `i18n/locales/{en,vi}/worlds/roomv2.ts`.
 */
type Translate = (key: string, options?: Record<string, unknown>) => string;

let translate: Translate = (key) => key;

export function setTranslator(fn: Translate): void {
  translate = fn;
}

/** Looks up `roomv2.game.<key>`. */
export function tr(key: string, options?: Record<string, unknown>): string {
  return translate(`roomv2.game.${key}`, options);
}

/** Numbered inspect lines: `inspect.<id>.1` ... `inspect.<id>.<count>`. */
export function trLines(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => tr(`${prefix}.${i + 1}`));
}
