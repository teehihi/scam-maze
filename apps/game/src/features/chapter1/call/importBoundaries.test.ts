// Import-boundary test for the 3D phone call UI (task 11.7).
// - The DOM call components (`PhoneScreenUI`, `PlayerChoiceOverlay`, `PhoneScreenHost`,
//   `CallPresentation`) and the pure modules `callLayout` and `phoneMotion`, with every file they
//   reach through relative or `@/` imports, import no `three`, `@react-three/fiber` or
//   `@react-three/drei` (Requirements 11.2, 11.9).
// - `PhoneModel3D.tsx` imports no narrative store, selectors or `useChapterState`, adds no light,
//   environment map or post-processing, and never writes the camera pose (Requirements 1.6,
//   11.3, 11.4, 11.5; Requirement 6.7 resolved by the owner-accepted design).
// - No file under `src/` points at the unoptimized phone candidates (Requirement 9.11).
// - `ChapterOneCanvas.tsx` passes `aria-hidden` to `Canvas` (Requirement 7.9).
// Modeled on `game/narrative/boundaries.test.ts`.
// See .kiro/specs/game-3d-phone-call-ui/tasks.md, task 11.7.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const CALL_DIR = import.meta.dirname;
const SRC_DIR = resolve(CALL_DIR, "../../..");

/** Entry files of the DOM-only call UI, relative to this folder. */
const DOM_ENTRIES = [
  "PhoneScreenUI.tsx",
  "PlayerChoiceOverlay.tsx",
  "PhoneScreenHost.tsx",
  "CallPresentation.tsx",
  "callLayout.ts",
  "phoneMotion.ts",
] as const;

/** Packages the DOM call UI must never import (exact name or with a subpath). */
const FORBIDDEN_3D = ["three", "@react-three/fiber", "@react-three/drei"] as const;

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

function isForbidden3D(specifier: string): boolean {
  return FORBIDDEN_3D.some((name) => specifier === name || specifier.startsWith(`${name}/`));
}

/** Removes block and line comments so documentation text is not mistaken for code. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

const toSrcPath = (file: string) => relative(SRC_DIR, file).split(sep).join("/");

/** File system access used by the walker; the self-check swaps in an in-memory graph. */
interface SourceHost {
  isFile: (path: string) => boolean;
  read: (path: string) => string;
}

const diskHost: SourceHost = {
  isFile: (path) => existsSync(path) && statSync(path).isFile(),
  read: (path) => readFileSync(path, "utf8"),
};

/**
 * Resolves a relative or `@/` specifier to a file path, trying the TypeScript extensions and
 * `index` files. Returns null for bare package specifiers and `undefined` when nothing exists.
 */
function resolveLocal(
  fromFile: string,
  specifier: string,
  srcDir: string,
  host: SourceHost,
): string | null | undefined {
  let base: string;
  if (specifier.startsWith("@/")) base = resolve(srcDir, specifier.slice(2));
  else if (specifier.startsWith(".")) base = resolve(dirname(fromFile), specifier);
  else return null;
  const candidates = [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
    base,
  ];
  return candidates.find((candidate) => host.isFile(candidate));
}

const isTsSource = (file: string) => /\.tsx?$/.test(file);

/**
 * Walks every file reachable from `entries` through relative and `@/` imports and returns
 * human-readable violations for forbidden 3D imports and unresolved local imports.
 */
function findForbidden3DImports(
  entries: readonly string[],
  srcDir: string,
  host: SourceHost,
): { visited: string[]; violations: string[] } {
  const label = (file: string) => relative(srcDir, file).split(sep).join("/");
  const visited = new Set<string>();
  const violations: string[] = [];
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.shift()!;
    if (visited.has(file)) continue;
    visited.add(file);
    for (const specifier of extractSpecifiers(host.read(file))) {
      if (isForbidden3D(specifier)) {
        violations.push(`${label(file)}: forbidden import "${specifier}"`);
        continue;
      }
      const target = resolveLocal(file, specifier, srcDir, host);
      if (target === null) continue;
      if (target === undefined) {
        violations.push(`${label(file)}: cannot resolve local import "${specifier}"`);
        continue;
      }
      if (isTsSource(target) && !visited.has(target)) queue.push(target);
    }
  }
  return { visited: [...visited].map(label).sort(), violations };
}

/** Matches writes to the camera pose: assignment, compound assignment or a mutating method. */
const CAMERA_WRITE_PATTERNS: readonly RegExp[] = [
  /\bcamera\.(?:position|rotation|quaternion)(?:\.[xyzw])?\s*(?:[+\-*/]?=)(?!=)/,
  /\bcamera\.(?:position|rotation|quaternion)\.(?:set\w*|copy|add\w*|sub\w*|multiply\w*|premultiply|divide\w*|apply\w*|lerp\w*|slerp\w*|normalize|negate|invert|conjugate|identity|reorder|fromArray|random\w*|rotateTowards|clamp\w*|floor|ceil|round\w*)\s*\(/,
  /\bcamera\.(?:lookAt|translate[XYZ]|translateOnAxis|rotate[XYZ]|rotateOnAxis|rotateOnWorldAxis|applyQuaternion|applyMatrix4|setRotationFromEuler|setRotationFromQuaternion|setRotationFromAxisAngle|setRotationFromMatrix)\s*\(/,
];

/**
 * Matches lights, a scene-wide environment (Drei `<Environment>` or `scene.environment =`) and
 * post-processing in component code. Reflection maps on the phone's own materials
 * (`phoneReflections.ts`) are allowed.
 */
const SCENE_ADDITION_PATTERN = /(?:Light\b|\bEnvironment\b|EffectComposer\b|\.environment\s*=)/;

/** Narrative store, selectors and `useChapterState`, relative to `src/`. */
const PHONE_MODEL_FORBIDDEN_TARGETS = [
  "game/narrative/store.ts",
  "game/narrative/selectors.ts",
  "features/chapter1/useChapterState.ts",
] as const;

function checkPhoneModelSource(file: string, source: string, host: SourceHost): string[] {
  const violations: string[] = [];
  for (const specifier of extractSpecifiers(source)) {
    const target = resolveLocal(file, specifier, SRC_DIR, host);
    if (!target) continue;
    const targetLabel = toSrcPath(target);
    if ((PHONE_MODEL_FORBIDDEN_TARGETS as readonly string[]).includes(targetLabel)) {
      violations.push(`imports ${targetLabel}`);
    }
  }
  const code = stripComments(source);
  if (/\buseChapterState\b/.test(code)) violations.push("uses useChapterState");
  const addition = code.match(SCENE_ADDITION_PATTERN);
  if (addition) violations.push(`adds "${addition[0]}"`);
  for (const pattern of CAMERA_WRITE_PATTERNS) {
    const write = code.match(pattern);
    if (write) violations.push(`writes the camera: "${write[0]}"`);
  }
  return violations;
}

/**
 * Returns the attribute text of the first `<Canvas ...>` opening tag, skipping `>` inside
 * braces and strings (for example arrow functions in props), or null when there is none.
 */
function canvasOpeningTag(source: string): string | null {
  const match = /<Canvas\b/.exec(source);
  if (!match) return null;
  let depth = 0;
  let quote: string | null = null;
  for (let i = match.index + match[0].length; i < source.length; i += 1) {
    const char = source[i];
    if (quote) {
      if (char === "\\") i += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "{") depth += 1;
    else if (char === "}") depth -= 1;
    else if (char === ">" && depth === 0) return source.slice(match.index, i + 1);
  }
  return null;
}

const hasAriaHidden = (tag: string) => /\saria-hidden(?:\s*=\s*(?:"true"|'true'|\{\s*true\s*\}))?(?=[\s/>])/.test(tag);

/** Unoptimized phone candidate paths; built from parts so this file does not contain them. */
const CANDIDATE_PATHS = ["iphone-17-pro", "phone-17-pro-max"].map((name) =>
  ["props", "phone", `${name}.glb`].join("/"),
);

function listFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(full));
    else if (entry.isFile()) files.push(full);
  }
  return files.sort();
}

/** In-memory host for the self-check fixtures. */
function memoryHost(files: Record<string, string>): SourceHost {
  return {
    isFile: (path) => Object.prototype.hasOwnProperty.call(files, path),
    read: (path) => files[path],
  };
}

describe("3D phone call UI import boundaries", () => {
  it("rejects a fixture whose transitive relative import reaches three or @react-three/* (self-check)", () => {
    const root = resolve("/fixture/src");
    const at = (path: string) => join(root, path);
    // Upper-case keywords keep these fixtures invisible to scans of this file.
    const src = (lines: string[]) =>
      lines.join("\n").replace(/IMPORT/g, "import").replace(/EXPORT/g, "export");
    const host = memoryHost({
      [at("call/Entry.tsx")]: src([
        'IMPORT React from "react";',
        'IMPORT { helper } from "./helper";',
        'IMPORT { alias } from "@/shared/alias";',
        'IMPORT { Phone } from "lucide-react";',
      ]),
      [at("call/helper.ts")]: src(['EXPORT { deep } from "../deep/index";']),
      [at("deep/index.ts")]: src(['IMPORT type { Vector3 } from "three";', 'IMPORT { x } from "three/src/math";']),
      [at("shared/alias.tsx")]: src([
        "IMPORT {",
        "  useFrame,",
        '} from "@react-three/fiber";',
        'const drei = await IMPORT("@react-three/drei");',
        'IMPORT { missing } from "./missing";',
        'IMPORT { lookalike } from "three-like";',
      ]),
    });
    const result = findForbidden3DImports([at("call/Entry.tsx")], root, host);
    expect(result.visited).toEqual(["call/Entry.tsx", "call/helper.ts", "deep/index.ts", "shared/alias.tsx"]);
    expect(result.violations.sort()).toEqual(
      [
        'deep/index.ts: forbidden import "three"',
        'deep/index.ts: forbidden import "three/src/math"',
        'shared/alias.tsx: forbidden import "@react-three/fiber"',
        'shared/alias.tsx: forbidden import "@react-three/drei"',
        'shared/alias.tsx: cannot resolve local import "./missing"',
      ].sort(),
    );
  });

  it("rejects a phone model fixture that reads the store, adds a light or writes the camera (self-check)", () => {
    const file = join(CALL_DIR, "Fixture3D.tsx");
    const fixture = [
      'IMPORT { useChapterState } from "../useChapterState";',
      'IMPORT { selectDialogueView } from "../../../game/narrative/selectors";',
      "// camera.position.set(0, 0, 0) inside a comment is ignored",
      "const view = useChapterState(store);",
      "const l = <ambientLight />;",
      "camera.position.set(0, 1, 2);",
      "camera.quaternion.copy(q);",
      "camera.rotation.y = 1;",
    ]
      .join("\n")
      .replace(/IMPORT/g, "import");
    const violations = checkPhoneModelSource(file, fixture, diskHost);
    expect(violations).toEqual([
      "imports features/chapter1/useChapterState.ts",
      "imports game/narrative/selectors.ts",
      "uses useChapterState",
      'adds "Light"',
      'writes the camera: "camera.rotation.y ="',
      'writes the camera: "camera.position.set("',
    ]);
    // Reading the camera pose is allowed.
    expect(
      checkPhoneModelSource(file, "rig.position.copy(camera.position);\nif (camera.position.x === 0) {}", diskHost),
    ).toEqual([]);
  });

  it("finds a Canvas opening tag without aria-hidden (self-check)", () => {
    const withArrow = '<Canvas onCreated={({ gl }) => gl.domElement.focus()} className="a">\n</Canvas>';
    const tag = canvasOpeningTag(withArrow);
    expect(tag).toBe('<Canvas onCreated={({ gl }) => gl.domElement.focus()} className="a">');
    expect(hasAriaHidden(tag!)).toBe(false);
    expect(hasAriaHidden('<Canvas aria-hidden="true">')).toBe(true);
    expect(hasAriaHidden("<Canvas aria-hidden={true} >")).toBe(true);
    expect(hasAriaHidden('<Canvas aria-hidden="false">')).toBe(false);
    expect(canvasOpeningTag("<div />")).toBeNull();
  });

  it("the DOM call UI and its transitive local imports import no three or @react-three/*", () => {
    const entries = DOM_ENTRIES.map((name) => join(CALL_DIR, name));
    for (const entry of entries) expect(existsSync(entry), entry).toBe(true);
    const { visited, violations } = findForbidden3DImports(entries, SRC_DIR, diskHost);
    // The walk reaches beyond the entries (for example the shared dialogue keyboard hook).
    expect(visited).toContain("features/chapter1/dialogue/useDialogueOptionKeys.ts");
    expect(visited).toContain("features/chapter1/useChapterState.ts");
    expect(visited).not.toContain("features/chapter1/call/PhoneModel3D.tsx");
    expect(violations).toEqual([]);
  });

  it("PhoneModel3D reads no narrative state, adds no light or post-processing and never writes the camera", () => {
    const file = join(CALL_DIR, "PhoneModel3D.tsx");
    expect(checkPhoneModelSource(file, readFileSync(file, "utf8"), diskHost)).toEqual([]);
  });

  it("no file under src/ references the unoptimized phone candidates", () => {
    const offenders = listFiles(SRC_DIR).filter((file) => {
      const text = readFileSync(file, "utf8");
      return CANDIDATE_PATHS.some((path) => text.includes(path));
    });
    expect(offenders.map(toSrcPath)).toEqual([]);
  });

  it("ChapterOneCanvas passes aria-hidden to Canvas", () => {
    const source = readFileSync(join(CALL_DIR, "..", "ChapterOneCanvas.tsx"), "utf8");
    const tag = canvasOpeningTag(source);
    expect(tag).not.toBeNull();
    expect(hasAriaHidden(tag!)).toBe(true);
  });
});
