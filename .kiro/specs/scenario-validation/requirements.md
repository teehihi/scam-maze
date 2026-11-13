# Requirements: Scenario Engine Validation

## Introduction

SCAMMAZE stories are data (`ScenarioDefinition`) played by a pure reducer. Chapter 1 is validated
today by `validateScenarioIssues` (static checks V1/V3/V4), `analyzeReachability` (a solver over
real reducer states), `validateChapterContent` (voice and subtitles, V5-V7) and the 17 property files
in `game/narrative/properties/`, which all run on the single real scenario. Before more chapters are authored, validation must hold
for scenarios that do not exist yet: faulty, partial or reordered data must be detected and must
never crash the game. This spec closes those gaps without changing gameplay.

Out of scope: new gameplay rules, a numeric score (none exists; outcomes are categorical and
`pressure` 0..3 is the only number), AI-generated content.

## Glossary

- **Validator**: `validateScenarioIssues` / `validateScenario` in `game/narrative/validateScenario.ts`.
- **Solver**: `analyzeReachability` in `game/narrative/reachability.ts`.
- **Gate**: the scenario test set run by the scenario hook (validator, solver, content lint, scenario properties).
- **Fault**: a deliberate defect injected into a JSON clone of a valid scenario.

## Requirements

### Requirement 1: Detect structural faults in any scenario

**User story:** As a scenario author, I want every broken reference or impossible shape reported with its location, so that I can fix it before anyone plays it.

#### Acceptance criteria

1.1 WHEN an option's `next` names a node that does not exist THE Validator SHALL report a V1 issue whose message names the missing node.
1.2 WHEN a graph's `startNodeId` does not exist THE Validator SHALL report a V1 issue naming the start node.
1.3 WHEN an end node has options, a spoken node has no tone, `pauseBeforeMs` is outside 0..3000, or two options share an ID THE Validator SHALL report a V1 issue naming the node or option.
1.4 WHEN a node cannot reach an end node (including a cycle with no exit) THE Validator SHALL report a V3 issue naming the node.
1.5 WHEN a condition can never be true in combination with the effects that could satisfy it THE Validator SHALL report a V4 issue. (Static single-condition checks exist; combined satisfiability is open.)

### Requirement 2: The engine is robust to faulty scenarios

**User story:** As a player, I want the game to keep working even if a scenario file has a mistake, so that a content bug never crashes the page.

#### Acceptance criteria

2.1 WHEN the reducer plays any action sequence against a faulty scenario THE system SHALL NOT throw.
2.2 WHEN an action is rejected THE system SHALL return the same state object with a reason.
2.3 WHEN actions are accepted THE event log SHALL keep `seq` equal to its index.

### Requirement 3: The validator is total, pure and deterministic

**User story:** As a developer, I want to run the validator on untrusted or half-written data, so that tools and hooks can call it on anything.

#### Acceptance criteria

3.1 WHEN the Validator receives any value (garbage, partial objects, wrong types) THE Validator SHALL return a list of issues and SHALL NOT throw; WHEN the value is not an object, or lacks objectives, dialogues, decisions, endings or acts, THE list SHALL NOT be empty.
3.2 THE Validator SHALL NOT modify its input.
3.3 WHEN the Validator runs twice on the same input THE results SHALL be identical.
3.4 THE Validator SHALL return issues with a known check code and a non-empty location and message, and `validateScenario` SHALL equal the issue messages.

### Requirement 4: Numeric state stays in range

**User story:** As a game designer, I want pressure to stay within its levels whatever the effects say, so that tense dialogue cannot produce an invalid state.

#### Acceptance criteria

4.1 WHEN any sequence of `addPressure` effects with any amount (negative, fractional, NaN, infinite, huge or missing) is applied THE system SHALL keep `pressure` an integer within 0..3.

### Requirement 5: Static validation and play agree

**User story:** As a scenario author, I want "valid" to mean "playable to every ending", so that a clean validator run is trustworthy.

#### Acceptance criteria

5.1 WHEN a scenario is changed in a meaning-preserving way (node and option order) THE Validator SHALL report no issues AND the Solver SHALL reach every outcome without truncation, soft lock or unreachable node.
5.2 WHEN a well-formed node is added that no option leads to THE Validator SHALL accept it AND the Solver SHALL report it as unreachable.
5.3 WHEN the gate fails THE output SHALL include the seed that reproduces the case.

### Requirement 6: Authoring workflow

**User story:** As a scenario author, I want one command and automatic checks while I edit, so that I do not have to remember the test list.

#### Acceptance criteria

6.1 WHEN an agent saves or creates a narrative or chapter-text file THE scenario hook SHALL run the gate and report failures. (Implemented: `.kiro/hooks/scenario-*.json`.)
6.2 THE repository SHALL provide `pnpm --filter @scammaze/game scenario:check` that runs the gate and prints the validator and solver summary.
6.3 WHERE scenario data arrives from outside the bundle (future: downloaded chapters, AI-proposed wording) THE system SHALL parse it with a guard that returns a result, before the reducer sees it.
