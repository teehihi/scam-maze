# SCAMMAZE Project Progress

> Maintained by every contributor and AI agent, as required by [AGENTS.md](../AGENTS.md#6-documentation-maintenance-mandatory).
> Newest task first. Status labels as in [OVERVIEW.md](architecture/OVERVIEW.md#1-status-legend).

## Project Status

- **Product stage:** Pre-MVP. A public landing page with a small playable demo; the game client
  does not exist yet.
- **Current milestone:** Master plan Phase A — Foundation / rule compliance (plan dates 7–10 Nov 2026).
- **Architecture status:** Target architecture documented; frontend landing page `IMPLEMENTED`;
  game client, backend and all AWS services `PLANNED`; nothing provisioned.
- **Database decision:** `PENDING` ([database strategy](architecture/DATABASE_STRATEGY.md)).
- **Domain status:** No domain purchased. Domain & DNS cost `TBD`.
- **Deployment status:** Landing page on GitHub Pages, <https://teehihi.github.io/scam-maze/>
  (last deployment `9a80a43`, reported `success` on 2026-11-07). No backend deployment.
- **AWS budget:** $200 promotional credits, 3-month evaluation, estimate $28.68
  ([cost estimation](finops/COST_ESTIMATION.md)); no actual spend yet.
- **Last updated:** 2026-11-07

## Completed

Verified against merged pull requests on GitHub.

- [x] Public repository, MIT license, community health files (code of conduct, contributing,
      security policy, accessibility statement, issue and PR templates) — PR #1, merged 2026-11-07.
- [x] Landing page (React 19, TypeScript, Vite 8, Tailwind CSS v4) with a branching demo
      scenario and a string-only URL checker — initial commit `b23fe11`.
- [x] Deploy workflow to GitHub Pages and CI build on pull requests — commits `846c93a`,
      `e9a3880`; `ci.yml` added in PR #2.
- [x] Flat, minimal redesign; skip link; contrast-checked color tokens — PR #2, merged 2026-11-07.
- [x] All site copy and documentation in English; steering rules for icons and language;
      master plan translated — PR #3, merged 2026-11-07.
- [x] Positioning for Vietnam and worldwide; `audience.md` steering; demo uses fictional brand
      and reserved domains — PR #5, merged 2026-11-07.
- [x] Master plan added — commit `0665897`, 2026-11-07.
- [x] Architecture, deployment, database strategy, cost estimation, agent instructions and this
      progress tracker documented (documentation only) — see task history.

## In Progress

- [ ] Phase A foundation items not yet done: `.kiro/specs/` for the first features, Kiro hooks,
      `THIRD_PARTY_NOTICES.md`, committed `pnpm-lock.yaml`, test runner.

## Planned

From the master plan roadmap (section 8); none started unless listed above.

- [ ] Phase B — Core vertical slice S1 "The Missing Parcel": scenario schema, deterministic
      engine, simulated Internet UI, evidence links, local progress (IndexedDB).
- [ ] Phase C — S2 "The Dream Job", S3 "The Impossible Deal", Consequence Replay, Risk DNA Graph,
      transfer test (H1), offline shell, optional AI coach behind the backend.
- [ ] Phase D — Usability sessions with Vietnamese and international participants; polish.
- [ ] Phase E — Submission package, video, release tag.
- [ ] Split the repository into landing page and game client; host both on Vercel.
- [ ] Serverless backend (API Gateway HTTP API + Lambda) for opt-in sync, only after the
      database and authentication decisions.

## Pending Decisions

- [ ] Select database technology (`DATABASE_DECISION = PENDING`; recommendation in
      [database strategy](architecture/DATABASE_STRATEGY.md#5-recommendation-not-an-approved-decision)).
- [ ] Evaluate and purchase a suitable domain (cost `TBD`, not covered by AWS credits).
- [ ] Finalize deployment configuration: move landing page from GitHub Pages to Vercel or keep it.
- [ ] Authentication: Amazon Cognito or an alternative; whether accounts are needed for the MVP.
- [ ] Lambda runtime language: Python (plan: FastAPI + Pydantic) or TypeScript.
- [ ] Confirm deprecating "FastAPI on an always-on host" in favour of the serverless backend.
- [ ] Scope of 3D environments, character models and character customization (master plan
      lists a full 3D world as out of scope).
- [ ] Scenario state owner: XState or Zustand (plan section 4.1).
- [ ] Confirm the source, expiry date and terms of the $200 AWS credit.
- [ ] Infrastructure-as-code tool (for example AWS SAM or AWS CDK).

## Known Issues

- Landing page copy describes planned capabilities in the present tense (offline support,
  scenario authoring, learning analytics, optional AI, Kiro specs and hooks). See
  [OVERVIEW.md section 10](architecture/OVERVIEW.md#10-known-inaccuracies-on-the-live-landing-page).
- Issue #4 (URL checker flags official country domains such as `google.co.uk`) was closed as
  completed on 2026-11-07, but `src/lib/urlCheck.ts` has not been changed; the false positive
  still exists.
- The demo scenario has 2 choices per step; the plan requires at least 2 safe, 2 unsafe and
  1 ambiguous route per scenario.
- No automated tests; no lockfile; no accessibility audit yet.

## Task History

### 2026-11-07 — Architecture, AWS FinOps and project documentation update

- **Objective:** Document the current implementation, target architecture, deployment strategy,
  AWS cost baseline, database decision status, domain strategy and progress tracking, without
  deploying or purchasing anything.
- **Changes:** Audited the repository, master plan, workflows and live deployment status.
  Documented current vs planned architecture with status labels; deployment and environment
  variables; database comparison with `DATABASE_DECISION = PENDING` and a non-binding
  recommendation; full AWS cost baseline with assumptions, validation checklist, credit
  limitations and a separate `TBD` domain cost category; persistent agent instructions;
  this progress tracker. Documentation only: no application code changed, no AWS resources
  created, no domain purchased.
- **Files modified:** created `AGENTS.md`, `docs/architecture/OVERVIEW.md`,
  `docs/architecture/DEPLOYMENT.md`, `docs/architecture/DATABASE_STRATEGY.md`,
  `docs/finops/COST_ESTIMATION.md`, `docs/PROJECT_PROGRESS.md`; updated `README.md`,
  `CONTRIBUTING.md`, `.github/pull_request_template.md`.
- **Validation:** Re-calculated all supplied cost figures (rows, columns, scenarios, credit
  utilization, VND conversions); checked relative links and heading anchors; checked Markdown
  table column counts; reviewed Mermaid syntax manually; searched for proposed domain names,
  database selection claims and deployment claims; scanned for secrets, emoji and non-English
  text.
- **Build/test results:** PR #6, CI `build` job passed (`pnpm install` + `pnpm build`);
  documentation checks passed (86 relative links and anchors, 54 tables, cost tables, Mermaid
  structure, secrets, emoji, language). No test suite exists, so no tests were run.
- **Known limitations:** Prices for AWS free allowances, Neon and domains come from public pages
  and third-party reports as of Nov 2026 and were not checked in the AWS Pricing Calculator.
  Mermaid diagrams were not rendered by a Mermaid parser in this environment.
- **Architecture deviations:** Recorded in [OVERVIEW.md section 9](architecture/OVERVIEW.md#9-reconciliation-with-the-master-plan)
  (hosting, backend framework, accounts, 3D scope, visual system).
- **Follow-up tasks:** Correct landing page copy; fix or reopen issue #4; commit a lockfile; add
  a test runner; create `.kiro/specs/` for Phase B; owner decisions listed above.
