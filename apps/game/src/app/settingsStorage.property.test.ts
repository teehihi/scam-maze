import { describe, expect, it } from "vitest";
import type { GameLocale, GameSettings, GraphicsQuality, ReducedMotionSetting } from "@scammaze/shared-types";
import { effectiveReducedMotion } from "../features/chapter1/comfort/ComfortProvider";
import { createLcg, pick, randomInt } from "../test/seededRandom";
import { DEFAULT_SETTINGS, parseStoredSettings } from "./settingsStorage";

/** Cases per property (design: at least 100; the shared constant is 200). */
const RUNS = 200;
const PARSE_SEED = 0x5e771001;
const ROUND_TRIP_SEED = 0x5e771002;
const NEW_FIELDS_SEED = 0x5e771015;

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
    voiceVolume: pick(next, [0, 1, next()]),
    subtitlesEnabled: next() < 0.5,
    reducedStress: next() < 0.5,
    reducedMotion: pick(next, REDUCED_MOTION_VALUES),
    phoneVoiceFilter: next() < 0.5,
    englishVoiceFallback: next() < 0.5,
  };
}

const NEW_FIELDS = [
  "voiceVolume",
  "subtitlesEnabled",
  "reducedStress",
  "reducedMotion",
  "phoneVoiceFilter",
  "englishVoiceFallback",
] as const;

/** Written out here, not imported, so the model does not reuse the code under test. */
const REDUCED_MOTION_VALUES: readonly ReducedMotionSetting[] = ["system", "on", "off"];
const NEW_DEFAULTS = {
  voiceVolume: 1.0,
  subtitlesEnabled: true,
  reducedStress: false,
  reducedMotion: "system",
  phoneVoiceFilter: true,
  englishVoiceFallback: false,
};

/** Values for the new fields: valid, out of range and wrong-type. */
const NEW_FIELD_VALUES: readonly unknown[] = [
  ...ANY_JSON_VALUES,
  2,
  -0.25,
  1e9,
  0.3,
  "on",
  "off",
  "system",
  "ON",
  "auto",
];

/** Independent model of the six new fields. */
function expectedNewField(field: (typeof NEW_FIELDS)[number], value: unknown): unknown {
  if (value === undefined) return NEW_DEFAULTS[field];
  switch (field) {
    case "voiceVolume":
      return typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1.0;
    case "reducedMotion":
      return typeof value === "string" && (REDUCED_MOTION_VALUES as readonly string[]).includes(value)
        ? value
        : "system";
    default:
      return typeof value === "boolean" ? value : NEW_DEFAULTS[field];
  }
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

  // Feature: chapter-01-voice-narrative, Property 15: Settings parsing is total, bounded and idempotent
  it("Property 15: new fields are validated, bounded, idempotent and keep legacy values (Requirements 11.2, 11.4)", () => {
    const next = createLcg(NEW_FIELDS_SEED);
    for (let index = 0; index < RUNS; index += 1) {
      const stored: Record<string, unknown> = {};
      for (const field of LEGACY_FIELDS) {
        if (next() < 0.5) stored[field] = pick(next, QUALITIES as readonly unknown[]);
      }
      for (const field of NEW_FIELDS) {
        if (next() < 0.7) stored[field] = pick(next, NEW_FIELD_VALUES);
      }
      const raw = JSON.stringify(stored);
      const parsedStored = JSON.parse(raw) as Record<string, unknown>;
      const label = `seed ${NEW_FIELDS_SEED.toString(16)} case ${index}, raw ${raw}`;
      const actual = parseStoredSettings(raw);

      // Total and bounded: every new field is valid, and each equals the model.
      for (const field of NEW_FIELDS) {
        expect(actual[field], `${label}, field ${field}`).toEqual(expectedNewField(field, parsedStored[field]));
      }
      expect(actual.voiceVolume, label).toBeGreaterThanOrEqual(0);
      expect(actual.voiceVolume, label).toBeLessThanOrEqual(1);
      expect(REDUCED_MOTION_VALUES, label).toContain(actual.reducedMotion);
      expect(LOCALES, label).toContain(actual.language);

      // Legacy fields keep the legacy merge.
      for (const field of LEGACY_FIELDS) {
        expect(actual[field], `${label}, field ${field}`).toEqual(
          field in parsedStored ? parsedStored[field] : DEFAULT_SETTINGS[field],
        );
      }

      // Idempotent: parse(serialize(parse(x))) equals parse(x).
      expect(parseStoredSettings(JSON.stringify(actual)), label).toEqual(actual);

      // Effective reduced motion is true exactly when "on", or "system" with a matching OS query.
      for (const osQuery of [true, false]) {
        expect(effectiveReducedMotion(actual.reducedMotion, osQuery), label).toBe(
          actual.reducedMotion === "on" || (actual.reducedMotion === "system" && osQuery),
        );
      }
    }
  }, PROPERTY_TIMEOUT_MS);

  it("loads an old stored object (legacy fields only) with defaults for the six new fields", () => {
    const old = {
      graphicsQuality: "high",
      soundEnabled: false,
      musicVolume: 0.4,
      sfxVolume: 0.2,
      fov: 80,
      language: "vi",
    };
    expect(parseStoredSettings(JSON.stringify(old))).toEqual({ ...old, ...NEW_DEFAULTS });
  });

  it("falls back to the default for each invalid new value and clamps voiceVolume", () => {
    const invalid = {
      voiceVolume: "loud",
      subtitlesEnabled: "yes",
      reducedStress: 1,
      reducedMotion: "auto",
      phoneVoiceFilter: null,
      englishVoiceFallback: [],
    };
    expect(parseStoredSettings(JSON.stringify(invalid))).toMatchObject(NEW_DEFAULTS);
    expect(parseStoredSettings(JSON.stringify({ voiceVolume: 5 })).voiceVolume).toBe(1);
    expect(parseStoredSettings(JSON.stringify({ voiceVolume: -2 })).voiceVolume).toBe(0);
  });
});
