# Requirements: Automated Gameplay QA

## Introduction

Gameplay logic is well covered in jsdom (125+ test files, 1100+ tests), but nothing checks the
real browser flow: WebGL scenes, pointer lock, loading, the voiced intro, overlays and returning to
the menu. Two real regressions in this period were only visible in a browser: the menu showing only
sky after "Return to menu" (shared cached GLTF), and one ArrowDown moving two menu items in the
StrictMode dev build. Both were found by hand or by an ad hoc Playwright MCP run.

This spec makes the browser flow a repeatable regression suite that agents (through Playwright
MCP) and developers (through a script) can run against the dev server the owner keeps on port
5174, and that CI can run against a preview build.

## Glossary

- **QA_Flow**: a named, ordered list of steps with assertions (for example `menu-to-chapter-and-back`).
- **QA_Probe**: a read-only, development-only window object exposing selected game state for assertions.
- **Runner**: the script that executes QA_Flows with Playwright.

## Requirements

### Requirement 1: Flows cover the main regression surface

1.1 THE suite SHALL include flows for: menu render and keyboard navigation; Settings and Credits open/close with focus return; New Game -> loading -> voiced intro -> in game; pause -> Return to menu with the street visible and CONTINUE enabled; Continue restores the saved run.
1.2 THE suite SHALL include a Chapter 1 flow that answers the first call, inspects evidence, verifies independently and reaches the `verified` outcome and the debrief.
1.3 THE suite SHALL include a flow that reaches the `risky` outcome and checks the debrief explains the warning signs.
1.4 WHEN a flow runs in Vietnamese THE assertions SHALL use the Vietnamese strings from the dictionaries, not hard-coded text.

### Requirement 2: Deterministic, state-based assertions

2.1 WHERE the build is a development or QA build THE system SHALL expose a QA_Probe with read-only `ChapterState` fields (status, outcome, objectives, discovered evidence, current act) and the menu's active item.
2.2 THE QA_Probe SHALL NOT allow writing state and SHALL NOT exist in production builds.
2.3 Assertions SHALL prefer DOM roles, test ids and QA_Probe state over pixel checks; pixel checks are limited to "the 3D scene rendered" heuristics.

### Requirement 3: Evidence and reporting

3.1 WHEN a flow runs THE Runner SHALL save a screenshot per step and the console log under `.kiro/qa-output/<run>/`.
3.2 WHEN any console error, page error or failed request occurs THE flow SHALL fail and list them.
3.3 THE Runner SHALL print a pass/fail table and exit non-zero on failure.

### Requirement 4: Environments

4.1 THE Runner SHALL accept a base URL and default to `http://localhost:5174`, and SHALL NOT start or stop a dev server.
4.2 THE CI job SHALL run the flows against `vite preview` of the production build with software WebGL.
4.3 The suite SHALL document that headless software WebGL validates flow and layout, not frame rate.

### Requirement 5: Agent use

5.1 THE gameplay-testing skill SHALL describe each flow so an agent can run it through Playwright MCP step by step.
5.2 WHEN the qa-security-reviewer reviews a UI change THE review SHALL include the relevant QA_Flow result or say why it could not run.
