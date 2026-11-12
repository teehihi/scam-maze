// Module boundary test for the voice layer (Requirements 5.13, 16.3).
// Reads every `.ts` file under `game/voice/` and checks that:
//   1. no file imports React, react-dom, Three.js, R3F, Drei, i18next, Zustand or Dexie;
//   2. no non-test file imports the `src/i18n/` locale module;
//   3. relative imports stay inside `game/voice/` or `game/narrative/` (plus one pure leaf file);
//   4. only `webAudioEngine.ts` and `devSpeechPreview.ts` touch audio or speech globals;
//   5. no file under `game/narrative/` imports `game/voice/` or touches audio or speech globals.
// Same scanner approach as `game/narrative/boundaries.test.ts`.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const VOICE_DIR = import.meta.dirname;
const SRC_DIR = resolve(VOICE_DIR, "../..");
const NARRATIVE_DIR = resolve(VOICE_DIR, "../narrative");

/** Package names (exact or with a subpath) that the voice layer must never import. */
const FORBIDDEN_EXACT = [
  "react",
  "react-dom",
  "three",
  "zustand",
  "dexie",
  "i18next",
  "react-i18next",
] as const;
const FORBIDDEN_PREFIXES = ["@react-three/", "@dimforge/rapier"] as const;

/** Bare specifiers allowed in non-test voice files. */
const NON_TEST_BARE_ALLOWLIST = ["@scammaze/shared-types"] as const;

/**
 * Pure leaf files outside `game/voice/` and `game/narrative/` that voice files may import,
 * relative to `src/`. `config/assetPaths.ts` only exports URL constants and has no imports.
 */
const NON_TEST_OUTSIDE_ALLOWLIST = ["config/assetPaths.ts"] as const;
const TEST_OUTSIDE_ALLOWLIST = [
  ...NON_TEST_OUTSIDE_ALLOWLIST,
  "test/seededRandom.ts",
  "test/chapterRuns.ts",
  "test/callStates.ts",
  "test/fakeAudioPort.ts",
] as const;

/** Voice tests may read the display-only Vietnamese overlay data (no i18next involved). */
const TEST_I18N_ALLOWED_PREFIX = "i18n/narrative/";

/** The only non-test files that may reference audio or speech globals (paths relative to `voice/`). */
const AUDIO_API_FILES = ["webAudioEngine.ts", "devSpeechPreview.ts"] as const;

const I18N_DIR = "i18n";

const AUDIO_API_PATTERN =
  /\b(?:AudioContext|webkitAudioContext|OfflineAudioContext|AudioWorklet\w*|HTMLAudioElement|speechSynthesis|SpeechSynthesis\w*)\b|\bnew\s+Audio\s*\(/g;

const SPECIFIER_PATTERNS: readonly RegExp[] = [
  /\b(?:import|export)\s[^'"`;]*?\bfrom\s*(['"])([^'"]+)\1/g,
  /\bimport\s*(['"])([^'"]+)\1/g,
  /\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g,
  /\brequire\s*\(\s*(['"])([^'"]+)\1\s*\)/g,
];

function extractSpecifiers(source: string): string[] {
  const found = new Set<string>();
  for (const pattern of SPECIFIER_PATTERNS) {
    for (const match of source.matchAll(pattern)) found.add(match[2]);
  }
  return [...found];
}

/** Removes block comments and line comments so doc text that names an API is not a use of it. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:'"\w])\/\/[^\n]*/g, "$1");
}

function findAudioApis(source: string): string[] {
  return [...new Set([...stripComments(source).matchAll(AUDIO_API_PATTERN)].map((m) => m[0]))].sort();
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
  return candidates.find((candidate) => existsSync(candidate) && /\.tsx?$/.test(candidate)) ?? base;
}

const toSrcPath = (file: string) => relative(SRC_DIR, file).split(sep).join("/");
const isInside = (dir: string, file: string) => !relative(dir, file).startsWith("..");
const isTestFile = (file: string) => file.endsWith(".test.ts");
const isInI18nDir = (srcPath: string) => srcPath === I18N_DIR || srcPath.startsWith(`${I18N_DIR}/`);

/** The src-relative target of a relative or `@/` specifier, or null for bare packages. */
function targetSrcPath(fromFile: string, specifier: string): string | null {
  if (specifier.startsWith("@/")) return specifier.slice(2);
  if (!specifier.startsWith(".")) return null;
  return toSrcPath(resolve(dirname(fromFile), specifier));
}

function isI18nModuleSpecifier(fromFile: string, specifier: string): boolean {
  const target = targetSrcPath(fromFile, specifier);
  return target !== null && isInI18nDir(target);
}

function isVoiceModuleSpecifier(fromFile: string, specifier: string): boolean {
  const target = targetSrcPath(fromFile, specifier);
  return target !== null && (target === "game/voice" || target.startsWith("game/voice/"));
}

/** Import violations for one file under `game/voice/`. */
function checkVoiceImports(file: string, source: string): string[] {
  const violations: string[] = [];
  const label = toSrcPath(file);
  const test = isTestFile(file);
  const outsideAllowlist: readonly string[] = test ? TEST_OUTSIDE_ALLOWLIST : NON_TEST_OUTSIDE_ALLOWLIST;

  for (const specifier of extractSpecifiers(source)) {
    if (isForbiddenSpecifier(specifier)) {
      violations.push(`${label}: forbidden import "${specifier}"`);
      continue;
    }
    if (isI18nModuleSpecifier(file, specifier)) {
      const target = targetSrcPath(file, specifier) ?? "";
      if (!(test && target.startsWith(TEST_I18N_ALLOWED_PREFIX))) {
        violations.push(`${label}: imports the locale module "${specifier}" (src/${I18N_DIR}/)`);
      }
      continue;
    }
    if (!specifier.startsWith(".") && !specifier.startsWith("@/")) {
      const allowed = test || (NON_TEST_BARE_ALLOWLIST as readonly string[]).includes(specifier);
      if (!allowed) violations.push(`${label}: package import "${specifier}" is not allowed in the voice layer`);
      continue;
    }
    const target = specifier.startsWith("@/") ? resolve(SRC_DIR, specifier.slice(2)) : resolveRelative(file, specifier);
    if (isInside(VOICE_DIR, target) || isInside(NARRATIVE_DIR, target)) continue;
    const targetLabel = toSrcPath(target);
    if (!outsideAllowlist.includes(targetLabel) && !(test && targetLabel.startsWith(TEST_I18N_ALLOWED_PREFIX))) {
      violations.push(`${label}: relative import "${specifier}" leaves game/voice/ (${targetLabel})`);
      continue;
    }
    if (!existsSync(target)) continue;
    for (const inner of extractSpecifiers(readFileSync(target, "utf8"))) {
      if (isForbiddenSpecifier(inner)) {
        violations.push(`${label}: imports ${targetLabel}, which imports forbidden "${inner}"`);
      }
    }
  }
  return violations;
}

/** Audio and speech global violations for one file under `game/voice/`. */
function checkAudioApis(file: string, source: string): string[] {
  const name = relative(VOICE_DIR, file).split(sep).join("/");
  const owner = name.replace(/\.test\.ts$/, ".ts");
  if ((AUDIO_API_FILES as readonly string[]).includes(owner)) return [];
  return findAudioApis(source).map((api) => `${toSrcPath(file)}: touches audio or speech global "${api}"`);
}

/** Violations for one file under `game/narrative/`: voice imports and audio globals. */
function checkNarrativeFile(file: string, source: string): string[] {
  const label = toSrcPath(file);
  const violations = extractSpecifiers(source)
    .filter((specifier) => isVoiceModuleSpecifier(file, specifier))
    .map((specifier) => `${label}: imports the voice layer "${specifier}"`);
  for (const api of findAudioApis(source)) violations.push(`${label}: touches audio or speech global "${api}"`);
  return violations;
}

const readSource = (file: string) => readFileSync(file, "utf8");

describe("Voice layer module boundaries", () => {
  // Upper-case keywords keep these fixtures invisible to the scan of this file itself.
  const fix = (text: string) =>
    text.replace(/IMPORT/g, "import").replace(/EXPORT/g, "export").replace(/REQUIRE/g, "require");

  it("rejects forbidden imports in a fixture (self-check)", () => {
    const fixture = fix(
      [
        'IMPORT { useState } from "react";',
        'IMPORT { createRoot } from "react-dom/client";',
        "IMPORT type { Vector3 } from 'three';",
        'IMPORT { Canvas } from "@react-three/fiber";',
        'IMPORT { Html } from "@react-three/drei";',
        'IMPORT i18n from "i18next";',
        'IMPORT { useTranslation } from "react-i18next";',
        'EXPORT { create } from "zustand/vanilla";',
        'const Dexie = REQUIRE("dexie");',
        'const lazy = await IMPORT("three/examples/jsm/loaders/GLTFLoader.js");',
        'IMPORT { ok } from "./mixPlan";',
        'IMPORT { reactive } from "reactive-lib";',
        'IMPORT { lookalike } from "i18next-like";',
      ].join("\n"),
    );
    const forbidden = extractSpecifiers(fixture).filter(isForbiddenSpecifier).sort();
    expect(forbidden).toEqual(
      [
        "@react-three/drei",
        "@react-three/fiber",
        "dexie",
        "i18next",
        "react",
        "react-dom/client",
        "react-i18next",
        "three",
        "three/examples/jsm/loaders/GLTFLoader.js",
        "zustand/vanilla",
      ].sort(),
    );
  });

  it("reports violations for a bad voice fixture and none for a good one (self-check)", () => {
    const file = join(VOICE_DIR, "fixture.ts");
    const bad = fix(
      [
        'IMPORT { useState } from "react";',
        'IMPORT i18n from "../../i18n/init";',
        'IMPORT { t } from "@/i18n";',
        'IMPORT { lib } from "left-pad";',
        'IMPORT { store } from "../../app/store";',
      ].join("\n"),
    );
    const violations = checkVoiceImports(file, bad);
    expect(violations).toHaveLength(5);
    expect(violations.some((v) => v.includes('forbidden import "react"'))).toBe(true);
    expect(violations.filter((v) => v.includes("locale module"))).toHaveLength(2);
    expect(violations.some((v) => v.includes('package import "left-pad"'))).toBe(true);
    expect(violations.some((v) => v.includes("leaves game/voice/"))).toBe(true);

    const good = fix(
      [
        'IMPORT type { GameLocale } from "@scammaze/shared-types";',
        'IMPORT type { Tone } from "../narrative/chapter1/ids";',
        'IMPORT { fnv1a32 } from "./hash";',
        'IMPORT { CHAPTER1_VOICE_BASE } from "../../config/assetPaths";',
      ].join("\n"),
    );
    expect(checkVoiceImports(file, good)).toEqual([]);
  });

  it("rejects audio and speech globals outside the two allowed files (self-check)", () => {
    const file = join(VOICE_DIR, "mixPlan.ts");
    const bad = [
      "const ctx = new AudioContext();",
      "const legacy = globalThis.webkitAudioContext;",
      "window.speechSynthesis.speak(new SpeechSynthesisUtterance('x'));",
      "const el = new Audio('a.mp3');",
    ].join("\n");
    expect(checkAudioApis(file, bad)).toHaveLength(5);
    expect(checkAudioApis(join(VOICE_DIR, "webAudioEngine.ts"), bad)).toEqual([]);
    expect(checkAudioApis(join(VOICE_DIR, "devSpeechPreview.ts"), bad)).toEqual([]);
    // Comments and unrelated names are not uses.
    const harmless = "// no AudioContext here\n/* speechSynthesis */\nconst audioPort = 1; const url = 'https://x.test/a';";
    expect(checkAudioApis(file, harmless)).toEqual([]);
  });

  it("rejects narrative files that import the voice layer or audio globals (self-check)", () => {
    const file = join(NARRATIVE_DIR, "fixture.ts");
    expect(isVoiceModuleSpecifier(file, "../voice/mixPlan")).toBe(true);
    expect(isVoiceModuleSpecifier(file, "../voice")).toBe(true);
    expect(isVoiceModuleSpecifier(file, "@/game/voice/audioPort")).toBe(true);
    expect(isVoiceModuleSpecifier(file, "./voiceLines")).toBe(false);
    expect(isVoiceModuleSpecifier(file, "../voicemail/x")).toBe(false);
    const bad = fix('IMPORT { selectClip } from "../voice/selectClip";\nconst c = new AudioContext();');
    expect(checkNarrativeFile(file, bad)).toHaveLength(2);
    expect(checkNarrativeFile(file, fix('IMPORT { x } from "./types";'))).toEqual([]);
  });

  const voiceFiles = listTsFiles(VOICE_DIR);
  const narrativeFiles = listTsFiles(NARRATIVE_DIR);

  it("finds the voice and narrative source files", () => {
    expect(voiceFiles.some((file) => file.endsWith(`${sep}webAudioEngine.ts`))).toBe(true);
    expect(voiceFiles.some((file) => file.endsWith(`${sep}VoiceDialoguePlayer.ts`))).toBe(true);
    expect(voiceFiles.length).toBeGreaterThan(10);
    expect(narrativeFiles.length).toBeGreaterThan(10);
  });

  it("no voice file imports React, react-dom, Three.js, R3F, Drei, i18next, Zustand, Dexie or src/i18n/", () => {
    const self = join(VOICE_DIR, "boundaries.test.ts");
    expect(voiceFiles.filter((f) => f !== self).flatMap((f) => checkVoiceImports(f, readSource(f)))).toEqual([]);
  });

  it("only webAudioEngine and devSpeechPreview touch audio or speech globals", () => {
    const self = join(VOICE_DIR, "boundaries.test.ts");
    expect(voiceFiles.filter((f) => f !== self).flatMap((f) => checkAudioApis(f, readSource(f)))).toEqual([]);
  });

  it("no narrative file imports the voice layer or touches audio or speech globals", () => {
    const self = join(NARRATIVE_DIR, "boundaries.test.ts");
    expect(narrativeFiles.filter((f) => f !== self).flatMap((f) => checkNarrativeFile(f, readSource(f)))).toEqual([]);
  });
});
