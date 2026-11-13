#!/usr/bin/env node
// Hook D: final review when an agent stops.
// Cheap when nothing changed. When source files changed since the last review, it:
//   1. groups changed files by area and flags edits that span unrelated areas,
//   2. runs the incremental type check of the affected packages,
//   3. runs only the Vitest files related to the changed source files (`vitest related`).
// On problems it exits 1, which makes the agent take another turn with this report. The diff
// fingerprint is stored in .git/kiro/final-review.json, so the same unchanged diff is never
// reported twice (no Stop-hook loop).
import { changedFiles, fingerprint, git, readState, run, tail, writeState } from "./lib.mjs";

const AREAS = [
  ["narrative", /^apps\/game\/src\/game\/narrative\//],
  ["chapter1-ui", /^apps\/game\/src\/features\/chapter1\//],
  ["menu+loading", /^apps\/game\/src\/(features\/(menu|loading)|components\/ui)\//],
  ["worlds", /^apps\/game\/src\/(features\/(hue|mientay|ueh|testmove)|game\/(scenes|core))\//],
  ["player+vehicle", /^apps\/game\/src\/features\/(player|vehicle)\//],
  ["i18n", /^apps\/game\/src\/i18n\//],
  ["saves+loading-core", /^apps\/game\/src\/game\/(saves|loading|chapters|voice|content)\//],
  ["landing", /^apps\/landing\//],
  ["shared-types", /^packages\/shared-types\//],
  ["kiro", /^\.kiro\//],
  ["docs", /^(docs\/|[A-Z_]+\.md$)/],
];
const SOURCE = /^(apps|packages)\/.*\.(ts|tsx|css)$/;

const changed = changedFiles();
const source = changed.filter((path) => SOURCE.test(path));
if (source.length === 0) process.exit(0);

const key = fingerprint(`${git("diff", "HEAD")}\n${source.join("\n")}\n${git("ls-files", "--others", "--exclude-standard", "-s")}`);
const last = readState("final-review");
if (last?.fingerprint === key) process.exit(0);

const byArea = new Map();
for (const path of changed) {
  const area = AREAS.find(([, pattern]) => pattern.test(path))?.[0] ?? "other";
  byArea.set(area, [...(byArea.get(area) ?? []), path]);
}

const problems = [];

// Type check only the packages that changed.
const packages = new Set(source.map((path) => (path.startsWith("apps/landing/") ? "@scammaze/landing" : path.startsWith("packages/") ? "@scammaze/shared-types" : "@scammaze/game")));
for (const name of packages) {
  const result = run("pnpm", ["--filter", name, "typecheck"]);
  if (!result.ok) problems.push(`Type check failed in ${name}:\n${tail(result.output, 30)}`);
}

// Related tests for changed game sources (test files themselves included).
const gameSources = source.filter((path) => path.startsWith("apps/game/src/")).map((path) => path.replace(/^apps\/game\//, ""));
let testSummary = "no game source changed";
if (gameSources.length > 0) {
  const result = run("pnpm", ["--filter", "@scammaze/game", "exec", "vitest", "related", "--run", "--reporter=dot", ...gameSources], { timeoutMs: 280_000 });
  const summary = result.output.split("\n").filter((line) => /Test Files|Tests /.test(line)).join(" | ").trim();
  testSummary = summary || (result.timedOut ? "timed out" : "no related tests found");
  if (!result.ok) problems.push(`Related tests failed:\n${tail(result.output, 40)}`);
}

writeState("final-review", { fingerprint: key, at: new Date().toISOString(), problems: problems.length });

const areaLines = [...byArea.entries()].map(([area, paths]) => `  ${area} (${paths.length}): ${paths.slice(0, 6).join(", ")}${paths.length > 6 ? ", ..." : ""}`);
const codeAreas = [...byArea.keys()].filter((area) => !["kiro", "docs", "other"].includes(area));
const spread = codeAreas.length > 2 ? `\nChanges span ${codeAreas.length} code areas (${codeAreas.join(", ")}). Confirm each belongs to the task; leave other people's work out of commits.` : "";

if (problems.length === 0) {
  // Clean: no extra turn. The summary goes to the hook log only.
  console.log(`[final-review] OK. Type check passed; related tests: ${testSummary}.${spread}`);
  process.exit(0);
}
console.log(`[final-review] Problems found in the current diff. Fix them or explain them to the user.\nChanged files by area:\n${areaLines.join("\n")}${spread}\n\n${problems.join("\n\n")}`);
process.exit(1);
