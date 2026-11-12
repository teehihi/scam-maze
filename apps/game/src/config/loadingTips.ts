import enLoading from "../i18n/locales/en/loading";

/**
 * Awareness tips shown while the game loads. Each tip teaches a tactic that exists in every
 * country (no brands, currencies or local reporting channels). Full sentences only.
 *
 * The text lives in the `loading` namespace under `tips.<id>`; UI code shows
 * `t("loading:tips.<id>")` for the current locale.
 */
export const LOADING_TIP_IDS = [
  "otp",
  "urgency",
  "trustedChannel",
  "readAddress",
  "payFirst",
  "switchApp",
  "familyMessage",
  "smallSteps",
] as const satisfies readonly (keyof typeof enLoading.tips)[];

export type LoadingTipId = (typeof LOADING_TIP_IDS)[number];

/** English tip text, in `LOADING_TIP_IDS` order. Alias of the English dictionary. */
export const LOADING_TIPS: readonly string[] = LOADING_TIP_IDS.map((id) => enLoading.tips[id]);
