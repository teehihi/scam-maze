import { describe, expect, it } from "vitest";
import { CORE_PROPERTY_RUNS, CORE_PROPERTY_SEED, caseSeed } from "../../../test/chapterRuns";
import { createLcg, pick, randomInt } from "../../../test/seededRandom";
import { CHAPTER_1_INTERACTION_PROMPTS } from "../chapter1/interactables";
import { CHAPTER_1_SCENARIO } from "../chapter1/scenario";
import {
  localizeInteractionPrompts,
  localizeScenario,
  narrativeTextEntries,
  type NarrativeOverlay,
  type NarrativeTextEntry,
} from "../localize";

/** Distinct base seed so this file's cases differ from the other property files. */
const LOCALIZE_SEED = (CORE_PROPERTY_SEED ^ 0x00180006) >>> 0;

/** Characters for random overlay text, including Vietnamese letters in NFC and punctuation. */
const TEXT_ALPHABET = Array.from("abcdefghijklmnopqrstuvwxyz ABCXYZ0123456789.,:;!?-'\"ăâđêôơưáàảãạếềểễệớờởỡợứừửữự");

/** Keys that are not Narrative_Text_Keys, including names inherited from Object.prototype. */
const UNKNOWN_KEYS: readonly string[] = [
  "constructor",
  "toString",
  "hasOwnProperty",
  "unknown",
  "title/extra",
  "evidence/does-not-exist/title",
  "prompts/does-not-exist",
];

/** Placeholder written into every Narrative_Text_Key field before the structural comparison. */
const BLANK = "\u0000blank\u0000";

const CANONICAL_ENTRIES = narrativeTextEntries(CHAPTER_1_SCENARIO, CHAPTER_1_INTERACTION_PROMPTS);
const TEXT_KEYS = CANONICAL_ENTRIES.map((entry) => entry.key);

/** Every Narrative_Text_Key mapped to BLANK. BLANK is non-empty, so it replaces every field. */
const BLANK_OVERLAY: NarrativeOverlay = Object.fromEntries(TEXT_KEYS.map((key) => [key, BLANK]));

function randomText(next: () => number): string {
  const length = randomInt(next, 1, 24);
  let text = "";
  for (let index = 0; index < length; index += 1) text += pick(next, TEXT_ALPHABET);
  return text;
}

interface GeneratedOverlay {
  overlay: Record<string, string>;
  /** Keys that received a non-empty value, with the value. */
  translated: Map<string, string>;
}

/** A random subset of the text keys with non-empty or empty values, plus random unknown keys. */
function generateOverlay(seed: number): GeneratedOverlay {
  const next = createLcg(seed);
  const overlay: Record<string, string> = {};
  const translated = new Map<string, string>();
  // Vary the density from almost empty to almost complete.
  const coverage = next();
  TEXT_KEYS.forEach((key, index) => {
    if (next() >= coverage) return;
    if (next() < 0.15) {
      overlay[key] = "";
      return;
    }
    // A unique marker per key keeps every translated value distinct from English and from others.
    const value = `${randomText(next)}#${index}`;
    overlay[key] = value;
    translated.set(key, value);
  });
  const unknownCount = randomInt(next, 0, 3);
  for (let index = 0; index < unknownCount; index += 1) {
    const key = next() < 0.5 ? pick(next, UNKNOWN_KEYS) : `unknown/${randomText(next)}`;
    // Unknown keys must not shadow a real key; the generated names never match one.
    if (!TEXT_KEYS.includes(key)) overlay[key] = next() < 0.2 ? "" : randomText(next);
  }
  return { overlay, translated };
}

/** Paths where two JSON-like values differ. Throws on any difference that is not a string leaf. */
function stringLeafDifferences(expected: unknown, actual: unknown, path: string, out: string[]): void {
  if (typeof expected === "string" && typeof actual === "string") {
    if (expected !== actual) out.push(path);
    return;
  }
  if (expected === null || actual === null || typeof expected !== "object" || typeof actual !== "object") {
    expect(actual, `${path}: non-text value changed`).toStrictEqual(expected);
    return;
  }
  expect(Array.isArray(actual), `${path}: array shape changed`).toBe(Array.isArray(expected));
  const expectedKeys = Object.keys(expected);
  expect(Object.keys(actual), `${path}: keys or key order changed`).toEqual(expectedKeys);
  for (const key of expectedKeys) {
    stringLeafDifferences(
      (expected as Record<string, unknown>)[key],
      (actual as Record<string, unknown>)[key],
      `${path}/${key}`,
      out,
    );
  }
}

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 60_000;

describe("narrative localization", () => {
  it("replaces only text and falls back to English per field", () => {
    // Feature: game-i18n-en-vi, Property 6: Localization replaces only text and falls back per field
    const scenarioSnapshot = structuredClone(CHAPTER_1_SCENARIO);
    const promptsSnapshot = structuredClone(CHAPTER_1_INTERACTION_PROMPTS);
    const blankedCanonical = localizeScenario(CHAPTER_1_SCENARIO, BLANK_OVERLAY);
    let translatedFields = 0;
    let fallbackFields = 0;

    for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
      const seed = caseSeed(LOCALIZE_SEED, index);
      const where = `seed ${seed} (case ${index})`;
      const { overlay, translated } = generateOverlay(seed);
      const overlaySnapshot = structuredClone(overlay);

      const localized = localizeScenario(CHAPTER_1_SCENARIO, overlay);
      const localizedPrompts = localizeInteractionPrompts(CHAPTER_1_INTERACTION_PROMPTS, overlay);

      // (a) Everything except Narrative_Text_Key fields is unchanged.
      expect(localizeScenario(localized, BLANK_OVERLAY), `${where}: blanked scenarios differ`).toStrictEqual(
        blankedCanonical,
      );
      // Independent check that does not use the walker: only string leaves differ, and each
      // differing leaf holds a translated overlay value.
      const differences: string[] = [];
      stringLeafDifferences(CHAPTER_1_SCENARIO, localized, "", differences);
      stringLeafDifferences(CHAPTER_1_INTERACTION_PROMPTS, localizedPrompts, "prompts", differences);
      const translatedValues = new Set(translated.values());
      for (const path of differences) {
        const value = path.startsWith("prompts/")
          ? (localizedPrompts as Record<string, string>)[path.slice("prompts/".length)]
          : path
              .slice(1)
              .split("/")
              .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], localized);
        expect(translatedValues.has(value as string), `${where}: ${path} holds text not from the overlay`).toBe(
          true,
        );
      }
      expect(differences.length, `${where}: number of changed fields`).toBe(translated.size);

      // (b) Each Narrative_Text_Key has the overlay text when non-empty, else the English text.
      const localizedEntries: NarrativeTextEntry[] = narrativeTextEntries(localized, localizedPrompts);
      expect(localizedEntries.map((entry) => entry.key), `${where}: text keys changed`).toEqual(TEXT_KEYS);
      localizedEntries.forEach((entry, position) => {
        const expected = translated.get(entry.key) ?? CANONICAL_ENTRIES[position].text;
        expect(entry.text, `${where}: ${entry.key}`).toBe(expected);
        if (translated.has(entry.key)) translatedFields += 1;
        else fallbackFields += 1;
      });

      // (c) Neither the input scenario, the prompts nor the overlay were modified.
      expect(overlay, `${where}: overlay modified`).toStrictEqual(overlaySnapshot);
      expect(CHAPTER_1_SCENARIO, `${where}: scenario modified`).toStrictEqual(scenarioSnapshot);
      expect(CHAPTER_1_INTERACTION_PROMPTS, `${where}: prompts modified`).toStrictEqual(promptsSnapshot);
    }

    // The property is only meaningful if both translation and fallback happened.
    expect(translatedFields).toBeGreaterThan(0);
    expect(fallbackFields).toBeGreaterThan(0);
  }, PROPERTY_TIMEOUT_MS);
});
