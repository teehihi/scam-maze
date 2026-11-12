// Content lint for Chapter 1 Scenario_Data (Requirements 10.1, 11.1, 14.6, 16.1-16.5, 18.1).
// Walks every string in CHAPTER_1_SCENARIO and checks the safety and audience rules: reserved
// domains and IP addresses, fictional `+000` phone numbers, no currency, no "safe", no blaming
// wording and no emoji. It also checks the evidence mix and the scam-call paths.

import { describe, expect, it } from "vitest";

import type { DialogueGraph, Effect } from "../types";
import { CHAPTER_1_SCENARIO } from "./scenario";

interface FoundString {
  /** Dotted path inside the scenario, for readable failure messages. */
  path: string;
  /** Name of the property that holds the string (array items use the array's property name). */
  key: string;
  value: string;
}

function collectStrings(value: unknown, path = "scenario", key = ""): FoundString[] {
  if (typeof value === "string") return [{ path, key, value }];
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => collectStrings(item, `${path}[${i}]`, key));
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => collectStrings(v, `${path}.${k}`, k));
  }
  return [];
}

/**
 * Properties that hold identifiers or enum values, not user-facing text. IDs such as
 * `ev.bank-card` look like domain names, so the domain check skips them.
 */
const IDENTIFIER_KEYS = new Set([
  "id",
  "lineId",
  "nodeId",
  "startNodeId",
  "evidenceId",
  "evidenceIds",
  "claimId",
  "objectId",
  "npcId",
  "messageId",
  "graphId",
  "interactableId",
  "callId",
  "next",
  "end",
  "flag",
  "decision",
  "kind",
  "via",
  "method",
  "debriefTag",
  "stance",
  "status",
  "source",
  "speaker",
  "channel",
  "honesty",
  "direction",
  "type",
  "reveals",
  "requires",
  "warningSigns",
]);

const ALL_STRINGS = collectStrings(CHAPTER_1_SCENARIO);
const TEXT_STRINGS = ALL_STRINGS.filter((s) => !IDENTIFIER_KEYS.has(s.key));

function findAll(pattern: RegExp, strings: FoundString[]): Array<{ path: string; match: string }> {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const global = new RegExp(pattern.source, flags);
  return strings.flatMap((s) =>
    Array.from(s.value.matchAll(global), (m) => ({ path: s.path, match: m[0] })),
  );
}

const DOMAIN_PATTERN =
  /\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+\b/gi;
const RESERVED_DOMAIN = /(?:\.test|\.example|\.invalid|^example\.com)$/i;

const IP_PATTERN = /\b\d{1,3}(?:\.\d{1,3}){3}\b/g;
const DOCUMENTATION_IP = /^(?:192\.0\.2|198\.51\.100|203\.0\.113)\.\d{1,3}$/;

/** A `+` followed by digits, or any run of seven or more digits (with spaces or dashes). */
const PHONE_PATTERN = /\+\d[\d \-]*\d|\b\d(?:[ \-]?\d){6,}\b/g;
const FICTIONAL_PHONE = /^\+000 /;

const CURRENCY_SYMBOL = /\p{Sc}/u;
const ISO_CURRENCY_CODES = [
  "USD", "EUR", "GBP", "JPY", "CNY", "VND", "AUD", "CAD", "CHF", "INR", "SGD", "THB", "KRW",
  "HKD", "NZD", "SEK", "NOK", "DKK", "MYR", "IDR", "PHP", "BRL", "MXN", "RUB", "ZAR", "TWD",
];
const ISO_CURRENCY = new RegExp(`\\b(?:${ISO_CURRENCY_CODES.join("|")})\\b`);

const SAFE_WORD = /\bsafe\b/i;

const BLAMING_PHRASES = [
  /\byour fault\b/i,
  /\byou should have known\b/i,
  /\bshould have known better\b/i,
  /\bstupid\b/i,
  /\bcareless\b/i,
  /\bgullible\b/i,
  /\bnaive\b/i,
  /\bfoolish\b/i,
  /\bidiot/i,
  /\bfell for\b/i,
];

const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}]/u;

describe("Chapter 1 content lint", () => {
  it("collects the scenario's strings", () => {
    // Guards the walker itself: an empty walk would make every check below pass.
    expect(ALL_STRINGS.length).toBeGreaterThan(100);
    expect(TEXT_STRINGS.some((s) => s.value.includes("northgate-secure-verify.invalid"))).toBe(
      true,
    );
  });

  it("uses only reserved domains", () => {
    const domains = findAll(DOMAIN_PATTERN, TEXT_STRINGS).filter(({ match }) => {
      // Skip numbers such as "4.5"; a domain ends in a label with letters.
      const tld = match.split(".").pop() ?? "";
      return /[a-z]/i.test(tld) && tld.length >= 2;
    });
    expect(domains.map((d) => d.match)).toContain("northgate.example");
    expect(domains.filter(({ match }) => !RESERVED_DOMAIN.test(match))).toEqual([]);
  });

  it("uses only documentation IP addresses", () => {
    const ips = findAll(IP_PATTERN, ALL_STRINGS);
    expect(ips.filter(({ match }) => !DOCUMENTATION_IP.test(match))).toEqual([]);
  });

  it("uses only fictional phone numbers starting with +000", () => {
    const numbers = findAll(PHONE_PATTERN, ALL_STRINGS);
    expect(numbers.map((n) => n.match)).toContain("+000 555 0142");
    expect(numbers.map((n) => n.match)).toContain("+000 555 0100");
    expect(numbers.filter(({ match }) => !FICTIONAL_PHONE.test(match))).toEqual([]);
    for (const call of Object.values(CHAPTER_1_SCENARIO.calls)) {
      expect(call.number).toMatch(FICTIONAL_PHONE);
    }
    for (const contact of CHAPTER_1_SCENARIO.phone.contacts) {
      expect(contact.number).toMatch(FICTIONAL_PHONE);
    }
  });

  it("contains no currency symbols or ISO currency codes", () => {
    expect(ALL_STRINGS.filter((s) => CURRENCY_SYMBOL.test(s.value)).map((s) => s.path)).toEqual(
      [],
    );
    expect(ALL_STRINGS.filter((s) => ISO_CURRENCY.test(s.value)).map((s) => s.path)).toEqual([]);
  });

  it('never uses the word "safe"', () => {
    expect(ALL_STRINGS.filter((s) => SAFE_WORD.test(s.value)).map((s) => s.path)).toEqual([]);
  });

  it("contains no blaming wording", () => {
    const hits = ALL_STRINGS.flatMap((s) =>
      BLAMING_PHRASES.filter((p) => p.test(s.value)).map((p) => `${s.path}: ${p.source}`),
    );
    expect(hits).toEqual([]);
  });

  it("contains no emoji", () => {
    expect(ALL_STRINGS.filter((s) => EMOJI.test(s.value)).map((s) => s.path)).toEqual([]);
  });

  it('names no bank other than "Northgate Bank"', () => {
    const banks = findAll(/\b[A-Z][A-Za-z]+ Bank\b/g, TEXT_STRINGS);
    expect(banks.filter(({ match }) => match !== "Northgate Bank")).toEqual([]);
  });

  it("has at least four evidence items with both physical and device sources", () => {
    const items = Object.values(CHAPTER_1_SCENARIO.evidence);
    expect(items.length).toBeGreaterThanOrEqual(4);
    const sources = new Set(items.map((item) => item.source));
    expect(sources.size).toBeGreaterThanOrEqual(2);
    expect(sources.has("physical")).toBe(true);
    expect(sources.has("device")).toBe(true);
  });

  it("gives the scam call at least three distinct paths to end nodes", () => {
    const graph = CHAPTER_1_SCENARIO.dialogues["dlg.scam-call"];
    const paths = enumeratePaths(graph);
    expect(new Set(paths.map((p) => p.key)).size).toBeGreaterThanOrEqual(3);

    // The three required paths (Requirement 10.1): share the code, challenge the caller, and end
    // the call to verify.
    const setsFlag = (p: PathInfo, flag: string): boolean =>
      p.effects.some((e) => e.kind === "setFlag" && e.flag === flag);
    expect(paths.some((p) => setsFlag(p, "code_shared"))).toBe(true);
    expect(paths.some((p) => setsFlag(p, "number_challenged"))).toBe(true);
    expect(paths.some((p) => setsFlag(p, "scam1_hung_up_to_verify"))).toBe(true);
  });
});

interface PathInfo {
  /** Option IDs joined in order; unique per path. */
  key: string;
  effects: Effect[];
}

/** Every simple path (no repeated node) from the start node to an end. Conditions are ignored. */
function enumeratePaths(graph: DialogueGraph): PathInfo[] {
  const paths: PathInfo[] = [];
  const walk = (nodeId: string, visited: Set<string>, options: string[], effects: Effect[]) => {
    const node = graph.nodes[nodeId];
    if (!node) return;
    const nodeEffects = [...effects, ...(node.onEnter ?? [])];
    if (node.end) {
      paths.push({ key: options.join(" > "), effects: nodeEffects });
      return;
    }
    for (const option of node.options) {
      const nextOptions = [...options, option.id];
      const nextEffects = [...nodeEffects, ...(option.effects ?? [])];
      if (typeof option.next !== "string") {
        paths.push({ key: nextOptions.join(" > "), effects: nextEffects });
      } else if (!visited.has(option.next)) {
        walk(option.next, new Set([...visited, option.next]), nextOptions, nextEffects);
      }
    }
  };
  walk(graph.startNodeId, new Set([graph.startNodeId]), [], []);
  return paths;
}
