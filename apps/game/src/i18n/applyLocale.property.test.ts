import { describe, expect, it } from "vitest";
import type { GameLocale, GameSettings, GraphicsQuality } from "@scammaze/shared-types";
import { createLcg, pick, randomInt } from "../test/seededRandom";
import { loadSettings, saveSettings } from "../app/settingsStorage";
import { applyLocale, i18n } from "./index";

/** Cases per property (design: at least 100; the shared constant is 200). */
const RUNS = 200;
const SELECTION_SEED = 0x5e771003;

/** Written out here, not imported, so the model does not reuse the code under test. */
const LOCALES: readonly GameLocale[] = ["en", "vi"];
const QUALITIES: readonly GraphicsQuality[] = ["low", "medium", "high"];

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

/** In-memory stand-in for `localStorage` with the two methods the settings module uses. */
function createMemoryStorage(): Pick<Storage, "getItem" | "setItem"> {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, String(value));
    },
  };
}

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 60_000;

describe("applyLocale properties", () => {
  // Feature: game-i18n-en-vi, Property 3: Language selections change only the language and the document language follows
  it("Property 3: language selections change only the language and the document language follows (Requirements 2.8, 4.1, 4.3)", () => {
    const next = createLcg(SELECTION_SEED);
    const lastSelections = new Set<GameLocale>();
    for (let index = 0; index < RUNS; index += 1) {
      const initial = generateSettings(next);
      const frozenInitial = { ...initial };
      const selections = Array.from({ length: randomInt(next, 1, 6) }, () => pick(next, LOCALES));
      const storage = createMemoryStorage();
      const label = `seed ${SELECTION_SEED.toString(16)} case ${index}, initial ${JSON.stringify(initial)}, selections ${selections.join(",")}`;

      // Same update path as the App_Shell: merge, save (errors ignored), then apply the locale.
      let settings = initial;
      for (const language of selections) {
        settings = { ...settings, language };
        saveSettings(storage, settings);
        applyLocale(language);
        // Applies immediately: no await between the selection and these checks.
        expect(i18n.language, label).toBe(language);
        expect(document.documentElement.lang, label).toBe(language);
      }

      const last = selections[selections.length - 1];
      lastSelections.add(last);
      expect(settings, label).toEqual({ ...frozenInitial, language: last });
      expect(initial, label).toEqual(frozenInitial);
      expect(i18n.language, label).toBe(last);
      expect(document.documentElement.lang, label).toBe(last);
      // The stored settings follow the last selection as well.
      expect(loadSettings(storage), label).toEqual({ ...frozenInitial, language: last });
    }
    // Both locales were the final selection at least once.
    expect([...lastSelections].sort()).toEqual(["en", "vi"]);
  }, PROPERTY_TIMEOUT_MS);
});
