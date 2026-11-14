/**
 * Translator for the neighborhood engine (interaction prompts, room names, location and weather).
 * The page installs i18next's `t` (namespace `worlds`) before it builds the engine. Keys live
 * under `khupho.game.*` in `i18n/locales/{en,vi}/worlds/khupho.ts`. Shop signs and street names
 * painted on the buildings are scenery, not UI, and stay in Vietnamese.
 */
type Translate = (key: string, options?: Record<string, unknown>) => string;

let translate: Translate = (key) => key;

export function setTranslator(fn: Translate): void {
  translate = fn;
}

/** Looks up `khupho.game.<key>`. */
export function tr(key: string, options?: Record<string, unknown>): string {
  return translate(`khupho.game.${key}`, options);
}
