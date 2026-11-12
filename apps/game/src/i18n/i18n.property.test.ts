// I18n_Module properties (game-i18n-en-vi, task 10.2).
// Properties 4 and 5 from design.md, "Correctness Properties".

import { describe, expect, it } from "vitest";
import { createInstance, type TFunction } from "i18next";
import type { GameLocale } from "@scammaze/shared-types";
import { CORE_PROPERTY_RUNS } from "../test/chapterRuns";
import { createLcg, pick, randomInt } from "../test/seededRandom";
import { formatNumber } from "./format";
import { NAMESPACES, enResources, viResources, type Namespace } from "./resources";

/** Cases per property (design: at least 100; the shared constant is 200). */
const RUNS = CORE_PROPERTY_RUNS;
const FALLBACK_SEED = 0x18a00004;
const PLURAL_SEED = 0x18a00005;

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 60_000;

type Dictionary = { [key: string]: unknown };

/** Every string leaf of a dictionary as a dotted i18next key path, with its text. */
function flattenLeaves(value: unknown, prefix = ""): Array<[string, string]> {
  if (typeof value === "string") return [[prefix, value]];
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value as Dictionary).flatMap(([key, child]) => {
    // A separator inside a key name would make the dotted path ambiguous.
    expect(key.includes(".") || key.includes(":"), `key "${prefix}.${key}"`).toBe(false);
    return flattenLeaves(child, prefix ? `${prefix}.${key}` : key);
  });
}

/** Deletes the leaf at a dotted path from a dictionary tree. */
function deleteLeaf(tree: Dictionary, path: string): void {
  const parts = path.split(".");
  let node = tree;
  for (const part of parts.slice(0, -1)) node = node[part] as Dictionary;
  delete node[parts[parts.length - 1]];
}

/** Reads the leaf at a dotted path, or undefined when any segment is missing. */
function readLeaf(tree: unknown, path: string): unknown {
  let node = tree;
  for (const part of path.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Dictionary)[part];
  }
  return node;
}

/** A fresh i18next instance with the given dictionaries, so the shared `i18n` is never touched. */
function createTestInstance(vi: Record<Namespace, Dictionary>, lng: GameLocale) {
  const instance = createInstance();
  void instance.init({
    resources: { en: structuredClone(enResources), vi },
    lng,
    fallbackLng: "en",
    supportedLngs: ["en", "vi"],
    ns: [...NAMESPACES],
    defaultNS: "common",
    initAsync: false,
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  return instance;
}

const VI_LEAVES: ReadonlyArray<readonly [Namespace, string]> = NAMESPACES.flatMap((ns) =>
  flattenLeaves(viResources[ns]).map(([key]) => [ns, key] as const),
);

/** Plural base keys: English leaves ending in `_one`, with their namespace. */
const PLURAL_KEYS: ReadonlyArray<readonly [Namespace, string]> = NAMESPACES.flatMap((ns) =>
  flattenLeaves(enResources[ns])
    .filter(([key]) => key.endsWith("_one"))
    .map(([key]) => [ns, key.slice(0, -"_one".length)] as const),
);

/**
 * Interpolation values the way the callers pass them: `count` selects the form, and the visible
 * number comes from `formatNumber` (`number`, or `completed` and `total` for the file count).
 * Templates that print `{{count}}` itself get only the raw count.
 */
function pluralOptions(template: string, locale: GameLocale, count: number, completed: number) {
  const options: Record<string, unknown> = { count };
  if (template.includes("{{number}}")) options.number = formatNumber(locale, count);
  if (template.includes("{{total}}")) options.total = formatNumber(locale, count);
  if (template.includes("{{completed}}")) options.completed = formatNumber(locale, completed);
  return options;
}

/** Fills `{{name}}` placeholders from already formatted values; the expected text, built by hand. */
function fill(template: string, values: Record<string, unknown>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => String(values[name]));
}

function generateCount(next: () => number): number {
  // Boundaries first, then small counts and large counts with group separators.
  return pick(next, [0, 1, 2, 999, 1000, 1_000_000, randomInt(next, 0, 20), randomInt(next, 0, 1_000_000)]);
}

describe("i18n properties", () => {
  // Feature: game-i18n-en-vi, Property 4: Missing Vietnamese text falls back to English
  it("Property 4: missing Vietnamese text falls back to English (Requirements 1.7, 5.6, 14.6)", () => {
    expect(VI_LEAVES.length).toBeGreaterThan(0);
    const next = createLcg(FALLBACK_SEED);
    let removedTotal = 0;
    let keptTotal = 0;
    for (let index = 0; index < RUNS; index += 1) {
      // Edge cases: remove nothing, remove everything, then random fractions.
      const fraction = index === 0 ? 0 : index === 1 ? 1 : next();
      const vi = structuredClone(viResources) as unknown as Record<Namespace, Dictionary>;
      const removed = new Set<string>();
      for (const [ns, key] of VI_LEAVES) {
        if (next() < fraction) {
          deleteLeaf(vi[ns], key);
          removed.add(`${ns}:${key}`);
        }
      }
      const t: TFunction = createTestInstance(vi, "vi").t;
      const label = `seed ${FALLBACK_SEED.toString(16)} case ${index}, removed ${removed.size} of ${VI_LEAVES.length}`;

      // Check every key: removed keys show English, kept keys show Vietnamese.
      for (const [ns, key] of VI_LEAVES) {
        const id = `${ns}:${key}`;
        const expected = removed.has(id) ? readLeaf(enResources[ns], key) : readLeaf(viResources[ns], key);
        // A key that only Vietnamese has (for example a `_other` form) would have no English
        // text to fall back to; skip those when removed.
        if (expected === undefined) continue;
        expect(t(id, { skipInterpolation: true } as never), `${label}, key ${id}`).toBe(expected);
      }
      removedTotal += removed.size;
      keptTotal += VI_LEAVES.length - removed.size;
    }
    expect(removedTotal).toBeGreaterThan(0);
    expect(keptTotal).toBeGreaterThan(0);
  }, PROPERTY_TIMEOUT_MS);

  // Feature: game-i18n-en-vi, Property 5: Plural selection and count formatting
  it("Property 5: plural selection and count formatting (Requirements 5.7, 6.3)", () => {
    expect(PLURAL_KEYS.length).toBeGreaterThan(0);
    const next = createLcg(PLURAL_SEED);
    const en = createTestInstance(structuredClone(viResources) as never, "en");
    const vi = createTestInstance(structuredClone(viResources) as never, "vi");
    const instances: Record<GameLocale, TFunction> = { en: en.t, vi: vi.t };
    const seenCounts = new Set<"one" | "other">();

    for (let index = 0; index < RUNS; index += 1) {
      const [ns, base] = pick(next, PLURAL_KEYS);
      const count = generateCount(next);
      const completed = randomInt(next, 0, count);
      const label = `seed ${PLURAL_SEED.toString(16)} case ${index}, key ${ns}:${base}, count ${count}`;
      seenCounts.add(count === 1 ? "one" : "other");

      for (const locale of ["en", "vi"] as const) {
        const dictionary = locale === "en" ? enResources[ns] : viResources[ns];
        // English: `_one` exactly when the count is 1. Vietnamese: always `_other`.
        const form = locale === "en" && count === 1 ? "_one" : "_other";
        const template = readLeaf(dictionary, `${base}${form}`);
        expect(typeof template, `${label}, ${locale} ${base}${form} exists`).toBe("string");

        const options = pluralOptions(template as string, locale, count, completed);
        const text = String(instances[locale](`${ns}:${base}`, options as never));
        const values = { ...options, count: formatNumber(locale, count) };
        expect(text, `${label}, ${locale}`).toBe(fill(template as string, values));
        expect(text, `${label}, ${locale} shows the formatted count`).toContain(formatNumber(locale, count));
      }
    }
    expect([...seenCounts].sort()).toEqual(["one", "other"]);
  }, PROPERTY_TIMEOUT_MS);
});
