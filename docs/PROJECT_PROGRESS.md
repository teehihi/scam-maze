# SCAMMAZE Project Progress

> Maintained by every contributor and AI agent, as required by [AGENTS.md](../AGENTS.md#6-documentation-maintenance-mandatory).
> Newest task first. Status labels as in [OVERVIEW.md](architecture/OVERVIEW.md#1-status-legend).

## Project Status

- **Product definition:** Browser-based, first-person 3D narrative game in a small persistent
  world with chapter-based stories (owner decision, 2026-11-08). Canonical document:
  [product positioning](product/PRODUCT_POSITIONING.md).
- **Product stage:** Pre-MVP. A public marketing landing page only; **no game code exists yet**
  (no 3D library, no narrative engine, no phone UI).
- **Current milestone:** Master plan Phase A — Foundation / rule compliance (plan dates 7–10 Nov
  2026). Phase B now targets the 3D vertical slice (positioning section 11).
- **Architecture status:** Target architecture documented; landing page `IMPLEMENTED`; 3D game
  client, deterministic core, backend and all AWS services `PLANNED`; 3D library `PENDING`;
  AI layer `PROPOSED`; nothing provisioned.
- **Database decision:** `PENDING` ([database strategy](architecture/DATABASE_STRATEGY.md)).
- **Domain status:** No domain purchased. Domain & DNS cost `TBD`.
- **Deployment status:** Landing page on GitHub Pages, <https://teehihi.github.io/scam-maze/>
  (last deployment `8c66005`, reported `success` on 2026-11-08). No game or backend deployment.
- **AWS budget:** $200 promotional credits, 3-month evaluation, estimate $28.68
  ([cost estimation](finops/COST_ESTIMATION.md)); no actual spend yet. 3D asset and AI costs not
  yet estimated (cost estimation, section 15).
- **Last updated:** 2026-11-08

## Completed

Verified against merged pull requests on GitHub.

- [x] Public repository, MIT license, community health files (code of conduct, contributing,
      security policy, accessibility statement, issue and PR templates) — PR #1, merged 2026-11-07.
- [x] First landing page with a branching demo scenario and a string-only URL checker — initial
      commit `b23fe11` (now in `src/legacy/`).
- [x] Deploy workflow to GitHub Pages and CI build on pull requests — commits `846c93a`,
      `e9a3880`; `ci.yml` added in PR #2.
- [x] Flat, minimal redesign; skip link; contrast-checked color tokens — PR #2, merged 2026-11-07
      (replaced by PR #7).
- [x] All site copy and documentation in English; steering rules for icons and language;
      master plan translated — PR #3, merged 2026-11-07.
- [x] Positioning for Vietnam and worldwide; `audience.md` steering; demo uses fictional brand
      and reserved domains — PR #5, merged 2026-11-07.
- [x] Master plan added — commit `0665897`, 2026-11-07.
- [x] Architecture, deployment, database strategy, cost estimation, agent instructions and this
      progress tracker documented (documentation only) — PR #6, merged 2026-11-07.
- [x] Cinematic dark landing page as a game gateway; `VITE_GAME_URL` entry configuration;
      `pnpm-lock.yaml` and `lucide-react` added; earlier demo moved to `src/legacy/` — PR #7,
      merged 2026-11-07.
- [x] Canonical product positioning for the first-person 3D direction; reconciliation of README,
      AGENTS.md, master plan, architecture and cost documents (documentation only) — see task
      history, 2026-11-08.

## In Progress

- [ ] Phase A foundation items not yet done: `.kiro/specs/` for the first features, Kiro hooks,
      `THIRD_PARTY_NOTICES.md`, test runner, `--frozen-lockfile` in CI.

## Planned

Updated for the 3D direction (positioning section 11); none started.

- [ ] 3D prototype and benchmark: walkable apartment and street on target devices (integrated
      GPUs), to set triangle, draw-call and memory budgets.
- [ ] Deterministic core: chapter state machine, evidence and tactic definitions, persistent
      world state, local save (IndexedDB), tests for every branch.
- [ ] In-game smartphone UI: messages, browser with fictional sites, bank app, parcel app.
- [ ] Vertical slice: Prologue and Chapter 1 "The Missing Parcel" (2 safe, 2 unsafe, 1
      ambiguous route), debrief, phone-only transfer check.
- [ ] Bounded AI Scam Actor with authored fallback and AI on/off toggle (after provider approval).
- [ ] Phase D — Usability sessions with Vietnamese and international participants; polish.
- [ ] Phase E — Submission package, video, release tag.
- [ ] Future scope: Chapters 2–4 in 3D, mobile controls, character customization, AI hints and
      learning analyst, cloud save.
- [ ] Split the repository into landing page and game client; host both on Vercel.
- [ ] Serverless backend (API Gateway HTTP API + Lambda) for the AI proxy and opt-in sync, only
      after the AI provider, database and authentication decisions.

## Pending Decisions

- [ ] 3D library: React Three Fiber (Three.js), Babylon.js, PlayCanvas or other.
- [ ] AI provider and monthly AI budget (paid provider requires explicit approval).
- [ ] Approve the signature AI capability (Bounded Scam Actor) and its input modality (options
      only, or options plus free text).
- [ ] Approve the MVP vertical slice details (positioning section 11.1) and chapter content.
- [ ] Phone-centred fallback mode for devices that cannot run the 3D world.
- [ ] Update the live landing page copy to the 3D direction.
- [ ] Master plan co-author (SaiCT) to review the 8 Nov 2026 amendments.
- [ ] Select database technology (`DATABASE_DECISION = PENDING`; recommendation in
      [database strategy](architecture/DATABASE_STRATEGY.md#5-recommendation-not-an-approved-decision)).
- [ ] Evaluate and purchase a suitable domain (cost `TBD`, not covered by AWS credits).
- [ ] Finalize deployment configuration: move landing page from GitHub Pages to Vercel or keep it.
- [ ] Authentication: Amazon Cognito or an alternative; whether accounts are needed at all.
- [ ] Lambda runtime language: Python (plan: FastAPI + Pydantic) or TypeScript.
- [ ] Confirm deprecating "FastAPI on an always-on host" in favour of the serverless backend.
- [ ] Scenario state owner: XState or Zustand (plan section 4.1).
- [ ] Confirm the source, expiry date and terms of the $200 AWS credit.
- [ ] Infrastructure-as-code tool (for example AWS SAM or AWS CDK).

Resolved:

- [x] Scope of 3D environments — **resolved 2026-11-08** by owner decision: a small first-person 3D
      world is the core platform; full/open world and multiplayer remain out of scope; character
      customization is future scope.

## Known Issues

- The live landing page (PR #7) describes the earlier concept ("five fictional digital
  environments, linked together") and does not mention the 3D world. See
  [OVERVIEW.md section 10](architecture/OVERVIEW.md#10-known-inaccuracies-on-the-live-landing-page).
- Delivery risk: about 25 days remain before the internal deadline (3 Dec 2026 23:00 ICT) and no
  3D code exists; the slice must stay small (positioning section 11, master plan risk register).
- Issue #4 (URL checker flags official country domains such as `google.co.uk`) was closed as
  completed on 2026-11-07, but `src/lib/urlCheck.ts` has not been changed; the false positive
  still exists (the checker is now legacy code, not shown on the site).
- PR #7 did not update this file or the architecture documents; reconciled on 2026-11-08.
- `ACCESSIBILITY.md` still describes the flat light theme of PR #2; not re-audited after PR #7.
- No automated tests; no accessibility audit yet.

## Task History

### 2026-11-08 — Product positioning for the first-person 3D direction

- **Objective:** Establish the canonical product positioning after the owner's decision that
  SCAMMAZE is a browser-based, first-person 3D narrative game (Frankenstein category), and
  reconcile conflicting documents. Documentation only.
- **Changes:** Audited the repository, including PR #7, which had merged after the previous
  documentation task. Wrote the canonical positioning: definition, vision and north star,
  problem, audiences, core loop, world and chapters, technology chimera with an interdependence
  trace, hybrid intelligence architecture, AI capability matrix with the Bounded Scam Actor as the
  signature capability, differentiation, visual direction and browser 3D performance principles,
  MVP slice and non-goals, Kiroween mapping, messaging. Turned `docs/positioning.md` into a
  pointer. Updated README, AGENTS.md product principles, the master plan's executive summary
  (with "Amended 8 Nov 2026" notes in sections 0, 3.1, 3.4, 3.5, 4.1, 10, 11.1 and 13),
  OVERVIEW (current state after PR #7, 3D game client, deterministic core, AI layer,
  reconciliation, landing page accuracy), DEPLOYMENT and COST_ESTIMATION (3D assets, AI cost,
  `VITE_GAME_URL`, lockfile). Corrected a code comment in `src/config/site.ts` and the README
  that presented `play.scammaze.com` as planned. No application behaviour changed, no
  dependencies installed, no AWS resources, domains, databases or AI providers.
- **Files modified:** created `docs/product/PRODUCT_POSITIONING.md`; modified
  `docs/positioning.md`, `README.md`, `AGENTS.md`, `CONTRIBUTING.md`,
  `SCAMMAZE_KIROWEEN_2026_FULL_PLAN.md`, `docs/architecture/OVERVIEW.md`,
  `docs/architecture/DEPLOYMENT.md`, `docs/finops/COST_ESTIMATION.md`,
  `docs/PROJECT_PROGRESS.md`, `.kiro/steering/audience.md`, `src/config/site.ts` (comment only).
- **Validation:** Documentation checks for relative links and anchors, Markdown table column
  counts, Mermaid structure, emoji, non-English text, secrets and cost-table arithmetic; grep
  review for 2D-only framing, 3D out-of-scope claims, proposed domains and AI overreach; CI
  `pnpm build` on the pull request.
- **Build/test results:** recorded in the pull request for this task; no test suite exists.
- **Known limitations:** The Kiroween 2026 judging criteria and category text were taken from
  master plan section 1.2 and the published Kiroween category description; the 2026 rules page
  was not re-read in this task. Mermaid diagrams were checked structurally, not rendered. No
  performance figures exist; all budgets are deferred to prototype benchmarks.
- **Architecture deviations:** 3D world moved from out of scope to the core platform; AI layer
  elevated from optional coach to a proposed product component with the same safety boundaries;
  the landing page copy no longer matches the product definition.
- **Follow-up tasks:** owner decisions listed above; update landing page copy; 3D prototype and
  benchmark; `.kiro/specs/` for the deterministic core and Chapter 1; switch CI to
  `--frozen-lockfile`; re-audit accessibility after PR #7.

### 2026-11-07 — Cinematic landing page redesign (PR #7, recorded retroactively)

- **Note:** Recorded on 2026-11-08 from the merged pull request; the original PR did not add an
  entry.
- **Changes (from PR #7):** Replaced the flat landing page with an 11-section dark marketing
  page; added `src/config/site.ts` and `.env.example` (`VITE_GAME_URL`); added `lucide-react` and
  self-hosted fonts; committed `pnpm-lock.yaml`; moved the demo scenario, URL checker and old
  sections to `src/legacy/` (not mounted).
- **Build/test results:** The `main` deployment of `8c66005` was reported `success` by GitHub.

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
