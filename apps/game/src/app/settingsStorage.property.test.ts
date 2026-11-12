import { describe, expect, it } from "vitest";
import type { GameLocale, GameSettings, GraphicsQuality } from "@scammaze/shared-types";
import { createLcg, pick, randomInt } from "../test/seededRandom";
import { DEFAULT_SETTINGS, parseStoredSettings } from "./settingsStorage";

/** Cases per property (design: at least 100; the shared constant is 200). */
const RUNS = 200;
const PARSE_SEED = 0x5e771001;
const ROUND_TRIP_SEED = 0x5e771002;

/** Written out here, not imported, so the model does not reuse the code under test. */
const LOCALES: readonly GameLocale[] = ["en", "vi"];
const QUALITIES: readonly GraphicsQuality[] = ["low", "medium", "high"];
const LEGACY_FIELDS = ["graphicsQuality", "soundEnabled", "musicVolume", "sfxVolume", "fov"] as const;

/** Values of any JSON type, including ones with the wrong type for a field. */
const ANY_JSON_VALUES: readonly unknown[] = [
  null,
  true,
  false,
  0,
  -1,
  0.5,
  1.5,
  72,
  "",
  "low",
  "medium",
  "high",
  "en",
  [],
  [1, 2],
  {},
  { nested: true },
];

/** Language values: both supported codes plus near misses and wrong types. */
const LANGUAGE_VALUES: readonly unknown[] = [
  "en",
  "vi",
  "EN",
  "Vi",
  "vi-VN",
  "en-US",
  " vi",
  "fr",
  "",
  null,
  0,
  1,
  true,
  ["vi"],
  { code: "vi" },
];

const EXTRA_KEYS = ["theme", "volume", "lang", "locale", "Language", "x"];

const NON_JSON_TEXT = ["", "not json", "{", "{\"language\":", "undefined", "NaN", "'vi'", "{language: \"vi\"}"];

type RawCase = { kind: "absent" | "text" | "primitive" | "array" | "object"; raw: string | null; parsed?: Record<string, unknown> };

function generateRaw(next: () => number): RawCase {
  const kind = pick(next, ["absent", "text", "primitive", "array", "object", "object", "object"] as const);
  switch (kind) {
    case "absent":
      return { kind, raw: null };
    case "text":
      return { kind, raw: pick(next, NON_JSON_TEXT) };
    case "primitive":
      return { kind, raw: JSON.stringify(pick(next, [null, true, false, 0, 42, -3.5, "", "vi", "en"])) };
    case "array": {
      const length = randomInt(next, 0, 3);
      const items = Array.from({ length }, () => pick(next, ANY_JSON_VALUES));
      return { kind, raw: JSON.stringify(items) };
    }
    case "object": {
      const parsed: Record<string, unknown> = {};
      for (const field of LEGACY_FIELDS) {
        if (next() < 0.5) parsed[field] = pick(next, ANY_JSON_VALUES);
      }
      if (next() < 0.8) parsed.language = pick(next, LANGUAGE_VALUES);
      const extras = randomInt(next, 0, 2);
      for (let i = 0; i < extras; i += 1) parsed[pick(next, EXTRA_KEYS)] = pick(next, ANY_JSON_VALUES);
      return { kind, raw: JSON.stringify(parsed), parsed: JSON.parse(JSON.stringify(parsed)) };
    }
  }
}

/** Model: legacy merge for every field, then `language` replaced by a validated value. */
function expectedSettings(testCase: RawCase): Record<string, unknown> {
  if (testCase.kind !== "object" || !testCase.parsed) return { ...DEFAULT_SETTINGS };
  const legacy: Record<string, unknown> = { ...DEFAULT_SETTINGS, ...testCase.parsed };
  const stored = testCase.parsed.language;
  const language = typeof stored === "string" && (LOCALES as readonly string[]).includes(stored) ? stored : "en";
  return { ...legacy, language };
}

function generateSettings(next: () => number): GameSettings {
  return {
    graphicsQuality: pick(next, QUALITIES),
    soundEnabled: next() < 0.5,
    musicVolume: pick(next, [0, 1, next()]),
    sfxVolume: pick(next, [0, 1, next()]),
    fov: pick(next, [60, 85, randomInt(next, 60, 85), 60 + next() * 25]),
    language: pick(next, LOCALES),
  };
}

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 60_000;

describe("settingsStorage properties", () => {
  // Feature: game-i18n-en-vi, Property 1: Stored settings parsing matches the legacy merge and validates the language
  it("Property 1: parsing matches the legacy merge and validates the language (Requirements 1.1, 2.2, 2.4, 2.5, 2.6, 2.7)", () => {
    const next = createLcg(PARSE_SEED);
    const kinds = new Set<string>();
    for (let index = 0; index < RUNS; index += 1) {
      const testCase = generateRaw(next);
      kinds.add(testCase.kind);
      const actual = parseStoredSettings(testCase.raw);
      expect(actual, `seed ${PARSE_SEED.toString(16)} case ${index}, raw ${String(testCase.raw)}`).toEqual(
        expectedSettings(testCase),
      );
      expect(LOCALES).toContain(actual.language);
    }
    // Every input class from the property statement was exercised.
    expect([...kinds].sort()).toEqual(["absent", "array", "object", "primitive", "text"]);
  }, PROPERTY_TIMEOUT_MS);

  // Feature: game-i18n-en-vi, Property 2: Settings serialization round trip
  it("Property 2: parseStoredSettings(JSON.stringify(settings)) equals settings (Requirements 2.3, 2.4)", () => {
    const next = createLcg(ROUND_TRIP_SEED);
    for (let index = 0; index < RUNS; index += 1) {
      const settings = generateSettings(next);
      const raw = JSON.stringify(settings);
      expect(parseStoredSettings(raw), `seed ${ROUND_TRIP_SEED.toString(16)} case ${index}, raw ${raw}`).toEqual(
        settings,
      );
    }
  }, PROPERTY_TIMEOUT_MS);
});
