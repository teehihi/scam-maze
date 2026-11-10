# AGENTS.md — instructions for AI coding agents

These instructions apply to every AI coding agent working in this repository (Kiro loads this
file automatically). They complement the steering rules in `.kiro/steering/`, which stay
authoritative for their topics:

| Steering file | Topic |
|---|---|
| `.kiro/steering/safety.md` | Never call a URL "safe"; string-only URL analysis; no live links |
| `.kiro/steering/icons.md` | No emoji as icons |
| `.kiro/steering/language.md` | All repository content in English; localization later |
| `.kiro/steering/audience.md` | Vietnam and worldwide with equal weight; fictional brands and reserved domains |

Key documents: **[product positioning](docs/product/PRODUCT_POSITIONING.md) (canonical product
definition)** · [master plan](SCAMMAZE_KIROWEEN_2026_FULL_PLAN.md) ·
[architecture](docs/architecture/OVERVIEW.md) · [deployment](docs/architecture/DEPLOYMENT.md) ·
[database strategy](docs/architecture/DATABASE_STRATEGY.md) ·
[cost estimation](docs/finops/COST_ESTIMATION.md) · [project progress](docs/PROJECT_PROGRESS.md) ·
[contributing](CONTRIBUTING.md)

## 1. Project principles

- **The product is defined by [`docs/product/PRODUCT_POSITIONING.md`](docs/product/PRODUCT_POSITIONING.md).**
  It overrides older descriptions in the master plan and elsewhere. If documents conflict, follow
  it and record the conflict in `docs/PROJECT_PROGRESS.md`.
- Follow the master plan for process, rules compliance, safety and evaluation. When the plan and
  a newer owner instruction differ, follow the owner, and record the deviation.
- Preserve the product identity (owner decision, 8 Nov 2026): **SCAMMAZE is a browser-based,
  first-person 3D narrative game** in a small persistent fictional world with chapter-based
  stories. Scams reach the player through an in-game smartphone and through people in the world;
  the core loop is *physical world → digital interaction → investigation → decision →
  consequence → learning*. North star: *a safe, living world where people learn to spot scams
  before facing them in real life.*
- **Do not revert** to the earlier 2D "simulated Internet" concept as the main experience. The
  phone, websites and chats are embedded in the 3D world, not a replacement for it.
- SCAMMAZE is not a phishing quiz, a chatbot with a 3D background, a URL scanner, a set of
  disconnected simulations, a dashboard, or an open world with scam dialogue added later.
- Keep the scope small: one apartment and one street for the MVP; no open world, multiplayer or
  Halloween/horror art direction (art direction: stylized realism / stylized low-poly).
- **Hybrid intelligence:** the deterministic core owns game state, rules, evidence, decisions,
  consequences and progression. AI may only *propose* dialogue or wording, validated against
  schemas and scenario rules, with authored fallbacks. AI must never change financial state,
  decide success or failure, invent evidence, or change outcomes. No AI provider is selected;
  keys stay server-side.
- Prioritize working functionality over mockups and visual polish.
- **Do not fabricate features.** Never describe something as implemented, deployed, measured or
  verified unless you verified it in this task.
- Avoid unnecessary architecture complexity (plan section 4.1: no microservices, Kubernetes,
  vector databases, etc. without a measured need).
- Respect safety and privacy: fictional brands, reserved domains (`.test`, `.example`,
  `.invalid`), no real credentials, OTPs or banking data, ever. AI scammer dialogue stays
  fictional and defensive and must never contain instructions usable for real fraud.
- The core game must work without AI and without the backend (offline once assets and scenarios
  are loaded).

## 2. Engineering rules

- Inspect the existing code and docs before changing anything; reuse existing conventions.
- Current stack (verified): pnpm monorepo with `apps/landing`, `apps/game`, and `packages/shared-types`.
  - Landing app (`apps/landing`): React 19, TypeScript, Vite 8, Tailwind CSS v4, `lucide-react`. Deploys to GitHub Pages.
  - Game app (`apps/game`): React 19, TypeScript, Vite 8, Three.js r174, React Three Fiber v9, Drei v10, Tailwind CSS v4, `lucide-react`. Implements the 3D first-person Main Menu street environment with verified Sketchfab assets.
  - Shared contracts (`packages/shared-types`): Pure TypeScript definitions without React or Three.js dependencies.
- **Game stack details** (owner decision, 8 Nov 2026; details in
  [OVERVIEW.md, section 3.1](docs/architecture/OVERVIEW.md#31-game-application-stack)):
  React 19 + TypeScript + Vite; **Three.js** is the primary 3D engine, used through **React Three
  Fiber** and **Drei**; **Rapier** is the *proposed* physics engine (not needed for menu);
  Zustand for complex gameplay state when needed; pure TypeScript deterministic scenario engine;
  Zod for runtime validation; IndexedDB via Dexie for local saves.
  - Do not use PixiJS (a 2D renderer) as the 3D engine, and do not substitute other 3D engines.
  - ECS is **not** approved; do not introduce it without a documented evaluation and owner approval.
  - The scenario engine must not import React, Three.js, Rapier, Zustand or Dexie.
- Commands:

  ```bash
  pnpm install
  pnpm dev:landing       # local dev server for landing page (port 5173)
  pnpm dev:game          # local dev server for 3D game (port 5174)
  pnpm build:landing     # build landing page to apps/landing/dist
  pnpm build:game        # build 3D game to apps/game/dist
  pnpm typecheck         # workspace-wide TypeScript verification
  pnpm build             # workspace-wide production build (current quality gate)
  ```

- Avoid unnecessary dependencies; justify each new one in the pull request.
- Keep components modular; keep scenario logic pure and deterministic.
- Keep frontend and backend responsibilities clear: gameplay runs in the client; the backend
  only persists, validates, authenticates and proxies optional AI.
- Validate environment variables at start-up; never put secrets in `VITE_*` variables.
- Never commit secrets, `.env` files, keys or real personal data.
- Write tests for meaningful business logic (scenario engine, scoring, URL rules) once a test
  runner is added.
- Run the relevant checks after every change (at least `pnpm build`) and report the result
  honestly. If a check cannot run in your environment, say so.
- Work on a branch and open a pull request; do not push directly to `main` (it deploys the live
  site). Use Conventional Commits; when an agent helped, keep the human as author and add a
  `Co-authored-by` trailer (see [CONTRIBUTING.md](CONTRIBUTING.md)).

## 3. Cost rules

- Prefer the cheapest solution that meets the requirement; the AWS budget is $200 in promotional
  credits for 3 months (see [cost estimation](docs/finops/COST_ESTIMATION.md)).
- **Do not provision, deploy or modify any AWS resource without explicit owner approval**
  recorded in `docs/PROJECT_PROGRESS.md`.
- Do not introduce paid infrastructure or paid third-party services without a documented cost.
- Avoid unnecessary API calls: no backend call per gameplay interaction.
- Avoid unnecessary logs and storage; set log retention.
- No VPC/NAT gateway, always-on database instance or public IPv4 address without an approved
  cost.
- When introducing any service, update `docs/finops/COST_ESTIMATION.md` with its cost
  implications.

## 4. Domain rules

- **No custom domain has been purchased.**
- Use configurable URLs (environment variables) everywhere.
- Never hard-code proposed names such as `scammaze.com`, `play.scammaze.com` or
  `api.scammaze.com` as confirmed production URLs; mark them as examples if you mention them.
- Use the GitHub Pages or Vercel default URL and AWS-provided endpoints until custom DNS is
  configured.
- Never purchase, register or configure a domain.

## 5. Database rules

- `DATABASE_DECISION = PENDING` (see [database strategy](docs/architecture/DATABASE_STRATEGY.md)).
- Do not add a database dependency, client library, schema, migration or infrastructure based
  on an unapproved choice.
- Do not introduce a new database without documenting the decision and getting owner approval.
- Keep data access behind a small storage interface so the decision stays reversible.

## 6. Documentation maintenance (mandatory)

After **every meaningful task** (code, architecture or documentation), update
[`docs/PROJECT_PROGRESS.md`](docs/PROJECT_PROGRESS.md) **in the same task**, not later. Add an
entry to "Task history" with:

1. date (`YYYY-MM-DD`) and task title;
2. objective;
3. completed work;
4. files created, modified or deleted;
5. validation commands executed;
6. build and test results (state clearly if something could not be run);
7. unresolved issues and known limitations;
8. deviations from the documented architecture;
9. follow-up tasks.

Also:

- update the "Project status", "Completed", "In progress", "Planned" and "Pending decisions"
  sections when they change;
- update the relevant architecture, deployment, database or cost document whenever the real
  implementation makes it inaccurate, and keep the status labels (`IMPLEMENTED`, `PLANNED`,
  `PROPOSED`, `PENDING`, `DEPRECATED`) correct;
- **never mark a feature as completed without verifying it**;
- keep the progress file concise and chronological (newest entry first).
