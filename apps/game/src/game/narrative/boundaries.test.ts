// Module boundary test for the Chapter_Core (Requirement 5.7).
// Reads every `.ts` file under `game/narrative/` and fails on imports of React, Three.js,
// R3F/Drei, Rapier, Zustand, Dexie, i18next or react-i18next, and on any import of the
// `src/i18n/` locale module. Relative imports that leave `game/narrative/` must point to an
// allowlisted file, and that file is checked one level deep for the same packages.
// See .kiro/specs/chapter-01-the-urgent-call/design.md, "Module boundaries", and
// .kiro/specs/game-i18n-en-vi/requirements.md, Requirement 10.2.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const NARRATIVE_DIR = import.meta.dirname;
const SRC_DIR = resolve(NARRATIVE_DIR, "../..");

/** Package names (exact or with a subpath) and prefixes the core must never import. */
const FORBIDDEN_EXACT = [
  "react",
  "react-dom",
  "three",
  "zustand",
  "dexie",
  // The I18n_Module stays outside the core (game-i18n-en-vi, Requirement 10.2).
  "i18next",
  "react-i18next",
] as const;
const FORBIDDEN_PREFIXES = ["@react-three/", "@dimforge/rapier"] as const;

/** The app's locale module, relative to `src/`. Narrative files must never import it. */
const I18N_DIR = "i18n";

/** Bare specifiers allowed in non-test narrative files (design: "imports only TypeScript and shared-types"). */
const NON_TEST_BARE_ALLOWLIST = ["@scammaze/shared-types"] as const;

/** Files outside `game/narrative/` that narrative files may import, relative to `src/`. */
const NON_TEST_OUTSIDE_ALLOWLIST = ["game/scenes/MainMenuScene/streetPlayArea.ts"] as const;
const TEST_OUTSIDE_ALLOWLIST = [
  ...NON_TEST_OUTSIDE_ALLOWLIST,
  "test/seededRandom.ts",
  "test/chapterRuns.ts",
] as const;

const SPECIFIER_PATTERNS: readonly RegExp[] = [
  // import x from "a"; import { x } from "a"; export { x } from "a"; import type ... from "a"
  /\b(?:import|export)\s[^'"`;]*?\bfrom\s*(['"])([^'"]+)\1/g,
  // side-effect import: import "a";
  /\bimport\s*(['"])([^'"]+)\1/g,
  // dynamic import("a")
  /\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g,
  // require("a")
  /\brequire\s*\(\s*(['"])([^'"]+)\1\s*\)/g,
];

function extractSpecifiers(source: string): string[] {
  const found = new Set<string>();
  for (const pattern of SPECIFIER_PATTERNS) {
    for (const match of source.matchAll(pattern)) found.add(match[2]);
  }
  return [...found];
}

function isForbiddenSpecifier(specifier: string): boolean {
  return (
    FORBIDDEN_EXACT.some((name) => specifier === name || specifier.startsWith(`${name}/`)) ||
    FORBIDDEN_PREFIXES.some((prefix) => specifier.startsWith(prefix))
  );
}

function listTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listTsFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".ts")) files.push(full);
  }
  return files.sort();
}

function resolveRelative(fromFile: string, specifier: string): string {
  const base = resolve(dirname(fromFile), specifier);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")];
  return candidates.find((candidate) => existsSync(candidate) && candidate.match(/\.tsx?$/)) ?? base;
}

const toSrcPath = (file: string) => relative(SRC_DIR, file).split(sep).join("/");
const isInI18nDir = (srcPath: string) => srcPath === I18N_DIR || srcPath.startsWith(`${I18N_DIR}/`);

/**
 * True when `specifier`, imported from `fromFile`, points into `src/i18n/`, either through a
 * relative path or through the `@/` alias that Vite maps to `src/`.
 */
function isI18nModuleSpecifier(fromFile: string, specifier: string): boolean {
  if (specifier.startsWith("@/")) return isInI18nDir(specifier.slice(2));
  if (!specifier.startsWith(".")) return false;
  return isInI18nDir(toSrcPath(resolve(dirname(fromFile), specifier)));
}
const isInsideNarrative = (file: string) => !relative(NARRATIVE_DIR, file).startsWith("..");
const isTestFile = (file: string) => file.endsWith(".test.ts");

/** Returns human-readable violations for one narrative file. */
function checkFile(file: string): string[] {
  const violations: string[] = [];
  const label = toSrcPath(file);
  const test = isTestFile(file);
  const outsideAllowlist: readonly string[] = test ? TEST_OUTSIDE_ALLOWLIST : NON_TEST_OUTSIDE_ALLOWLIST;

  for (const specifier of extractSpecifiers(readFileSync(file, "utf8"))) {
    if (isForbiddenSpecifier(specifier)) {
      violations.push(`${label}: forbidden import "${specifier}"`);
      continue;
    }
    if (isI18nModuleSpecifier(file, specifier)) {
      violations.push(`${label}: imports the locale module "${specifier}" (src/${I18N_DIR}/)`);
      continue;
    }
    if (!specifier.startsWith(".")) {
      if (!test && !(NON_TEST_BARE_ALLOWLIST as readonly string[]).includes(specifier)) {
        violations.push(`${label}: package import "${specifier}" is not allowed in the core`);
      }
      continue;
    }
    const target = resolveRelative(file, specifier);
    if (isInsideNarrative(target)) continue;
    const targetLabel = toSrcPath(target);
    if (!outsideAllowlist.includes(targetLabel)) {
      violations.push(`${label}: relative import "${specifier}" leaves game/narrative/ (${targetLabel})`);
      continue;
    }
    // One level deep: the allowlisted file must not import a forbidden package itself.
    for (const inner of extractSpecifiers(readFileSync(target, "utf8"))) {
      if (isForbiddenSpecifier(inner)) {
        violations.push(`${label}: imports ${targetLabel}, which imports forbidden "${inner}"`);
      }
    }
  }
  return violations;
}

describe("Chapter_Core module boundaries", () => {
  it("detects forbidden imports in a fixture (self-check)", () => {
    const fixture = [
      'IMPORT { useState } from "react";',
      "IMPORT type { Vector3 } from 'three';",
      'IMPORT { Canvas } from "@react-three/fiber";',
      'EXPORT { create } from "zustand/vanilla";',
      'const rapier = await IMPORT("@dimforge/rapier3d-compat");',
      'const Dexie = REQUIRE("dexie");',
      'IMPORT "react-dom/client";',
      'IMPORT { ok } from "./types";',
      'IMPORT { reactive } from "reactive-lib";',
      'IMPORT i18n from "i18next";',
      'IMPORT { useTranslation } from "react-i18next";',
      'IMPORT { initReactI18next } from "react-i18next/initReactI18next";',
      'IMPORT { lookalike } from "i18next-like";',
    ]
      .join("\n")
      // Upper-case keywords keep this fixture invisible to the scan of this file itself.
      .replace(/IMPORT/g, "import")
      .replace(/EXPORT/g, "export")
      .replace(/REQUIRE/g, "require");
    const forbidden = extractSpecifiers(fixture).filter(isForbiddenSpecifier).sort();
    expect(forbidden).toEqual(
      [
        "@dimforge/rapier3d-compat",
        "@react-three/fiber",
        "dexie",
        "i18next",
        "react",
        "react-dom/client",
        "react-i18next",
        "react-i18next/initReactI18next",
        "three",
        "zustand/vanilla",
      ].sort(),
    );
  });

  it("detects imports of the src/i18n/ locale module (self-check)", () => {
    const from = join(NARRATIVE_DIR, "example.ts");
    expect(isI18nModuleSpecifier(from, "../../i18n")).toBe(true);
    expect(isI18nModuleSpecifier(from, "../../i18n/init")).toBe(true);
    expect(isI18nModuleSpecifier(from, "../../i18n/narrative/chapter1.vi")).toBe(true);
    expect(isI18nModuleSpecifier(from, "@/i18n")).toBe(true);
    expect(isI18nModuleSpecifier(from, "@/i18n/format")).toBe(true);
    expect(isI18nModuleSpecifier(from, "./i18nKeys")).toBe(false);
    expect(isI18nModuleSpecifier(from, "../../i18nHelpers")).toBe(false);
    expect(isI18nModuleSpecifier(from, "@/i18nHelpers")).toBe(false);
    expect(isI18nModuleSpecifier(from, "i18next")).toBe(false);
  });

  const files = listTsFiles(NARRATIVE_DIR);

  it("finds the narrative source files", () => {
    expect(files.length).toBeGreaterThan(10);
    expect(files.some((file) => file.endsWith(`${sep}reducer.ts`))).toBe(true);
  });

  it("no narrative file imports React, Three.js, R3F, Rapier, Zustand, Dexie, i18next or src/i18n/", () => {
    expect(files.flatMap(checkFile)).toEqual([]);
  });
});
