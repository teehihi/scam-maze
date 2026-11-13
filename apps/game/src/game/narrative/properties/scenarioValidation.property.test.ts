/**
 * Scenario validation properties (spec: .kiro/specs/scenario-validation, "Correctness Properties").
 *
 * The existing property files exercise the engine on the one real scenario. These properties
 * exercise the validator and the engine on GENERATED scenarios: seeded faults injected into a
 * copy of Chapter 1, seeded garbage, and seeded meaning-preserving variants.
 *
 * - SV1 Fault detection: every injected fault (dangling option target, missing start node, end
 *   node with options, pauseBeforeMs out of range, spoken node without a tone, duplicate option
 *   ID, one-node and two-node cycles with no exit) is reported with the right check code and
 *   names the mutated item.
 * - SV2 Robust engine: the reducer never throws on a faulty scenario; rejections return the same
 *   state with a reason, and the event log stays contiguous. The share of cases whose play
 *   reached the faulty dialogue graph is measured and must be above zero.
 * - SV3 Total, pure and deterministic validator: garbage never throws, never mutates the input
 *   (deep comparison that sees NaN and undefined), gives the same issues twice, every issue is
 *   well formed, and a root that is not an object is always rejected.
 * - SV4 Pressure bounds: `addPressure` keeps pressure an integer in 0..MAX_PRESSURE for any amount
 *   (negative, fractional, NaN, infinite, huge, missing, or not a number at all).
 * - SV5 Static and dynamic agreement: meaning-preserving variants stay valid and still reach every
 *   outcome with no soft lock; an orphan node passes the static check but the solver reports it
 *   as unreachable.
 *
 * Reproduce one case: the failure prints `SCAMMAZE_PBT_SEED=<seed>` (and, for SV1,
 * `SCAMMAZE_PBT_FAULT=<kind>`); prefix the command with those variables:
 *   pnpm --filter @scammaze/game exec vitest run src/game/narrative/properties/scenarioValidation.property.test.ts
 * Change the case count (default 200, the repo's CORE_PROPERTY_RUNS): SCAMMAZE_PBT_RUNS=<n>.
 * Quick mode for hooks (one solver variant in SV5 instead of four): SCAMMAZE_PBT_QUICK=1.
 *
 * **Validates: Requirements 1.1-1.4, 2.1-2.3, 3.1-3.4, 4.1, 5.1-5.3 (scenario-validation spec)**
 */
import { isDeepStrictEqual } from "node:util";
import { describe, expect, it } from "vitest";
import {
  CORE_PROPERTY_RUNS,
  CORE_PROPERTY_SEED,
  CORE_SEQUENCE_MAX_LENGTH,
  caseSeed,
  generateActionSequence,
} from "../../../test/chapterRuns";
import { createLcg, pick, randomInt } from "../../../test/seededRandom";
import { CHAPTER_1_SCENARIO } from "../chapter1/scenario";
import { OUTCOME_IDS } from "../chapter1/ids";
import { MAX_PRESSURE, applyEffect } from "../conditions";
import { analyzeReachability } from "../reachability";
import { chapterReducer, createInitialState } from "../reducer";
import type { ChapterState, DialogueGraph, DialogueNode, DialogueOption, Effect, ScenarioDefinition } from "../types";
import { MAX_PAUSE_BEFORE_MS, validateScenario, validateScenarioIssues, type ValidatorCheck } from "../validateScenario";

/** Offset so these cases do not reuse another property file's sequences. */
const PROPERTY_SEED = (CORE_PROPERTY_SEED ^ 0x5ce4a710) >>> 0;
const PROPERTY_TIMEOUT_MS = 120_000;

/** Seeds for this run: one seed from the environment (reproduction) or `runs` derived seeds. */
function seeds(offset: number, defaultRuns: number = CORE_PROPERTY_RUNS): number[] {
  const single = process.env.SCAMMAZE_PBT_SEED;
  if (single !== undefined && single !== "") return [Number(single) >>> 0];
  const runs = Number(process.env.SCAMMAZE_PBT_RUNS ?? defaultRuns);
  const count = Number.isFinite(runs) && runs > 0 ? Math.floor(runs) : defaultRuns;
  return Array.from({ length: count }, (_, i) => caseSeed((PROPERTY_SEED + offset) >>> 0, i));
}

function failureReport(failures: string[]): string {
  return failures.length === 0
    ? ""
    : `${failures.length} failing case(s). Reproduce one with the variables printed in its line.\n${failures.slice(0, 10).join("\n")}`;
}

/** Scenario_Data is plain JSON-compatible data. */
function clone(scenario: ScenarioDefinition): ScenarioDefinition {
  return JSON.parse(JSON.stringify(scenario)) as ScenarioDefinition;
}

const ORIGINAL_JSON = JSON.stringify(CHAPTER_1_SCENARIO);

// ---------------------------------------------------------------------------
// Generators over the scenario structure
// ---------------------------------------------------------------------------

interface NodeRef {
  graph: DialogueGraph;
  node: DialogueNode;
}

function graphs(scenario: ScenarioDefinition): DialogueGraph[] {
  return Object.values(scenario.dialogues);
}

function allNodes(scenario: ScenarioDefinition): NodeRef[] {
  return graphs(scenario).flatMap((graph) => Object.values(graph.nodes).map((node) => ({ graph, node })));
}

function allOptions(scenario: ScenarioDefinition): { graph: DialogueGraph; node: DialogueNode; option: DialogueOption }[] {
  return allNodes(scenario).flatMap(({ graph, node }) => node.options.map((option) => ({ graph, node, option })));
}

/** Same rule as the voice layer: callers and NPCs speak; the player and narration do not. */
function isSpoken(node: DialogueNode): boolean {
  return node.speaker === "caller" || node.speaker === "npc";
}

/** Non-end node whose options all lead to nodes (no hang-up option), so it can be trapped. */
function isTrappable(node: DialogueNode): boolean {
  return node.end === undefined && node.options.length > 0 && node.options.every((o) => typeof o.next === "string");
}

interface InjectedFault {
  /** Name of the fault kind, for the failure message. */
  fault: string;
  check: ValidatorCheck;
  /** Text that the expected issue's message must contain (it names the mutated item). */
  mentions: string;
  /** Dialogue graph that holds the fault (SV2 measures whether play reached it). */
  graphId: string;
}

type FaultInjector = (scenario: ScenarioDefinition, next: () => number, seed: number) => InjectedFault | null;

const FAULTS: readonly FaultInjector[] = [
  // 0. Option pointing to a node that does not exist.
  (scenario, next, seed) => {
    const targets = allOptions(scenario).filter(({ option }) => typeof option.next === "string");
    if (targets.length === 0) return null;
    const { graph, option } = pick(next, targets);
    const target = `__missing.node.${seed}`;
    option.next = target;
    return { fault: "dangling option target", check: "V1", mentions: `points to unknown node "${target}"`, graphId: graph.id };
  },
  // 1. Graph whose start node does not exist.
  (scenario, next, seed) => {
    const graph = pick(next, graphs(scenario));
    const target = `__missing.start.${seed}`;
    graph.startNodeId = target;
    return { fault: "missing start node", check: "V1", mentions: `start node "${target}" does not exist`, graphId: graph.id };
  },
  // 2. End node that still offers options.
  (scenario, next, seed) => {
    const ends = allNodes(scenario).filter(({ node }) => node.end !== undefined);
    const donors = allOptions(scenario);
    if (ends.length === 0 || donors.length === 0) return null;
    const { graph, node } = pick(next, ends);
    const extra: DialogueOption = { ...pick(next, donors).option, id: `__extra.option.${seed}` };
    node.options = [...node.options, extra];
    return { fault: "end node with options", check: "V1", mentions: `node "${node.id}" is an end node but has options`, graphId: graph.id };
  },
  // 3. pauseBeforeMs outside 0..MAX_PAUSE_BEFORE_MS.
  (scenario, next) => {
    const spoken = allNodes(scenario).filter(({ node }) => isSpoken(node));
    if (spoken.length === 0) return null;
    const { graph, node } = pick(next, spoken);
    node.pauseBeforeMs = pick(next, [-1, -250, -0.5, MAX_PAUSE_BEFORE_MS + 1, 1e9]);
    return { fault: "pauseBeforeMs out of range", check: "V1", mentions: `node "${node.id}" has pauseBeforeMs`, graphId: graph.id };
  },
  // 4. Spoken node without a tone.
  (scenario, next) => {
    const toned = allNodes(scenario).filter(({ node }) => isSpoken(node) && node.tone !== undefined);
    if (toned.length === 0) return null;
    const { graph, node } = pick(next, toned);
    delete node.tone;
    return { fault: "spoken node without tone", check: "V1", mentions: `node "${node.id}" is spoken but has no tone`, graphId: graph.id };
  },
  // 5. Two options with the same ID.
  (scenario, next) => {
    const options = allOptions(scenario);
    if (options.length < 2) return null;
    const first = pick(next, options);
    const second = pick(next, options.filter((o) => o !== first));
    second.option.id = first.option.id;
    return { fault: "duplicate option ID", check: "V1", mentions: `Duplicate option ID "${first.option.id}"`, graphId: second.graph.id };
  },
  // 6. One-node cycle: every option of a non-end node loops back to itself.
  (scenario, next) => {
    const candidates = allNodes(scenario).filter(({ node }) => isTrappable(node));
    if (candidates.length === 0) return null;
    const { graph, node } = pick(next, candidates);
    node.options = node.options.map((o) => ({ ...o, next: node.id }));
    return { fault: "one-node cycle with no exit", check: "V3", mentions: `node "${node.id}" cannot reach an end node`, graphId: graph.id };
  },
  // 7. Two-node cycle: A's options all go to B and B's options all go back to A.
  (scenario, next) => {
    const pairs = allNodes(scenario).flatMap(({ graph, node }) =>
      isTrappable(node)
        ? node.options
            .map((o) => graph.nodes[o.next as string])
            .filter((b): b is DialogueNode => b !== undefined && b.id !== node.id && isTrappable(b))
            .map((b) => ({ graph, a: node, b }))
        : [],
    );
    if (pairs.length === 0) return null;
    const { graph, a, b } = pick(next, pairs);
    a.options = a.options.map((o) => ({ ...o, next: b.id }));
    b.options = b.options.map((o) => ({ ...o, next: a.id }));
    return { fault: "two-node cycle with no exit", check: "V3", mentions: `node "${a.id}" cannot reach an end node`, graphId: graph.id };
  },
];

describe("Scenario validation properties", () => {
  // ---------------------------------------------------------------------------
  // SV1 + SV2
  // ---------------------------------------------------------------------------

  // Feature: scenario-validation, Property SV1: injected faults are detected and located
  // Feature: scenario-validation, Property SV2: the engine stays robust on a faulty scenario
  it(
    "detects every injected fault and the reducer never throws on the faulty scenario",
    () => {
      const failures: string[] = [];
      const forcedKind = process.env.SCAMMAZE_PBT_FAULT;
      let cases = 0;
      let reachedFaultGraph = 0;
      for (const [index, seed] of seeds(1).entries()) {
        const next = createLcg(seed);
        const scenario = clone(CHAPTER_1_SCENARIO);
        // Cycle through the fault kinds so every kind is covered; the target is seeded.
        const kind = forcedKind !== undefined && forcedKind !== "" ? Number(forcedKind) : index % FAULTS.length;
        const repro = `SCAMMAZE_PBT_SEED=${seed} SCAMMAZE_PBT_FAULT=${kind}`;
        const injected = FAULTS[kind](scenario, next, seed);
        if (injected === null) {
          failures.push(`${repro}: fault kind ${kind} found no target in Chapter 1`);
          continue;
        }
        cases += 1;
        const label = `${repro} (${injected.fault})`;

        // SV1: reported with the right check and naming the item.
        const issues = validateScenarioIssues(scenario);
        const found = issues.some((issue) => issue.check === injected.check && issue.message.includes(injected.mentions));
        if (!found) {
          failures.push(
            `${label}: expected a ${injected.check} issue mentioning '${injected.mentions}', got ${JSON.stringify(issues.map((i) => `${i.check}: ${i.message}`).slice(0, 4))}`,
          );
        }

        // SV2: seeded play on the faulty scenario never throws and keeps the result contract.
        try {
          const actions = generateActionSequence(seed, randomInt(next, 20, CORE_SEQUENCE_MAX_LENGTH), createInitialState(), scenario);
          let state: ChapterState = createInitialState();
          let touched = false;
          for (const action of actions) {
            const result = chapterReducer(state, action, scenario);
            if (typeof result.accepted !== "boolean" || result.state === undefined) {
              failures.push(`${label}: malformed ActionResult for ${JSON.stringify(action)}`);
              break;
            }
            if (!result.accepted && (result.state !== state || typeof result.reason !== "string" || result.reason === "")) {
              failures.push(`${label}: rejection changed the state or has no reason (${String(result.reason)})`);
              break;
            }
            if (result.state.events.some((event, i) => event.seq !== i)) {
              failures.push(`${label}: event log seq is not contiguous`);
              break;
            }
            state = result.state;
            if (state.conversation?.graphId === injected.graphId) touched = true;
          }
          if (touched) reachedFaultGraph += 1;
        } catch (error) {
          failures.push(`${label}: engine threw: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      // Mutations happen on clones only.
      expect(JSON.stringify(CHAPTER_1_SCENARIO)).toBe(ORIGINAL_JSON);
      expect(failures, failureReport(failures)).toEqual([]);
      // SV2 is only meaningful if play actually reaches faulty graphs in some cases.
      if (cases >= FAULTS.length) {
        expect(reachedFaultGraph, `play reached the faulty graph in ${reachedFaultGraph} of ${cases} cases`).toBeGreaterThan(0);
      }
      console.info(`[SV2] play reached the faulty dialogue graph in ${reachedFaultGraph} of ${cases} cases`);
    },
    PROPERTY_TIMEOUT_MS,
  );

  // ---------------------------------------------------------------------------
  // SV3
  // ---------------------------------------------------------------------------

  const JUNK: readonly unknown[] = [null, undefined, 0, -1, 42, "", "x", true, [], {}, [null], { id: 7 }, Number.NaN];
  const NON_OBJECT_JUNK: readonly unknown[] = [null, undefined, 0, 42, "", "x", true, [], [null], Number.NaN];

  /** Replaces 1-4 random values at depth 1-3 with junk. Returns the mutated paths. */
  function corrupt(target: Record<string, unknown>, next: () => number): string[] {
    const paths: string[] = [];
    const edits = randomInt(next, 1, 4);
    for (let e = 0; e < edits; e += 1) {
      let holder: Record<string, unknown> = target;
      const path: string[] = [];
      const depth = randomInt(next, 1, 3);
      for (let d = 0; d < depth; d += 1) {
        const keys = Object.keys(holder);
        if (keys.length === 0) break;
        const key = pick(next, keys);
        path.push(key);
        const child = holder[key];
        if (d === depth - 1 || child === null || typeof child !== "object") {
          holder[key] = pick(next, JUNK);
          break;
        }
        holder = child as Record<string, unknown>;
      }
      paths.push(path.join("."));
    }
    return paths;
  }

  // Feature: scenario-validation, Property SV3: the validator is total, pure and deterministic
  it(
    "never throws on garbage, never mutates its input, returns the same well-formed issues twice and rejects non-object roots",
    () => {
      const failures: string[] = [];
      const checks: ReadonlySet<string> = new Set<ValidatorCheck>(["V1", "V3", "V4"]);
      for (const seed of seeds(2)) {
        const next = createLcg(seed);
        // A fifth of the cases replace the whole scenario with a value that is not an object.
        const rootJunk = next() < 0.2;
        const scenario: unknown = rootJunk ? pick(next, NON_OBJECT_JUNK) : clone(CHAPTER_1_SCENARIO);
        const paths = rootJunk ? ["<root>"] : corrupt(scenario as Record<string, unknown>, next);
        const label = `SCAMMAZE_PBT_SEED=${seed} (corrupted ${paths.join(", ")})`;
        const before = structuredClone(scenario);
        try {
          const first = validateScenarioIssues(scenario as ScenarioDefinition);
          const second = validateScenarioIssues(scenario as ScenarioDefinition);
          if (!isDeepStrictEqual(scenario, before)) failures.push(`${label}: validator mutated its input`);
          if (!Array.isArray(first)) {
            failures.push(`${label}: result is not an array`);
            continue;
          }
          if (!isDeepStrictEqual(first, second)) failures.push(`${label}: issues differ between two runs`);
          const bad = first.find(
            (issue) => !checks.has(issue.check) || typeof issue.where !== "string" || issue.where === "" || typeof issue.message !== "string" || issue.message === "",
          );
          if (bad) failures.push(`${label}: malformed issue ${JSON.stringify(bad)}`);
          if (rootJunk && first.length === 0) failures.push(`${label}: a non-object root was accepted as a valid scenario`);
          const messages = validateScenario(scenario as ScenarioDefinition);
          if (!isDeepStrictEqual(messages, first.map((issue) => issue.message))) {
            failures.push(`${label}: validateScenario differs from validateScenarioIssues messages`);
          }
        } catch (error) {
          failures.push(`${label}: validator threw: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      expect(failures, failureReport(failures)).toEqual([]);
    },
    PROPERTY_TIMEOUT_MS,
  );

  // ---------------------------------------------------------------------------
  // SV4
  // ---------------------------------------------------------------------------

  // Numbers of every kind, plus values loaded data could contain although the type says number.
  const AMOUNTS: readonly unknown[] = [
    undefined, 0, 1, 2, 3, 4, 7, -1, -2, -9, 0.4, 1.9, -0.6, 2.5, 1e9, -1e9,
    Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.MAX_SAFE_INTEGER, Number.EPSILON,
    null, "2", "abc", true, {},
  ];

  // Feature: scenario-validation, Property SV4: pressure stays an integer in 0..MAX_PRESSURE
  it("keeps pressure an integer within 0..MAX_PRESSURE for any sequence of amounts", () => {
    const failures: string[] = [];
    const started = chapterReducer(createInitialState(), { type: "START_CHAPTER" }, CHAPTER_1_SCENARIO).state;
    for (const seed of seeds(3, CORE_PROPERTY_RUNS * 2)) {
      const next = createLcg(seed);
      // Any valid starting level (state invariants keep pressure in 0..3).
      let state: ChapterState = { ...started, pressure: randomInt(next, 0, MAX_PRESSURE) as ChapterState["pressure"] };
      const applied: string[] = [];
      for (let step = 0, steps = randomInt(next, 1, 30); step < steps; step += 1) {
        const amount = pick(next, AMOUNTS);
        applied.push(JSON.stringify(amount) ?? "undefined");
        const effect = (amount === undefined ? { kind: "addPressure" } : { kind: "addPressure", amount }) as Effect;
        state = applyEffect(state, effect, CHAPTER_1_SCENARIO);
        if (!Number.isInteger(state.pressure) || state.pressure < 0 || state.pressure > MAX_PRESSURE) {
          failures.push(`SCAMMAZE_PBT_SEED=${seed}: pressure ${String(state.pressure)} after amounts [${applied.join(", ")}]`);
          break;
        }
      }
    }
    expect(failures, failureReport(failures)).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // SV5
  // ---------------------------------------------------------------------------

  /**
   * Meaning-preserving variant: node records and option lists in a seeded different order.
   * Order-sensitive lists (`startNodeWhen`, ending variants, acts) are first-match or sequential
   * by design, so reordering them would change the meaning; they are left alone on purpose.
   */
  function reorderedVariant(next: () => number): ScenarioDefinition {
    const scenario = clone(CHAPTER_1_SCENARIO);
    for (const graph of graphs(scenario)) {
      const entries = Object.entries(graph.nodes);
      if (next() < 0.5) entries.reverse();
      graph.nodes = Object.fromEntries(entries);
      for (const node of Object.values(graph.nodes)) {
        if (next() < 0.5) node.options = [...node.options].reverse();
      }
    }
    return scenario;
  }

  /** A valid end node that no option leads to (same speaker, line and tone as an existing node). */
  function addOrphanNode(scenario: ScenarioDefinition, next: () => number, seed: number): string {
    const spoken = allNodes(scenario).filter(({ node }) => isSpoken(node) && node.tone !== undefined && node.end === undefined);
    const { graph, node } = pick(next, spoken);
    const id = `orphan.${seed}`;
    const orphan: DialogueNode = { ...node, id, options: [], end: { kind: "completed" } };
    delete orphan.onEnter;
    delete orphan.pressure;
    graph.nodes[id] = orphan;
    return id;
  }

  // Feature: scenario-validation, Property SV5: static validation and the solver agree
  it(
    "keeps reordered variants valid and fully reachable, and reports an orphan node as unreachable",
    () => {
      const failures: string[] = [];
      // Each solver run explores the full state space (about 2 s), so this property uses a few
      // variants and never the general case count. SCAMMAZE_PBT_QUICK=1 (hooks) runs one.
      const variantSeeds = seeds(4, 4).slice(0, process.env.SCAMMAZE_PBT_QUICK === "1" ? 1 : 4);
      for (const seed of variantSeeds) {
        const next = createLcg(seed);
        const variant = reorderedVariant(next);
        const label = `SCAMMAZE_PBT_SEED=${seed}`;

        const staticIssues = validateScenario(variant);
        if (staticIssues.length > 0) failures.push(`${label}: reordered variant has issues ${JSON.stringify(staticIssues.slice(0, 3))}`);
        const report = analyzeReachability(variant);
        if (report.truncated) failures.push(`${label}: solver budget exceeded (a truncated report proves nothing)`);
        const missing = OUTCOME_IDS.filter((outcome) => !report.outcomesReached.includes(outcome));
        if (missing.length > 0) failures.push(`${label}: outcomes not reachable: ${missing.join(", ")}`);
        if (report.softLocks.length > 0) failures.push(`${label}: soft locks ${report.softLocks.slice(0, 3).join(" | ")}`);
        if (report.unreachableNodes.length > 0) failures.push(`${label}: unreachable nodes ${report.unreachableNodes.join(", ")}`);

        const withOrphan = clone(variant);
        const orphanId = addOrphanNode(withOrphan, next, seed);
        const orphanIssues = validateScenario(withOrphan);
        if (orphanIssues.length > 0) failures.push(`${label}: orphan end node should pass the static check, got ${JSON.stringify(orphanIssues.slice(0, 3))}`);
        const orphanReport = analyzeReachability(withOrphan);
        if (!orphanReport.unreachableNodes.includes(orphanId)) {
          failures.push(`${label}: solver did not report orphan node "${orphanId}" as unreachable`);
        }
      }
      expect(failures, failureReport(failures)).toEqual([]);
    },
    PROPERTY_TIMEOUT_MS,
  );
});
