import { describe, expect, it } from "vitest";
import { LOCALE_LABELS, SUPPORTED_LOCALES } from "./locales";
import { NAMESPACES, resources } from "./resources";

// These checks walk every dictionary at run time, so they also cover text added by later tasks.

type Dictionary = { readonly [key: string]: unknown };

/** Flattens a dictionary into `dotted.key → text`. Non-string leaves are reported as errors. */
function flatten(dictionary: Dictionary, prefix = "", out = new Map<string, string>(), errors: string[] = []) {
  for (const [key, value] of Object.entries(dictionary)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else if (value !== null && typeof value === "object") flatten(value as Dictionary, path, out, errors);
    else errors.push(path);
  }
  return { texts: out, errors };
}

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

function pluralBaseKey(key: string): string {
  return key.replace(PLURAL_SUFFIX, "");
}

/** Interpolation variable names, for example `{{count}}` or `{{value, number}}` → `count`, `value`. */
function variablesOf(text: string): string[] {
  return [...text.matchAll(/\{\{\s*-?\s*([^\s},]+)[^}]*\}\}/g)].map((match) => match[1]!);
}

/** Groups texts by Plural_Base_Key and collects the variables used in any plural form. */
function variablesByBaseKey(texts: Map<string, string>): Map<string, string[]> {
  const result = new Map<string, Set<string>>();
  for (const [key, text] of texts) {
    const base = pluralBaseKey(key);
    const set = result.get(base) ?? new Set<string>();
    for (const name of variablesOf(text)) set.add(name);
    result.set(base, set);
  }
  return new Map([...result].map(([key, set]) => [key, [...set].sort()]));
}

function dictionary(locale: (typeof SUPPORTED_LOCALES)[number], ns: (typeof NAMESPACES)[number]): Dictionary {
  return resources[locale][ns] as Dictionary;
}

describe("resources", () => {
  it("registers exactly the declared namespaces for every locale", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(resources[locale]).sort()).toEqual([...NAMESPACES].sort());
    }
  });

  describe.each(NAMESPACES)("namespace %s", (ns) => {
    const en = flatten(dictionary("en", ns));
    const vi = flatten(dictionary("vi", ns));

    it("has only string leaves", () => {
      expect(en.errors).toEqual([]);
      expect(vi.errors).toEqual([]);
    });

    it("has the same Plural_Base_Keys in en and vi", () => {
      const enKeys = [...new Set([...en.texts.keys()].map(pluralBaseKey))].sort();
      const viKeys = [...new Set([...vi.texts.keys()].map(pluralBaseKey))].sort();
      expect({ missingInVi: enKeys.filter((key) => !viKeys.includes(key)) }).toEqual({ missingInVi: [] });
      expect({ extraInVi: viKeys.filter((key) => !enKeys.includes(key)) }).toEqual({ extraInVi: [] });
    });

    it("uses the same {{variables}} per key in en and vi", () => {
      const enVariables = variablesByBaseKey(en.texts);
      const viVariables = variablesByBaseKey(vi.texts);
      const mismatches = [...enVariables]
        .filter(([key, names]) => viVariables.has(key) && viVariables.get(key)!.join(",") !== names.join(","))
        .map(([key, names]) => `${ns}:${key} en={${names.join(",")}} vi={${viVariables.get(key)!.join(",")}}`);
      expect(mismatches).toEqual([]);
    });

    it("has no empty or whitespace-only text", () => {
      const empty = [
        ...[...en.texts].filter(([, text]) => text.trim() === "").map(([key]) => `en ${ns}:${key}`),
        ...[...vi.texts].filter(([, text]) => text.trim() === "").map(([key]) => `vi ${ns}:${key}`),
      ];
      expect(empty).toEqual([]);
    });

    it("stores every vi text in Unicode NFC", () => {
      const notNfc = [...vi.texts].filter(([, text]) => text !== text.normalize("NFC")).map(([key]) => `${ns}:${key}`);
      expect(notNfc).toEqual([]);
    });

    it("contains no emoji", () => {
      const emoji = /[\p{Emoji_Presentation}\uFE0F]/u;
      const withEmoji = [
        ...[...en.texts].filter(([, text]) => emoji.test(text)).map(([key]) => `en ${ns}:${key}`),
        ...[...vi.texts].filter(([, text]) => emoji.test(text)).map(([key]) => `vi ${ns}:${key}`),
      ];
      expect(withEmoji).toEqual([]);
    });
  });
});

/** Area files of the composed namespaces, for example `./locales/en/chapter1/hud.ts`. */
const areaModules = import.meta.glob<{ default: Dictionary }>("./locales/*/{chapter1,worlds}/*.ts", { eager: true });

describe("composed namespaces", () => {
  const composed = ["chapter1", "worlds"] as const;

  describe.each(SUPPORTED_LOCALES.flatMap((locale) => composed.map((ns) => [locale, ns] as const)))(
    "%s %s",
    (locale, ns) => {
      const areas = Object.entries(areaModules)
        .filter(([path]) => path.startsWith(`./locales/${locale}/${ns}/`) && !path.endsWith("/index.ts"))
        .map(([path, module]) => ({ path, keys: Object.keys(module.default) }));

      it("is composed from area files", () => {
        expect(areas.length).toBeGreaterThan(0);
      });

      it("has disjoint top-level key groups across area files", () => {
        const owners = new Map<string, string[]>();
        for (const area of areas) {
          for (const key of area.keys) owners.set(key, [...(owners.get(key) ?? []), area.path]);
        }
        const collisions = [...owners].filter(([, paths]) => paths.length > 1).map(([key, paths]) => `${key}: ${paths.join(", ")}`);
        expect(collisions).toEqual([]);
      });

      it("contains exactly the top-level keys of its area files", () => {
        const fromAreas = areas.flatMap((area) => area.keys).sort();
        expect(Object.keys(dictionary(locale, ns)).sort()).toEqual(fromAreas);
      });
    },
  );
});

describe("LOCALE_LABELS", () => {
  it("names each locale in its own language", () => {
    expect(LOCALE_LABELS).toEqual({ en: "English", vi: "Tiếng Việt" });
    expect(LOCALE_LABELS.vi).toBe(LOCALE_LABELS.vi.normalize("NFC"));
  });
});
