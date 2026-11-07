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

Key documents: [master plan](SCAMMAZE_KIROWEEN_2026_FULL_PLAN.md) ·
[architecture](docs/architecture/OVERVIEW.md) · [deployment](docs/architecture/DEPLOYMENT.md) ·
[database strategy](docs/architecture/DATABASE_STRATEGY.md) ·
[cost estimation](docs/finops/COST_ESTIMATION.md) · [project progress](docs/PROJECT_PROGRESS.md) ·
[positioning](docs/positioning.md) · [contributing](CONTRIBUTING.md)

## 1. Project principles

- Follow the master plan. When the plan and a newer owner instruction differ, follow the owner,
  and record the deviation in `docs/PROJECT_PROGRESS.md`.
- Preserve the product vision: *a safe, interactive Internet where people learn to spot scams
  before facing them in real life.* SCAMMAZE is not a quiz, chatbot or URL scanner.
- Prioritize working functionality over mockups and visual polish.
- **Do not fabricate features.** Never describe something as implemented, deployed, measured or
  verified unless you verified it in this task.
- Avoid unnecessary architecture complexity (plan section 4.1: no microservices, Kubernetes,
  vector databases, etc. without a measured need).
- Respect safety and privacy: fictional brands, reserved domains (`.test`, `.example`,
  `.invalid`), no real credentials, OTPs or banking data, ever.
- The core game must work without AI and without the backend.

## 2. Engineering rules

- Inspect the existing code and docs before changing anything; reuse existing conventions.
- Current stack (verified): React 19, TypeScript, Vite 8, Tailwind CSS v4, pnpm. Single app at
  the repository root. No backend, no database, no tests yet.
- Commands:

  ```bash
  pnpm install
  pnpm dev         # local dev server
  pnpm typecheck   # TypeScript only
  pnpm build       # typecheck + production build (the current quality gate)
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
