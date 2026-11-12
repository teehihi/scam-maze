/**
 * Shape of a translated dictionary: the same keys as the English source.
 * `_one` plural keys are optional because Vietnamese has a single plural form (`_other`).
 */
export type LocaleShape<T> = {
  [K in keyof T as K extends `${string}_one` ? never : K]: T[K] extends string ? string : LocaleShape<T[K]>;
} & {
  [K in keyof T as K extends `${string}_one` ? K : never]?: string;
};
