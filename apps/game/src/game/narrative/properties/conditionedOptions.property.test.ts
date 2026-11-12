// Property 5 (.kiro/specs/chapter-01-voice-narrative/design.md, "Correctness Properties"):
// evidence-conditioned options are deterministic and local.
//
// For any two states that agree on `flags`, `discovered`, `claims`, the call log statuses and the
// current node, `availableOptions` and the start node are equal (no dependence on `events`,
// `pressure` or time). For every option whose only condition is `hasEvidence(e)`, the option is
// available exactly when `e` is in `discovered`. For each link in the design.md table "Where
// earlier choices change later dialogue", adding the named evidence or flag changes the
// available options or the start node.
//
// Cases are seeded (fixed seed, CORE_PROPERTY_RUNS = 200 per property). A failure prints the
// seed, the case index and the state that broke the property.

import { describe, expect, it } from "vitest";

import { CORE_PROPERTY_RUNS, CORE_PROPERTY_SEED, caseSeed } from "../../../test/chapterRuns";
import { createLcg, pick, randomInt } from "../../../test/seededRandom";
import { EVIDENCE_IDS, FLAG_IDS, type EvidenceId, type FlagId } from "../chapter1/ids";
import { CHAPTER_1_SCENARIO } from "../chapter1/scenario";
import { canDiscover } from "../evidence";
import { availableOptions, resolveStartNode } from "../dialogueEngine";
import { createInitialState } from "../reducer";
import type { ChapterState, DialogueGraph, DialogueNode } from "../types";

/** Seed offset so this file's cases differ from other core property files. */
const SEED = (CORE_PROPERTY_SEED ^ 0x0105) >>> 0;

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 60_000;

const SCENARIO = CHAPTER_1_SCENARIO;
const GRAPHS: DialogueGraph[] = Object.values(SCENARIO.dialogues);

interface NodeRef {
  graph: DialogueGraph;
  node: DialogueNode;
}

/** Every non-end node of every graph, in a fixed order. */
const NODE_REFS: NodeRef[] = GRAPHS.flatMap((graph) =>
  Object.values(graph.nodes)
    .filter((node) => !node.end)
    .map((node) => ({ graph, node })),
);

/** A playing state whose current conversation sits at `ref` with the given flags and evidence. */
function stateAt(
  ref: { graphId: DialogueGraph["id"]; nodeId: string },
  discovered: readonly EvidenceId[],
  flags: readonly FlagId[],
): ChapterState {
  const base = createInitialState();
  const flagMap = { ...base.flags };
  for (const flag of flags) flagMap[flag] = true;
  return {
    ...base,
    status: "playing",
    discovered: [...discovered],
    flags: flagMap,
    conversation: { graphId: ref.graphId, nodeId: ref.nodeId, callId: null, history: [] },
  };
}

/** Random subset of `items` (each kept with probability 1/2). */
function subset<T>(next: () => number, items: readonly T[]): T[] {
  return items.filter(() => next() < 0.5);
}

function optionIds(state: ChapterState): string[] {
  return availableOptions(state, SCENARIO).map((option) => option.id);
}

function startNodes(state: ChapterState): string[] {
  return GRAPHS.map((graph) => resolveStartNode(state, graph, SCENARIO));
}

/** Options at `ref` whose only condition is `hasEvidence`. */
function evidenceOnlyOptions(node: DialogueNode): Array<{ id: string; evidenceId: EvidenceId }> {
  const found: Array<{ id: string; evidenceId: EvidenceId }> = [];
  for (const option of node.options) {
    const conditions = option.conditions ?? [];
    if (conditions.length === 1 && conditions[0].kind === "hasEvidence") {
      found.push({ id: option.id, evidenceId: conditions[0].evidenceId });
    }
  }
  return found;
}

function fail(name: string, seed: number, index: number, detail: string): never {
  throw new Error(`${name} failed (seed ${seed}, case ${index}): ${detail}`);
}

describe("Property 5: Evidence-conditioned options are deterministic and local", () => {
  it("options and start nodes depend only on flags, evidence, claims, call log and node", () => {
    // Feature: chapter-01-voice-narrative, Property 5: Evidence-conditioned options are deterministic and local
    for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
      const seed = caseSeed(SEED, index);
      const next = createLcg(seed);
      const { graph, node } = pick(next, NODE_REFS);
      const discovered = subset(next, EVIDENCE_IDS);
      const flags = subset(next, FLAG_IDS);
      const where = `${graph.id}/${node.id} evidence=${JSON.stringify(discovered)} flags=${JSON.stringify(flags)}`;

      const a = stateAt({ graphId: graph.id, nodeId: node.id }, discovered, flags);
      // Twin: same flags, evidence, claims, call log statuses and node; different pressure,
      // event log, phone state and visited interactables.
      const b: ChapterState = {
        ...a,
        pressure: randomInt(next, 0, 3) as ChapterState["pressure"],
        events: [
          {
            action: { type: "OPEN_PHONE" },
            accepted: true,
          } as unknown as ChapterState["events"][number],
        ],
        phone: { ...a.phone, open: !a.phone.open },
        interacted: [...a.interacted, "obj.wallet"],
      };

      if (JSON.stringify(availableOptions(a, SCENARIO)) !== JSON.stringify(availableOptions(b, SCENARIO))) {
        fail("Property 5", seed, index, `availableOptions differ between twins at ${where}`);
      }
      if (JSON.stringify(startNodes(a)) !== JSON.stringify(startNodes(b))) {
        fail("Property 5", seed, index, `start nodes differ between twins at ${where}`);
      }
      // Determinism: repeated calls agree.
      if (JSON.stringify(optionIds(a)) !== JSON.stringify(optionIds(a))) {
        fail("Property 5", seed, index, `availableOptions is not repeatable at ${where}`);
      }
    }
  }, PROPERTY_TIMEOUT_MS);

  it("an option whose only condition is hasEvidence(e) is available exactly when e is discovered", () => {
    // Feature: chapter-01-voice-narrative, Property 5: Evidence-conditioned options are deterministic and local
    const evidenceNodes = NODE_REFS.filter(({ node }) => evidenceOnlyOptions(node).length > 0);
    // Guard against a vacuous pass: the scenario must author such options.
    expect(evidenceNodes.length).toBeGreaterThanOrEqual(8);

    for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
      const seed = caseSeed(SEED ^ 0x77, index);
      const next = createLcg(seed);
      const { graph, node } = pick(next, evidenceNodes);
      const discovered = subset(next, EVIDENCE_IDS);
      const flags = subset(next, FLAG_IDS);
      const state = stateAt({ graphId: graph.id, nodeId: node.id }, discovered, flags);
      const listed = new Set(optionIds(state));
      for (const { id, evidenceId } of evidenceOnlyOptions(node)) {
        const expected = discovered.includes(evidenceId);
        if (listed.has(id) !== expected) {
          fail(
            "Property 5",
            seed,
            index,
            `${graph.id}/${node.id} option ${id}: listed=${listed.has(id)} but ${evidenceId} discovered=${expected}`,
          );
        }
      }
    }
  }, PROPERTY_TIMEOUT_MS);
});

// ---------------------------------------------------------------------------
// Links from design.md "Where earlier choices change later dialogue"
// ---------------------------------------------------------------------------

type Added = { evidence: EvidenceId[]; flags: FlagId[] };

interface Link {
  name: string;
  /** What is added to the state. */
  add: Added;
  /** Returns a readable observation of what the link changes, from a state. */
  observe: (discovered: EvidenceId[], flags: FlagId[]) => string;
  /** Evidence and flags the random context must never contain (they would hide the change). */
  exclude: Added;
}

function optionsAt(graphId: DialogueGraph["id"], nodeId: string) {
  return (discovered: EvidenceId[], flags: FlagId[]): string =>
    JSON.stringify(optionIds(stateAt({ graphId, nodeId }, discovered, flags)));
}

function startNodeOf(graphId: DialogueGraph["id"]) {
  return (discovered: EvidenceId[], flags: FlagId[]): string =>
    resolveStartNode(stateAt({ graphId, nodeId: SCENARIO.dialogues[graphId].startNodeId }, discovered, flags), SCENARIO.dialogues[graphId], SCENARIO);
}

/** True when the evidence item can be inspected: the condition under test for the last link. */
function inspectable(evidenceId: EvidenceId) {
  return (discovered: EvidenceId[], flags: FlagId[]): string =>
    String(
      canDiscover(
        stateAt({ graphId: "dlg.scam-call", nodeId: "scam.open" }, discovered, flags),
        evidenceId,
        "inspect",
        SCENARIO,
      ),
    );
}

const LINKS: Link[] = [
  {
    name: "ev.sms-alert shows the link option (scam.code-request)",
    add: { evidence: ["ev.sms-alert"], flags: [] },
    observe: optionsAt("dlg.scam-call", "scam.code-request"),
    exclude: { evidence: ["ev.sms-alert"], flags: [] },
  },
  {
    name: "ev.otp-sms shows the OTP warning option (scam.deflect)",
    add: { evidence: ["ev.otp-sms"], flags: [] },
    observe: optionsAt("dlg.scam-call", "scam.deflect"),
    exclude: { evidence: ["ev.otp-sms"], flags: [] },
  },
  {
    name: "ev.bank-app shows the app citation (scam.app-check)",
    add: { evidence: ["ev.bank-app"], flags: [] },
    observe: optionsAt("dlg.scam-call", "scam.app-check"),
    exclude: { evidence: ["ev.bank-app"], flags: [] },
  },
  {
    name: "ev.bank-card shows the number challenge (scam.knows-details)",
    add: { evidence: ["ev.bank-card"], flags: [] },
    observe: optionsAt("dlg.scam-call", "scam.knows-details"),
    exclude: { evidence: ["ev.bank-card", "ev.bank-letter"], flags: [] },
  },
  {
    name: "ev.bank-letter shows the number challenge (scam.identity)",
    add: { evidence: ["ev.bank-letter"], flags: [] },
    observe: optionsAt("dlg.scam-call", "scam.identity"),
    exclude: { evidence: ["ev.bank-card", "ev.bank-letter"], flags: [] },
  },
  {
    name: "asked_time changes the callback start node",
    add: { evidence: [], flags: ["asked_time"] },
    observe: startNodeOf("dlg.callback"),
    exclude: { evidence: [], flags: ["asked_time"] },
  },
  {
    name: "heard_deadline shows story-changed in the callback",
    add: { evidence: [], flags: ["heard_deadline"] },
    observe: optionsAt("dlg.callback", "callback.open"),
    exclude: { evidence: [], flags: ["heard_deadline"] },
  },
  {
    name: "ev.official-confirmation shows i-called-bank in the callback",
    add: { evidence: ["ev.official-confirmation"], flags: [] },
    observe: optionsAt("dlg.callback", "callback.open"),
    exclude: { evidence: ["ev.official-confirmation"], flags: [] },
  },
  {
    name: "ev.official-confirmation shows bank-said-no in the follow-up",
    add: { evidence: ["ev.official-confirmation"], flags: [] },
    observe: optionsAt("dlg.followup", "followup.open"),
    exclude: { evidence: ["ev.official-confirmation"], flags: [] },
  },
  {
    name: "code_shared changes the follow-up start node",
    add: { evidence: [], flags: ["code_shared"] },
    observe: startNodeOf("dlg.followup"),
    exclude: { evidence: [], flags: ["code_shared"] },
  },
  {
    name: "code_shared changes the callback options",
    add: { evidence: [], flags: ["code_shared"] },
    observe: optionsAt("dlg.callback", "callback.open"),
    exclude: { evidence: [], flags: ["code_shared"] },
  },
  {
    name: "ev.caller-number shows read-number on the official line",
    add: { evidence: ["ev.caller-number"], flags: [] },
    observe: optionsAt("dlg.official-line", "official.numbers"),
    exclude: { evidence: ["ev.caller-number"], flags: [] },
  },
  {
    name: "ev.caller-number shows the first report option",
    add: { evidence: ["ev.caller-number"], flags: [] },
    observe: optionsAt("dlg.official-line", "official.report-intro"),
    exclude: { evidence: ["ev.caller-number"], flags: [] },
  },
  {
    name: "otp_sent shows the second report option",
    add: { evidence: [], flags: ["otp_sent"] },
    observe: optionsAt("dlg.official-line", "official.report-intro"),
    exclude: { evidence: [], flags: ["otp_sent"] },
  },
  {
    name: "followup_rang unlocks ev.second-number",
    add: { evidence: [], flags: ["followup_rang"] },
    observe: inspectable("ev.second-number"),
    exclude: { evidence: ["ev.second-number"], flags: ["followup_rang"] },
  },
  {
    name: "case_sms_sent unlocks ev.case-sms",
    add: { evidence: [], flags: ["case_sms_sent"] },
    observe: inspectable("ev.case-sms"),
    exclude: { evidence: ["ev.case-sms"], flags: ["case_sms_sent"] },
  },
];

describe("Property 5: links in 'Where earlier choices change later dialogue'", () => {
  it("lists at least eleven distinct links", () => {
    expect(LINKS.length).toBeGreaterThanOrEqual(11);
  });

  it("adding the named evidence or flag changes the options, start node or unlock, in any context", () => {
    // Feature: chapter-01-voice-narrative, Property 5: Evidence-conditioned options are deterministic and local
    for (const [linkIndex, link] of LINKS.entries()) {
      const contextEvidence = EVIDENCE_IDS.filter((id) => !link.exclude.evidence.includes(id));
      const contextFlags = FLAG_IDS.filter((id) => !link.exclude.flags.includes(id));
      for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
        const seed = caseSeed((SEED ^ Math.imul(linkIndex + 1, 0x1f1f)) >>> 0, index);
        const next = createLcg(seed);
        const evidence = subset(next, contextEvidence);
        const flags = subset(next, contextFlags);
        const before = link.observe(evidence, flags);
        const after = link.observe([...evidence, ...link.add.evidence], [...flags, ...link.add.flags]);
        if (before === after) {
          fail(
            "Property 5",
            seed,
            index,
            `link "${link.name}" changed nothing (${before}); context evidence=${JSON.stringify(evidence)} flags=${JSON.stringify(flags)}`,
          );
        }
        // Determinism: the same inputs give the same observation.
        if (link.observe(evidence, flags) !== before) {
          fail("Property 5", seed, index, `link "${link.name}" is not deterministic`);
        }
      }
    }
  }, PROPERTY_TIMEOUT_MS);
});
