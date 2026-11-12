// Guards the Chapter 1 voice/call components against hard-coded user-facing text.
// UI text must come from i18n keys; authored dialogue must come from the scenario data.
// Requirements 16.1 and 12.3. The scan is string-only: it parses source with the TypeScript
// compiler API and never executes the files.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Files under the scan, relative to `features/chapter1`. */
const SCANNED_FILES = [
  "call/PhoneScreenUI.tsx",
  "call/PlayerChoiceOverlay.tsx",
  "call/CallPresentation.tsx",
  "dialogue/DialoguePanel.tsx",
  "hud/SaveTrimmedNotice.tsx",
  "voice/useVoicePlayback.ts",
  "voice/useCallAudio.ts",
] as const;

const EMOJI = /\p{Extended_Pictographic}/u;
const SAFE_WORD = /\bsafe(?:ly|ty|r|st)?\b/i;

export interface Violation {
  kind: "authored-text" | "emoji" | "safe-word";
  line: number;
  text: string;
}

/**
 * A literal looks like a sentence when it has at least three words made only of letters and
 * ordinary sentence punctuation. Class lists, CSS values, ids, keys and paths never match,
 * because they contain digits, brackets, colons, slashes, dots between letters or hyphens
 * between tokens.
 */
export function looksLikeSentence(value: string): boolean {
  const text = value.trim();
  if (text.length < 8) return false;
  const words = text.split(/\s+/);
  if (words.length < 3) return false;
  const wordLike = /^[\p{L}][\p{L}'’]*[,.!?;:]?$|^["“(]?[\p{L}][\p{L}'’]*["”)]?[,.!?;:]?$/u;
  const proseWords = words.filter((w) => wordLike.test(w)).length;
  return proseWords >= 3 && proseWords / words.length >= 0.8;
}

function isImportOrKeyContext(node: ts.Node): boolean {
  const parent = node.parent;
  if (!parent) return false;
  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return true;
  if (ts.isLiteralTypeNode(parent)) return true;
  return false;
}

export function scanSource(fileName: string, source: string): Violation[] {
  const violations: Violation[] = [];
  const sf = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const lineOf = (node: ts.Node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

  const check = (node: ts.Node, value: string) => {
    if (EMOJI.test(value)) violations.push({ kind: "emoji", line: lineOf(node), text: value });
    if (SAFE_WORD.test(value)) violations.push({ kind: "safe-word", line: lineOf(node), text: value });
    if (looksLikeSentence(value)) {
      violations.push({ kind: "authored-text", line: lineOf(node), text: value });
    }
  };

  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (!isImportOrKeyContext(node)) check(node, node.text);
    } else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      check(node, node.text);
    } else if (ts.isJsxText(node)) {
      if (node.text.trim().length > 0) check(node, node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  // Emoji are banned everywhere, including comments.
  const lines = source.split(/\r?\n/);
  lines.forEach((text, index) => {
    if (EMOJI.test(text) && !violations.some((v) => v.kind === "emoji" && v.line === index + 1)) {
      violations.push({ kind: "emoji", line: index + 1, text: text.trim() });
    }
  });
  return violations;
}

function format(file: string, violations: Violation[]): string {
  return violations.map((v) => `${file}:${v.line} [${v.kind}] ${JSON.stringify(v.text)}`).join("\n");
}

describe("noAuthoredText scanner self-check", () => {
  it("flags an authored sentence in a string literal", () => {
    const found = scanSource("x.ts", `const a = "Please send me the code right now";`);
    expect(found.map((v) => v.kind)).toContain("authored-text");
  });

  it("flags a sentence in JSX text and in a template literal", () => {
    const jsx = scanSource("x.tsx", `export const A = () => <p>Your account is locked today</p>;`);
    expect(jsx.map((v) => v.kind)).toContain("authored-text");
    const tpl = scanSource("x.ts", "const b = `Click the link to continue now`;");
    expect(tpl.map((v) => v.kind)).toContain("authored-text");
  });

  it("flags emoji, also inside a comment", () => {
    expect(scanSource("x.ts", `const a = "ok \u{1F6A9}";`).map((v) => v.kind)).toContain("emoji");
    expect(scanSource("x.ts", `// done \u2705\nconst a = 1;`).map((v) => v.kind)).toContain("emoji");
  });

  it("flags the word safe in a UI string but not inside a longer word", () => {
    expect(scanSource("x.ts", `const a = "Safe";`).map((v) => v.kind)).toContain("safe-word");
    expect(scanSource("x.ts", `const a = "unsafeValue";`)).toEqual([]);
  });

  it("allows i18n keys, class lists, ids, CSS values, imports and typographic characters", () => {
    const source = [
      `import { x } from "react-i18next";`,
      `const k = t("phone.call.connecting");`,
      `const c = "flex items-center gap-1.5 text-sm font-semibold uppercase";`,
      `const id = "choice-waiting";`,
      `const anim = "scammaze-call-screen-vibrate 1.4s ease-in-out infinite";`,
      `const arrow = "\u2192";`,
      `type Reason = "autoplay-blocked" | "dev-preview";`,
      `// A comment with several words is fine.`,
    ].join("\n");
    expect(scanSource("x.ts", source)).toEqual([]);
  });
});

describe("Chapter 1 voice and call components contain no authored text", () => {
  for (const file of SCANNED_FILES) {
    it(`${file} has no hard-coded sentences, emoji or the word "safe"`, () => {
      const source = readFileSync(resolve(HERE, file), "utf8");
      const violations = scanSource(file, source);
      expect(violations, format(file, violations)).toEqual([]);
    });
  }
});
