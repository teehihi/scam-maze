// Tests for the scenario validator (Requirements 9.8, 9.9, 9.10, 12.6, 18.1).
// The real Chapter 1 scenario must pass every check. Each broken fixture is a deep clone of the
// real scenario with one targeted break, so it shows the check that catches that break.

import { describe, expect, it } from "vitest";

import { CHAPTER_1_SCENARIO } from "./chapter1/scenario";
import type { ClaimId, EvidenceId, InteractableId } from "./chapter1/ids";
import type { Condition, DialogueNode, ScenarioDefinition } from "./types";
import {
  FALLBACK_OPTION_ID,
  validateScenario,
  validateScenarioIssues,
  type ScenarioIssue,
  type ValidatorCheck,
} from "./validateScenario";

/** Deep clone of the real scenario. Scenario_Data is plain JSON-compatible data. */
function cloneScenario(): ScenarioDefinition {
  return JSON.parse(JSON.stringify(CHAPTER_1_SCENARIO)) as ScenarioDefinition;
}

describe("validateScenario", () => {
  it("returns no errors for the Chapter 1 scenario", () => {
    expect(validateScenario(CHAPTER_1_SCENARIO)).toEqual([]);
  });

  it("does not modify the scenario it checks", () => {
    const before = JSON.stringify(CHAPTER_1_SCENARIO);
    validateScenario(CHAPTER_1_SCENARIO);
    expect(JSON.stringify(CHAPTER_1_SCENARIO)).toBe(before);
  });

  it("reports an option that points to a missing node", () => {
    const s = cloneScenario();
    s.dialogues["dlg.scam-call"].nodes["scam.open"].options[0].next = "scam.missing";
    expect(validateScenario(s)).toContain(
      'Dialogue graph "dlg.scam-call" option "opt.scam.open.yes-what" points to unknown node "scam.missing".',
    );
  });

  it("reports a missing start node", () => {
    const s = cloneScenario();
    s.dialogues["dlg.scam-call"].startNodeId = "scam.nowhere";
    expect(validateScenario(s)).toContain(
      'Dialogue graph "dlg.scam-call" start node "scam.nowhere" does not exist.',
    );
  });

  it("reports a missing conditional start node", () => {
    const s = cloneScenario();
    s.dialogues["dlg.scam-call"].startNodeWhen = [{ when: [], nodeId: "scam.nowhere" }];
    expect(validateScenario(s)).toContain(
      'Dialogue graph "dlg.scam-call" conditional start node "scam.nowhere" does not exist.',
    );
  });

  it("reports nodes that cannot reach an end node", () => {
    const s = cloneScenario();
    s.dialogues["dlg.scam-call"].nodes["scam.loop"] = {
      id: "scam.loop",
      speaker: "caller",
      tone: "professional",
      lineId: "line.scam.open",
      options: [{ id: "opt.scam.loop.again", lineId: "line.scam.opt.stop", next: "scam.loop" }],
    };
    expect(validateScenario(s)).toEqual([
      'Dialogue graph "dlg.scam-call" node "scam.loop" cannot reach an end node.',
    ]);
  });

  it("reports unknown line IDs on nodes and options", () => {
    const s = cloneScenario();
    const node = s.dialogues["dlg.scam-call"].nodes["scam.open"];
    node.lineId = "line.scam.unapproved";
    node.options[1].lineId = "line.scam.opt.unapproved";
    const errors = validateScenario(s);
    expect(errors).toContain(
      'Dialogue graph "dlg.scam-call" node "scam.open" uses unknown line "line.scam.unapproved".',
    );
    expect(errors).toContain(
      'Dialogue graph "dlg.scam-call" option "opt.scam.open.ask-proof" uses unknown line "line.scam.opt.unapproved".',
    );
  });

  it("reports unknown evidence, claim and object references", () => {
    const s = cloneScenario();
    s.interactables["obj.wallet"].reveals = ["ev.missing" as EvidenceId];
    s.evidence["ev.bank-card"].relations[0].claimId = "claim.missing" as ClaimId;
    s.npcs["npc.sam"].interactableId = "obj.missing" as InteractableId;
    const errors = validateScenario(s);
    expect(errors).toContain('Interactable "obj.wallet" reveals unknown evidence "ev.missing".');
    expect(errors).toContain('Evidence "ev.bank-card" relates to unknown claim "claim.missing".');
    expect(errors).toContain('NPC "npc.sam" uses unknown object "obj.missing".');
  });

  it("reports unknown evidence in a dialogue effect", () => {
    const s = cloneScenario();
    s.dialogues["dlg.scam-call"].nodes["scam.knows-details"].onEnter = [
      { kind: "discoverEvidence", evidenceId: "ev.missing" as EvidenceId },
    ];
    expect(validateScenario(s)).toContain(
      'Dialogue graph "dlg.scam-call" node "scam.knows-details" references unknown evidence "ev.missing".',
    );
  });

  it("reports setClaimStatus outside an independent-channel graph", () => {
    const s = cloneScenario();
    s.dialogues["dlg.scam-call"].nodes["scam.open"].options[0].effects = [
      { kind: "setClaimStatus", claimId: "claim.caller-identity", status: "supported" },
    ];
    expect(validateScenario(s)).toEqual([
      'Dialogue graph "dlg.scam-call" option "opt.scam.open.yes-what" sets claim "claim.caller-identity" status outside an independent-channel graph.',
    ]);
  });

  it("reports a debrief tag that has no decision note text", () => {
    const s = cloneScenario();
    s.debrief.decisionNotes["asked-for-proof"] = "   ";
    expect(validateScenario(s)).toContain(
      'Dialogue graph "dlg.scam-call" option "opt.scam.open.ask-proof" uses debrief tag "asked-for-proof" with no decision note text.',
    );
  });

  it("reports duplicate option IDs across graphs", () => {
    const s = cloneScenario();
    s.dialogues["dlg.scam-call"].nodes["scam.open"].options[1].id = "opt.scam.open.yes-what";
    expect(validateScenario(s)).toContain(
      'Duplicate option ID "opt.scam.open.yes-what" (in node "scam.open" of "dlg.scam-call" and node "scam.open" of "dlg.scam-call").',
    );
  });

  it("reports the reserved fallback option ID", () => {
    const s = cloneScenario();
    s.dialogues["dlg.scam-call"].nodes["scam.open"].options[0].id = FALLBACK_OPTION_ID;
    expect(validateScenario(s)).toContain(
      `Dialogue graph "dlg.scam-call" option "${FALLBACK_OPTION_ID}" uses the reserved fallback option ID.`,
    );
  });

  it("reports duplicate IDs in arrays and record keys that do not match the item ID", () => {
    const s = cloneScenario();
    s.phone.bankApp.screens[1].id = s.phone.bankApp.screens[0].id;
    s.evidence["ev.bank-card"].id = "ev.bank-letter";
    const errors = validateScenario(s);
    expect(errors).toContain(`Duplicate bank app screen ID "${s.phone.bankApp.screens[0].id}".`);
    expect(errors).toContain(
      'The evidence stored under key "ev.bank-card" has id "ev.bank-letter".',
    );
  });

  it("reports an end node that still has options", () => {
    const s = cloneScenario();
    s.dialogues["dlg.scam-call"].nodes["scam.end.hung-up"].options = [
      { id: "opt.scam.end.extra", lineId: "line.scam.opt.stop", next: "scam.open" },
    ];
    expect(validateScenario(s)).toContain(
      'Dialogue graph "dlg.scam-call" node "scam.end.hung-up" is an end node but has options.',
    );
  });
});

// ---------------------------------------------------------------------------
// Fault injection for the V1, V3 and V4 checks added by the voice narrative feature
// (Requirements 13.1, 17.1). Each case breaks one thing in a clone of the real scenario and
// expects an issue with the right check code that names the item.
// ---------------------------------------------------------------------------

function issuesFor(s: ScenarioDefinition, check: ValidatorCheck): ScenarioIssue[] {
  return validateScenarioIssues(s).filter((issue) => issue.check === check);
}

/** A spoken caller node that does nothing special; tests override single fields. */
function spokenNode(id: string, optionId: string, next: string): DialogueNode {
  return {
    id,
    speaker: "caller",
    speakerId: "spk.alex",
    tone: "professional",
    lineId: "line.scam.open",
    options: [{ id: optionId, lineId: "line.scam.opt.stop", next }],
  };
}

describe("validateScenarioIssues: V1 references and voice fields", () => {
  it("reports no issue for the real scenario", () => {
    expect(validateScenarioIssues(CHAPTER_1_SCENARIO)).toEqual([]);
  });

  it("reports a node ID used in two graphs", () => {
    const s = cloneScenario();
    s.dialogues["dlg.callback"].nodes["scam.open"] = JSON.parse(
      JSON.stringify(s.dialogues["dlg.scam-call"].nodes["scam.open"]),
    ) as DialogueNode;
    const issues = issuesFor(s, "V1");
    expect(issues.some((i) => i.message.includes('Duplicate dialogue node ID "scam.open"'))).toBe(true);
  });

  it("reports a Spoken_Node with no tone", () => {
    const s = cloneScenario();
    delete s.dialogues["dlg.scam-call"].nodes["scam.open"].tone;
    const issues = issuesFor(s, "V1");
    expect(issues.some((i) => i.where.includes('node "scam.open"') && i.message.includes("no tone"))).toBe(true);
  });

  it("reports a Spoken_Node with an unknown tone", () => {
    const s = cloneScenario();
    s.dialogues["dlg.scam-call"].nodes["scam.open"].tone = "sleepy" as never;
    const issues = issuesFor(s, "V1");
    expect(issues.some((i) => i.message.includes('unknown tone "sleepy"'))).toBe(true);
  });

  it("reports an unknown speaker ID on a node", () => {
    const s = cloneScenario();
    s.dialogues["dlg.scam-call"].nodes["scam.open"].speakerId = "spk.nobody" as never;
    const issues = issuesFor(s, "V1");
    expect(issues.some((i) => i.message.includes('unknown speaker "spk.nobody"'))).toBe(true);
  });

  it("reports a Spoken_Node with no speaker at all", () => {
    const s = cloneScenario();
    const graph = s.dialogues["dlg.scam-call"];
    delete graph.nodes["scam.open"].speakerId;
    delete (graph.persona as { speakerId?: string }).speakerId;
    const issues = issuesFor(s, "V1");
    expect(issues.some((i) => i.where.includes('node "scam.open"') && i.message.includes("no known speaker"))).toBe(
      true,
    );
  });

  it.each([-1, 3001, Number.NaN])("reports pauseBeforeMs %s outside 0 to 3000", (pause) => {
    const s = cloneScenario();
    s.dialogues["dlg.scam-call"].nodes["scam.open"].pauseBeforeMs = pause;
    const issues = issuesFor(s, "V1");
    expect(issues.some((i) => i.where.includes('node "scam.open"') && i.message.includes("pauseBeforeMs"))).toBe(
      true,
    );
  });

  it.each([0, 3000])("accepts pauseBeforeMs %s", (pause) => {
    const s = cloneScenario();
    s.dialogues["dlg.scam-call"].nodes["scam.open"].pauseBeforeMs = pause;
    expect(validateScenarioIssues(s)).toEqual([]);
  });

  it("reports an act that references an unknown objective", () => {
    const s = cloneScenario();
    s.acts[0].objectives = [...s.acts[0].objectives, "obj.missing" as never];
    const issues = issuesFor(s, "V1");
    expect(issues.some((i) => i.where === `Act "${s.acts[0].id}"` && i.message.includes('"obj.missing"'))).toBe(
      true,
    );
  });

  it("reports an act whose exit conditions differ from the next act's enter conditions", () => {
    const s = cloneScenario();
    s.acts[0].exitWhen = [{ kind: "flag", flag: "asked_details" }];
    const issues = issuesFor(s, "V1");
    expect(
      issues.some((i) => i.where === `Act "${s.acts[0].id}"` && i.message.includes("exit conditions differ")),
    ).toBe(true);
  });

  it("reports an objective that belongs to two acts", () => {
    const s = cloneScenario();
    const shared = s.acts[0].objectives[0];
    s.acts[1].objectives = [...s.acts[1].objectives, shared];
    const issues = issuesFor(s, "V1");
    expect(issues.some((i) => i.where === `Objective "${shared}"` && i.message.includes("2 acts"))).toBe(true);
  });

  it("reports an objective that belongs to no act", () => {
    const s = cloneScenario();
    const dropped = s.acts[0].objectives[0];
    s.acts[0].objectives = s.acts[0].objectives.filter((id) => id !== dropped);
    const issues = issuesFor(s, "V1");
    expect(issues.some((i) => i.where === `Objective "${dropped}"` && i.message.includes("0 acts"))).toBe(true);
  });
});

describe("validateScenarioIssues: V3 termination and shape", () => {
  it("reports a node with more than four unconditional options", () => {
    const s = cloneScenario();
    s.dialogues["dlg.scam-call"].nodes["scam.open"].options = [1, 2, 3, 4, 5].map((n) => ({
      id: `opt.test.many.${n}`,
      lineId: "line.scam.opt.stop",
      next: "scam.end.hung-up",
    }));
    const issues = issuesFor(s, "V3");
    expect(issues).toHaveLength(1);
    expect(issues[0].where).toContain('node "scam.open"');
    expect(issues[0].message).toContain("5 unconditional options");
  });

  it("does not count conditional options toward the limit of four", () => {
    const s = cloneScenario();
    s.dialogues["dlg.scam-call"].nodes["scam.open"].options = [1, 2, 3, 4, 5].map((n) => ({
      id: `opt.test.cond.${n}`,
      lineId: "line.scam.opt.stop",
      conditions: n > 4 ? [{ kind: "notFlag", flag: "code_shared" } as Condition] : [],
      next: "scam.end.hung-up",
    }));
    expect(issuesFor(s, "V3")).toEqual([]);
  });

  it("reports a pressure node that needs more than three option steps to reach an end", () => {
    const s = cloneScenario();
    const nodes = s.dialogues["dlg.scam-call"].nodes;
    nodes["test.p0"] = { ...spokenNode("test.p0", "opt.test.p0", "test.c1"), pressure: true };
    nodes["test.c1"] = spokenNode("test.c1", "opt.test.c1", "test.c2");
    nodes["test.c2"] = spokenNode("test.c2", "opt.test.c2", "test.c3");
    nodes["test.c3"] = spokenNode("test.c3", "opt.test.c3", "scam.end.hung-up");
    const issues = issuesFor(s, "V3");
    expect(issues).toHaveLength(1);
    expect(issues[0].where).toContain('node "test.p0"');
    expect(issues[0].message).toContain("4 option steps");
  });

  it("accepts a pressure node that reaches an end in three option steps", () => {
    const s = cloneScenario();
    const nodes = s.dialogues["dlg.scam-call"].nodes;
    nodes["test.p0"] = { ...spokenNode("test.p0", "opt.test.p0", "test.c1"), pressure: true };
    nodes["test.c1"] = spokenNode("test.c1", "opt.test.c1", "test.c2");
    nodes["test.c2"] = spokenNode("test.c2", "opt.test.c2", "scam.end.hung-up");
    expect(issuesFor(s, "V3")).toEqual([]);
  });

  it("reports every node of a cycle that has no exit", () => {
    const s = cloneScenario();
    const nodes = s.dialogues["dlg.scam-call"].nodes;
    nodes["test.a"] = spokenNode("test.a", "opt.test.a", "test.b");
    nodes["test.b"] = spokenNode("test.b", "opt.test.b", "test.a");
    const issues = issuesFor(s, "V3");
    expect(issues.map((i) => i.where).sort()).toEqual([
      'Dialogue graph "dlg.scam-call" node "test.a"',
      'Dialogue graph "dlg.scam-call" node "test.b"',
    ]);
  });
});

describe("validateScenarioIssues: V4 impossible conditions", () => {
  function conditionOnFirstOption(s: ScenarioDefinition, condition: Condition): void {
    s.dialogues["dlg.scam-call"].nodes["scam.open"].options[0].conditions = [condition];
  }

  it("reports a flag that no effect sets", () => {
    const s = cloneScenario();
    // Remove every effect that sets the flag, then require it.
    for (const graph of Object.values(s.dialogues)) {
      for (const node of Object.values(graph.nodes)) {
        const keep = (effects?: DialogueNode["onEnter"]) =>
          effects?.filter((e) => !(e.kind === "setFlag" && e.flag === "report_filed"));
        node.onEnter = keep(node.onEnter);
        for (const option of node.options) option.effects = keep(option.effects);
      }
    }
    conditionOnFirstOption(s, { kind: "flag", flag: "report_filed" });
    const issues = issuesFor(s, "V4");
    expect(issues.some((i) => i.message.includes('flag "report_filed"') && i.message.includes("never set"))).toBe(
      true,
    );
  });

  it("reports evidence that has no way to be discovered", () => {
    const s = cloneScenario();
    (s.evidence as Record<string, unknown>)["ev.orphan"] = {
      ...JSON.parse(JSON.stringify(s.evidence["ev.bank-card"])),
      id: "ev.orphan",
      discovery: { via: "interact", objectId: "obj.missing" },
    };
    conditionOnFirstOption(s, { kind: "hasEvidence", evidenceId: "ev.orphan" as never });
    const issues = issuesFor(s, "V4");
    expect(
      issues.some((i) => i.message.includes('evidence "ev.orphan"') && i.message.includes("no way to be discovered")),
    ).toBe(true);
  });

  it("reports a claim status that nothing produces", () => {
    const s = cloneScenario();
    conditionOnFirstOption(s, { kind: "claimStatus", claimId: "claim.account-suspended", status: "supported" });
    const issues = issuesFor(s, "V4");
    expect(
      issues.some((i) => i.message.includes('claim "claim.account-suspended" status "supported"')),
    ).toBe(true);
  });

  it.each(["callEnded", "callRang"] as const)("reports %s for a call without a dialogue graph", (kind) => {
    const s = cloneScenario();
    (s.calls as Record<string, unknown>)["call.nograph"] = {
      ...JSON.parse(JSON.stringify(s.calls["call.scam-1"])),
      id: "call.nograph",
      graphId: "dlg.missing",
    };
    conditionOnFirstOption(s, { kind, callId: "call.nograph" as never });
    const issues = issuesFor(s, "V4");
    expect(
      issues.some((i) => i.message.includes(`${kind} for call "call.nograph"`) && i.message.includes("no dialogue graph")),
    ).toBe(true);
  });

  it("reports evidenceCountAtLeast with a count above the listed items", () => {
    const s = cloneScenario();
    conditionOnFirstOption(s, {
      kind: "evidenceCountAtLeast",
      evidenceIds: ["ev.bank-card", "ev.sms-alert"],
      count: 3,
    });
    const issues = issuesFor(s, "V4");
    expect(issues.some((i) => i.message.includes("needs 3 evidence items but lists only 2"))).toBe(true);
  });

  it("accepts evidenceCountAtLeast at the boundary of the listed items", () => {
    const s = cloneScenario();
    conditionOnFirstOption(s, {
      kind: "evidenceCountAtLeast",
      evidenceIds: ["ev.bank-card", "ev.sms-alert"],
      count: 2,
    });
    expect(issuesFor(s, "V4")).toEqual([]);
  });
});
