// Shared helpers for the Kiro hook scripts in this folder.
// The scripts are deliberately small and deterministic: they read git state and files, run
// existing package scripts, and never modify source files. Hook state lives under .git/kiro/.
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Repository root (this file lives in <root>/.kiro/scripts/). Independent of the hook's cwd. */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export function git(...args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

/** Changed paths (tracked diff against HEAD plus untracked), repo-relative, POSIX separators. */
export function changedFiles() {
  const tracked = git("diff", "--name-only", "HEAD").split("\n");
  const untracked = git("ls-files", "--others", "--exclude-standard").split("\n");
  return [...new Set([...tracked, ...untracked].filter(Boolean))].sort();
}

/** Added lines of one file: the `+` lines of the diff for tracked files, the whole file otherwise. */
export function addedLines(path) {
  const tracked = git("ls-files", "--", path).trim() !== "";
  if (!tracked) {
    const full = join(ROOT, path);
    return existsSync(full) ? readFileSync(full, "utf8").split("\n") : [];
  }
  return git("diff", "-U0", "HEAD", "--", path)
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1));
}

export function readRepoFile(path) {
  const full = join(ROOT, path);
  return existsSync(full) ? readFileSync(full, "utf8") : "";
}

/**
 * Hook event JSON from stdin, or null. Kiro sends the event on stdin; the schema for file events
 * is not fully documented, so callers treat it as optional and fall back to git state.
 */
export function readHookEvent() {
  try {
    if (process.stdin.isTTY) return null;
    const raw = readFileSync(0, "utf8").trim();
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Runs a command in the repo and returns { ok, output } (stdout and stderr combined). */
export function run(command, args, { cwd = ROOT, timeoutMs = 240_000 } = {}) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  return { ok: result.status === 0, status: result.status, output, timedOut: result.error?.code === "ETIMEDOUT" };
}

export function fingerprint(text) {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

const STATE_DIR = join(ROOT, ".git", "kiro");

export function readState(name) {
  try {
    return JSON.parse(readFileSync(join(STATE_DIR, `${name}.json`), "utf8"));
  } catch {
    return null;
  }
}

export function writeState(name, value) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(join(STATE_DIR, `${name}.json`), JSON.stringify(value, null, 2));
}

/** Last lines of a long tool output, so hook messages stay short. */
export function tail(text, lines = 25) {
  return text.trimEnd().split("\n").slice(-lines).join("\n");
}
