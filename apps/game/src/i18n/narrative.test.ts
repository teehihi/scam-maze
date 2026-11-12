// Vietnamese Chapter 1 narrative overlay checks (game-i18n-en-vi, task 6.8).
// Requirements 9.2, 9.6, 9.7, 9.9, 9.13. All checks are exhaustive over finite data, so failures
// name the Narrative_Text_Key or scenario path that broke the rule.

import { describe, expect, it } from "vitest";
import { CHAPTER_1_INTERACTION_PROMPTS } from "../game/narrative/chapter1/interactables";
import { CHAPTER_1_SCENARIO } from "../game/narrative/chapter1/scenario";
import { narrativeTextEntries } from "../game/narrative/localize";
import { validateScenario } from "../game/narrative/validateScenario";
import { getDisplayPrompts, getDisplayScenario, NARRATIVE_OVERLAYS } from "./narrative";
import { CHAPTER_1_NARRATIVE_VI, CHAPTER_1_NARRATIVE_VI_PARTS } from "./narrative/chapter1.vi";

const ENTRIES = narrativeTextEntries(CHAPTER_1_SCENARIO, CHAPTER_1_INTERACTION_PROMPTS);
const ENGLISH_BY_KEY = new Map(ENTRIES.map((entry) => [entry.key, entry.text]));
const OVERLAY_ENTRIES = Object.entries(CHAPTER_1_NARRATIVE_VI);

/** Overlay keys whose text matches `pattern`, for readable failure messages. */
function keysMatching(pattern: RegExp): string[] {
  return OVERLAY_ENTRIES.filter(([, text]) => pattern.test(text)).map(([key]) => key);
}

/** Every match of `pattern` in `text`, sorted, so two texts can be compared as multisets. */
function matchesOf(pattern: RegExp, text: string): string[] {
  return Array.from(text.matchAll(pattern), (match) => match[0].toLowerCase()).sort();
}

/** Keys where the English and Vietnamese texts disagree on the matches of `pattern`. */
function keysWithChangedMatches(pattern: RegExp): Array<{ key: string; en: string[]; vi: string[] }> {
  return OVERLAY_ENTRIES.flatMap(([key, vi]) => {
    const en = ENGLISH_BY_KEY.get(key);
    if (en === undefined) return [];
    const enMatches = matchesOf(pattern, en);
    const viMatches = matchesOf(pattern, vi);
    return JSON.stringify(enMatches) === JSON.stringify(viMatches) ? [] : [{ key, en: enMatches, vi: viMatches }];
  });
}

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/**
 * Keys where a number changed. Every number in the English text must stay in the Vietnamese text.
 * The Vietnamese text may write a number the English text spells out (for example "zero" → "0").
 */
function keysWithChangedNumbers(): Array<{ key: string; problem: string }> {
  return OVERLAY_ENTRIES.flatMap(([key, vi]) => {
    const en = ENGLISH_BY_KEY.get(key);
    if (en === undefined) return [];
    const viNumbers = matchesOf(NUMBER_PATTERN, vi);
    const problems: string[] = [];
    for (const number of matchesOf(NUMBER_PATTERN, en)) {
      const index = viNumbers.indexOf(number);
      if (index === -1) problems.push(`missing ${number}`);
      else viNumbers.splice(index, 1);
    }
    for (const number of viNumbers) {
      const word = NUMBER_WORDS[Number(number)];
      if (word === undefined || !new RegExp(`\\b${word}\\b`, "i").test(en)) problems.push(`extra ${number}`);
    }
    return problems.map((problem) => ({ key, problem }));
  });
}

const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}]/u;
const DOMAIN_PATTERN = /\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+\b/gi;
const PHONE_PATTERN = /\+\d[\d \-]*\d|\b\d(?:[ \-]?\d){6,}\b/g;
const NUMBER_PATTERN = /\d+/g;

describe("Vietnamese narrative overlay: keys", () => {
  it("has a non-empty text for every Narrative_Text_Key", () => {
    const missing = ENTRIES.map((entry) => entry.key).filter((key) => {
      const text = CHAPTER_1_NARRATIVE_VI[key];
      return typeof text !== "string" || text.trim().length === 0;
    });
    expect(missing).toEqual([]);
  });

  it("has no unknown key", () => {
    expect(Object.keys(CHAPTER_1_NARRATIVE_VI).filter((key) => !ENGLISH_BY_KEY.has(key))).toEqual([]);
  });

  it("has parts with disjoint keys that together make the merged overlay", () => {
    const owner = new Map<string, string>();
    const duplicates: string[] = [];
    for (const [part, overlay] of Object.entries(CHAPTER_1_NARRATIVE_VI_PARTS)) {
      for (const key of Object.keys(overlay)) {
        const previous = owner.get(key);
        if (previous !== undefined) duplicates.push(`${key} (in ${previous} and ${part})`);
        else owner.set(key, part);
      }
    }
    expect(duplicates).toEqual([]);
    expect([...owner.keys()].sort()).toEqual(Object.keys(CHAPTER_1_NARRATIVE_VI).sort());
  });

  it("is the overlay registered for vi, and en has no overlay", () => {
    expect(NARRATIVE_OVERLAYS.vi).toBe(CHAPTER_1_NARRATIVE_VI);
    expect(NARRATIVE_OVERLAYS.en).toEqual({});
  });
});

describe("Vietnamese narrative overlay: text rules", () => {
  it("stores every text in Unicode NFC", () => {
    expect(OVERLAY_ENTRIES.filter(([, text]) => text !== text.normalize("NFC")).map(([key]) => key)).toEqual([]);
  });

  it("contains no emoji", () => {
    expect(keysMatching(EMOJI)).toEqual([]);
  });

  it('never uses "an toàn" in any letter case', () => {
    expect(keysMatching(/an toàn/iu)).toEqual([]);
  });

  it('uses "mã xác thực một lần" for one-time code, never "mã dùng một lần"', () => {
    expect(keysMatching(/mã dùng một lần/iu)).toEqual([]);
  });

  it('keeps "Northgate Bank" verbatim and never writes "Ngân hàng Northgate"', () => {
    const dropped = OVERLAY_ENTRIES.filter(
      ([key, vi]) => ENGLISH_BY_KEY.get(key)?.includes("Northgate Bank") === true && !vi.includes("Northgate Bank"),
    ).map(([key]) => key);
    expect(dropped).toEqual([]);
    expect(keysMatching(/ngân hàng northgate/iu)).toEqual([]);
  });

  it("keeps character names unchanged", () => {
    const names = Object.values(CHAPTER_1_SCENARIO.npcs).map((npc) => npc.name);
    expect(names.length).toBeGreaterThan(0);
    const dropped = names.flatMap((name) => {
      const pattern = new RegExp(`\\b${name}\\b`);
      return OVERLAY_ENTRIES.filter(([key, vi]) => pattern.test(ENGLISH_BY_KEY.get(key) ?? "") && !vi.includes(name)).map(
        ([key]) => `${key}: ${name}`,
      );
    });
    expect(dropped).toEqual([]);
  });

  it("keeps phone numbers, domains and numbers unchanged per key", () => {
    expect(keysWithChangedMatches(PHONE_PATTERN)).toEqual([]);
    expect(keysWithChangedMatches(DOMAIN_PATTERN)).toEqual([]);
    expect(keysWithChangedNumbers()).toEqual([]);
  });
});

describe("display scenario", () => {
  it("returns the canonical objects for en", () => {
    expect(getDisplayScenario("en")).toBe(CHAPTER_1_SCENARIO);
    expect(getDisplayPrompts("en")).toBe(CHAPTER_1_INTERACTION_PROMPTS);
  });

  it("returns the same object on repeated calls", () => {
    expect(getDisplayScenario("vi")).toBe(getDisplayScenario("vi"));
    expect(getDisplayPrompts("vi")).toBe(getDisplayPrompts("vi"));
  });

  it("gives a Vietnamese scenario that passes validateScenario", () => {
    const scenario = getDisplayScenario("vi");
    expect(scenario).not.toBe(CHAPTER_1_SCENARIO);
    expect(scenario.title).toBe(CHAPTER_1_NARRATIVE_VI.title);
    expect(validateScenario(scenario)).toEqual([]);
  });

  it("uses the overlay text for every Vietnamese entry", () => {
    const localized = narrativeTextEntries(getDisplayScenario("vi"), getDisplayPrompts("vi"));
    const different = localized.filter((entry) => entry.text !== CHAPTER_1_NARRATIVE_VI[entry.key]).map((e) => e.key);
    expect(different).toEqual([]);
  });
});

// The English content lint (`game/narrative/chapter1/content.test.ts`) walks every string in the
// scenario and skips identifier properties. This copy of that walker checks that
// `narrativeTextEntries` lists every text string the lint finds, so no text escapes translation.
describe("narrativeTextEntries coverage", () => {
  interface FoundString {
    path: string;
    key: string;
    value: string;
  }

  function collectStrings(value: unknown, path = "scenario", key = ""): FoundString[] {
    if (typeof value === "string") return [{ path, key, value }];
    if (Array.isArray(value)) return value.flatMap((item, i) => collectStrings(item, `${path}[${i}]`, key));
    if (value !== null && typeof value === "object") {
      return Object.entries(value).flatMap(([k, v]) => collectStrings(v, `${path}.${k}`, k));
    }
    return [];
  }

  // Same list as the English content lint: identifiers and enum values, not user-facing text.
  const IDENTIFIER_KEYS = new Set([
    "id", "lineId", "nodeId", "startNodeId", "evidenceId", "evidenceIds", "claimId", "objectId",
    "npcId", "messageId", "graphId", "interactableId", "callId", "next", "end", "flag", "decision",
    "kind", "via", "method", "debriefTag", "stance", "status", "source", "speaker", "channel",
    "honesty", "direction", "type", "reveals", "requires", "warningSigns",
  ]);

  // Data the lint checks but that is never translated: fictional phone numbers and the reserved
  // official domain are shown verbatim in every locale.
  const VERBATIM_DATA_KEYS = new Set(["number", "officialWebsite"]);

  it("covers every text string the English content-lint walker finds", () => {
    const texts = new Set(ENTRIES.map((entry) => entry.text));
    const uncovered = collectStrings(CHAPTER_1_SCENARIO)
      .filter((found) => !IDENTIFIER_KEYS.has(found.key) && !VERBATIM_DATA_KEYS.has(found.key))
      .filter((found) => !texts.has(found.value))
      .map((found) => `${found.path} = ${JSON.stringify(found.value)}`);
    expect(uncovered).toEqual([]);
  });
});
