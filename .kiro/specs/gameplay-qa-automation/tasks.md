# Implementation Plan: Automated Gameplay QA

## Overview

Start from the verified Playwright MCP flow, turn it into committed flows with a Runner, then add
the probe and the Chapter 1 outcome flows. Never start or stop the owner's dev server.

## Tasks

- [x] 0. Agent QA layer (done 2026-11-13)
  - [x] 0.1 Playwright MCP configured in `.kiro/settings/mcp.json` and verified over stdio (initialize, 25 tools, 11/11 checks on port 5174)
  - [x] 0.2 Bug found by the flow (one ArrowDown moved two items in StrictMode) fixed with `features/menu/MainMenuOverlay.test.tsx`
  - _Requirements: 5.1_
- [ ] 1. Runner
  - [ ] 1.1 Decide `playwright` vs `@playwright/test` (pinned, root devDependency, license note); add `apps/game/qa/run.ts` and the `qa` package script
  - [ ] 1.2 Port the menu -> chapter -> back flow as `qa/flows/menu-to-chapter-and-back.ts` with per-step screenshots and console capture
  - _Requirements: 1.1, 3.1, 3.2, 3.3, 4.1_
- [ ] 2. QA probe
  - [ ] 2.1 `app/qaProbe.ts` (dev/QA builds only, read-only copies) and its unit tests (absent in production mode, copies not live objects)
  - _Requirements: 2.1, 2.2_
- [ ] 3. Chapter 1 outcome flows
  - [ ] 3.1 `verified` flow with debrief check; **Property Q1** cross-check against `chapterReducer`
  - [ ] 3.2 `risky` flow; Vietnamese variant of the menu flow
  - _Requirements: 1.2, 1.3, 1.4_
- [ ] 4. CI
  - [ ] 4.1 Add a CI job: build, `vite preview`, run flows headless with software WebGL; upload `.kiro/qa-output` as an artifact
  - _Requirements: 4.2, 4.3_
- [ ] 5. Checkpoint: run every flow twice (**Property Q2**), review flakiness with the owner.
