---
inclusion: always
---

# How Kiro works in this repository

Keep this short; details live in the linked files.

## Choose the mode

- Spec (`.kiro/specs/<name>/`) for: anything touching the narrative core or save format, a new
  chapter or map, cross-map refactors, or work over about a day. Existing specs are the history of
  decisions; read the related one before changing that area (`#spec:<name>`).
- Vibe for: copy, styling, a contained bug fix, a single-file change. Still add a test and a
  `docs/PROJECT_PROGRESS.md` entry (AGENTS.md section 6).

## Delegate on purpose (`.kiro/agents/`)

- `world-architect`: rendering/map design reviews and measured performance work. Read-only.
- `gameplay-engineer`: narrative core, branching, saves, deterministic rules.
- `scenario-designer`: authoring or reviewing scam scenarios and dialogue. Data and text only.
- `qa-security-reviewer`: independent review of a diff or design before you call it done. Read-only.
Do not delegate a one-line change. Never let two agents edit the same files at once: one writer,
reviewers read.

## Skills (`.kiro/skills/`)

`threejs-world-engine`, `scam-scenario-authoring`, `gameplay-testing` hold the procedures; load the
one that matches the task instead of re-deriving them.

## MCP (`.kiro/settings/mcp.json`)

- `playwright`: drive the running game at http://localhost:5174 for UI and flow checks. Never
  start another dev server; the owner keeps one on 5174.
- `github` (disabled until the owner adds a token): PRs and reviews. Without it, use git and the
  PR URL; do not invent PR state.

## Hooks (`.kiro/hooks/`) run automatically

Scenario gate on narrative saves, world-change scan on rendering saves, evidence check after spec
tasks, type check + related tests when an agent stops. A hook warning is a finding: fix it or say
why it does not apply.

## Done means verified

Run `pnpm typecheck`, the related tests, and `pnpm build` for a PR. State what you verified and
what you could not (real GPU, real audio, real devices). Never claim a measurement you did not take.
Work on a branch, never commit someone else's uncommitted work, and do not commit unless asked.
