import { i18n } from "../../../i18n";

/**
 * Translator for the Saigon open world's own UI text (prompts, bus status, location names), in the current game
 * language. Keys live under `testbus.world.*` in `i18n/locales/{en,vi}/worlds/testbus.ts`. Shop signs, street
 * names painted on buildings and the room's papers are scenery, not UI, and stay in Vietnamese.
 */
export function tr(key: string, options?: Record<string, unknown>): string {
  // Keys are built at run time, so the typed overloads of `t` do not apply.
  const t = i18n.t as unknown as (k: string, o?: Record<string, unknown>) => string;
  return t(`testbus.world.${key}`, { ns: "worlds", ...options });
}
