// Vietnamese content lint (game-i18n-en-vi, task 10.1).
// Requirements 11.1-11.8 and 13.6. Applies the Chapter 1 content rules to every `vi` dictionary
// (through the resources module) and to the `vi` narrative overlay. Every check is exhaustive over
// finite data, and every failure lists the offending key as `<source> <key>: <detail>`.

import { describe, expect, it } from "vitest";
import { CHAPTER_1_INTERACTION_PROMPTS } from "../game/narrative/chapter1/interactables";
import { CHAPTER_1_SCENARIO } from "../game/narrative/chapter1/scenario";
import { narrativeTextEntries } from "../game/narrative/localize";
import { CHAPTER_1_NARRATIVE_VI } from "./narrative/chapter1.vi";
import { NAMESPACES, resources, type Namespace } from "./resources";

type Dictionary = { readonly [key: string]: unknown };

/** One Vietnamese text with the English text that has the same key (if any). */
interface LintEntry {
  /** `overlay` or a dictionary namespace. */
  source: "overlay" | Namespace;
  key: string;
  vi: string;
  en: string | undefined;
}

/** Flattens a dictionary into `dotted.key -> text`. */
function flatten(dictionary: Dictionary, prefix = "", out = new Map<string, string>()): Map<string, string> {
  for (const [key, value] of Object.entries(dictionary)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else if (value !== null && typeof value === "object") flatten(value as Dictionary, path, out);
  }
  return out;
}

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

/**
 * The English text for a Vietnamese key. Vietnamese has one plural form (`_other`) while English
 * has `_one` and `_other`, so a plural key falls back to the English `_other` form.
 */
function englishFor(en: Map<string, string>, key: string): string | undefined {
  const direct = en.get(key);
  if (direct !== undefined) return direct;
  const base = key.replace(PLURAL_SUFFIX, "");
  return base === key ? undefined : (en.get(`${base}_other`) ?? en.get(`${base}_one`));
}

const DICTIONARY_ENTRIES: LintEntry[] = NAMESPACES.flatMap((ns) => {
  const en = flatten(resources.en[ns] as Dictionary);
  const vi = flatten(resources.vi[ns] as Dictionary);
  return [...vi].map(([key, text]) => ({ source: ns, key, vi: text, en: englishFor(en, key) }));
});

const ENGLISH_NARRATIVE = new Map(
  narrativeTextEntries(CHAPTER_1_SCENARIO, CHAPTER_1_INTERACTION_PROMPTS).map((entry) => [entry.key, entry.text]),
);

const OVERLAY_ENTRIES: LintEntry[] = Object.entries(CHAPTER_1_NARRATIVE_VI).map(([key, text]) => ({
  source: "overlay",
  key,
  vi: text,
  en: ENGLISH_NARRATIVE.get(key),
}));

const ALL_ENTRIES: LintEntry[] = [...OVERLAY_ENTRIES, ...DICTIONARY_ENTRIES];

/** Requirement 11.3 scopes the reserved-domain rule to the overlay and the `chapter1` dictionary. */
const DOMAIN_SCOPED_ENTRIES = ALL_ENTRIES.filter((entry) => entry.source === "overlay" || entry.source === "chapter1");

function label(entry: LintEntry, detail?: string): string {
  return detail === undefined ? `${entry.source} ${entry.key}` : `${entry.source} ${entry.key}: ${detail}`;
}

/** Labels of the entries whose Vietnamese text matches `pattern`. */
function entriesMatching(pattern: RegExp, entries: LintEntry[] = ALL_ENTRIES): string[] {
  return entries.filter((entry) => pattern.test(entry.vi)).map((entry) => label(entry));
}

function matchesOf(pattern: RegExp, text: string): string[] {
  return Array.from(text.matchAll(pattern), (match) => match[0]);
}

// Patterns shared with the English content lint (`game/narrative/chapter1/content.test.ts`).
const DOMAIN_PATTERN = /\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+\b/gi;
const RESERVED_DOMAIN = /(?:\.test|\.example|\.invalid|^example\.com)$/i;
/** A `+` followed by digits, or any run of seven or more digits (with spaces or dashes). */
const PHONE_PATTERN = /\+\d[\d \-]*\d|\b\d(?:[ \-]?\d){6,}\b/g;
const FICTIONAL_PHONE = /^\+000 /;
const CURRENCY_SYMBOL = /\p{Sc}/u;
const ISO_CURRENCY_CODES = [
  "USD", "EUR", "GBP", "JPY", "CNY", "VND", "AUD", "CAD", "CHF", "INR", "SGD", "THB", "KRW",
  "HKD", "NZD", "SEK", "NOK", "DKK", "MYR", "IDR", "PHP", "BRL", "MXN", "RUB", "ZAR", "TWD",
];
const ISO_CURRENCY = new RegExp(`\\b(?:${ISO_CURRENCY_CODES.join("|")})\\b`);
/**
 * Emoji, flags, variation selector 16 and zero-width joiner. The copyright, registered and trade
 * mark signs are Extended_Pictographic in Unicode but are typographic text, so they are allowed.
 */
const EMOJI = /[\p{Emoji_Presentation}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}]|(?![\u00A9\u00AE\u2122])\p{Extended_Pictographic}/u;

/**
 * Domains in a text. A top-level domain is two or more letters, so numbers such as "4.5" and
 * render scales such as "0.75x" are skipped.
 */
function domainsOf(text: string): string[] {
  return matchesOf(DOMAIN_PATTERN, text)
    .map((match) => match.toLowerCase())
    .filter((match) => /^[a-z]{2,}$/.test(match.split(".").pop() ?? ""));
}

function phonesOf(text: string): string[] {
  return matchesOf(PHONE_PATTERN, text);
}

/** Labels of entries whose set of `extract` results differs between English and Vietnamese. */
function entriesWithChangedSet(extract: (text: string) => string[]): string[] {
  return ALL_ENTRIES.flatMap((entry) => {
    if (entry.en === undefined) return [];
    const en = [...new Set(extract(entry.en))].sort();
    const vi = [...new Set(extract(entry.vi))].sort();
    return en.join("|") === vi.join("|") ? [] : [label(entry, `en=[${en.join(", ")}] vi=[${vi.join(", ")}]`)];
  });
}

const BLAMING_PHRASES_VI = ["lỗi của bạn", "ngu ngốc", "cả tin", "bất cẩn", "dại dột", "nhẹ dạ"];

/** Real bank brands that could slip into a translation; the game names only "Northgate Bank". */
const REAL_BANK_NAMES = [
  "Vietcombank", "Techcombank", "BIDV", "Agribank", "VietinBank", "VPBank", "Sacombank", "TPBank",
  "MB Bank", "MBBank", "ACB", "HSBC", "Citibank", "Barclays", "Santander", "Chase",
];
const REAL_BANK = new RegExp(`\\b(?:${REAL_BANK_NAMES.join("|")})\\b`, "i");
/** An English-style bank name such as "Example Bank". */
const NAMED_BANK_EN = /\b[A-Z][A-Za-z]+ Bank\b/g;
/** "ngân hàng" followed by a capitalized name, the Vietnamese way to name a bank. */
const NAMED_BANK_VI = /[Nn]gân [Hh]àng\s+(\p{Lu}[\p{L}\d]*(?:\s+Bank)?)/gu;

describe("Vietnamese content lint: coverage", () => {
  it("walks every vi dictionary and the vi overlay", () => {
    // Guards the walker: an empty walk would make every check below pass.
    for (const ns of NAMESPACES) {
      expect(DICTIONARY_ENTRIES.some((entry) => entry.source === ns), ns).toBe(true);
    }
    expect(OVERLAY_ENTRIES.length).toBe(Object.keys(CHAPTER_1_NARRATIVE_VI).length);
    expect(OVERLAY_ENTRIES.length).toBeGreaterThan(100);
    expect(ALL_ENTRIES.some((entry) => entry.vi.includes("northgate-secure-verify.invalid"))).toBe(true);
    expect(ALL_ENTRIES.some((entry) => entry.vi.includes("+000 555 0142"))).toBe(true);
  });
});

describe("Vietnamese content lint: wording", () => {
  it('never uses "an toàn" in any letter case', () => {
    expect(entriesMatching(/an toàn/iu)).toEqual([]);
  });

  it('never uses "mã dùng một lần" (the term is "mã xác thực một lần")', () => {
    expect(entriesMatching(/mã dùng một lần/iu)).toEqual([]);
  });

  it("contains no blaming phrase", () => {
    const hits = ALL_ENTRIES.flatMap((entry) =>
      BLAMING_PHRASES_VI.filter((phrase) => entry.vi.toLocaleLowerCase("vi").includes(phrase)).map((phrase) =>
        label(entry, phrase),
      ),
    );
    expect(hits).toEqual([]);
  });

  it("contains no emoji", () => {
    expect(entriesMatching(EMOJI)).toEqual([]);
  });

  it("contains no currency symbol or ISO currency code", () => {
    expect(entriesMatching(CURRENCY_SYMBOL)).toEqual([]);
    expect(entriesMatching(ISO_CURRENCY)).toEqual([]);
  });
});

describe("Vietnamese content lint: domains and phone numbers", () => {
  it("uses only reserved domains in the overlay and the chapter1 dictionary", () => {
    const hits = DOMAIN_SCOPED_ENTRIES.flatMap((entry) =>
      domainsOf(entry.vi)
        .filter((domain) => !RESERVED_DOMAIN.test(domain))
        .map((domain) => label(entry, domain)),
    );
    expect(hits).toEqual([]);
  });

  it("uses only phone numbers starting with +000", () => {
    const hits = ALL_ENTRIES.flatMap((entry) =>
      phonesOf(entry.vi)
        .filter((number) => !FICTIONAL_PHONE.test(number))
        .map((number) => label(entry, number)),
    );
    expect(hits).toEqual([]);
  });

  // Parity applies to every source, including the teammate `worlds` dictionaries: place names
  // there are text, not domains or phone numbers, so they do not affect this check, and any domain
  // or number that a world page shows must still be copied verbatim from the English text.
  it("keeps the same set of domains per key as the English text", () => {
    expect(entriesWithChangedSet(domainsOf)).toEqual([]);
  });

  it("keeps the same set of phone numbers per key as the English text", () => {
    expect(entriesWithChangedSet(phonesOf)).toEqual([]);
  });
});

describe("Vietnamese content lint: banks", () => {
  it('keeps "Northgate Bank" verbatim wherever the English text has it', () => {
    const dropped = ALL_ENTRIES.filter(
      (entry) => entry.en?.includes("Northgate Bank") === true && !entry.vi.includes("Northgate Bank"),
    ).map((entry) => label(entry));
    expect(dropped).toEqual([]);
  });

  it('never writes "Ngân hàng Northgate"', () => {
    expect(entriesMatching(/ngân hàng northgate/iu)).toEqual([]);
  });

  it('names no bank other than "Northgate Bank"', () => {
    const hits = ALL_ENTRIES.flatMap((entry) => [
      ...matchesOf(NAMED_BANK_EN, entry.vi)
        .filter((name) => name !== "Northgate Bank")
        .map((name) => label(entry, name)),
      ...Array.from(entry.vi.matchAll(NAMED_BANK_VI), (match) => match[1]!)
        .filter((name) => name !== "Northgate Bank")
        .map((name) => label(entry, `ngân hàng ${name}`)),
      ...(REAL_BANK.test(entry.vi) ? [label(entry, entry.vi.match(REAL_BANK)![0])] : []),
    ]);
    expect(hits).toEqual([]);
  });
});
