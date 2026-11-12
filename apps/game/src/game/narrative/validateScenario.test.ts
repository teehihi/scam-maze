// Tests for the scenario validator (Requirements 9.8, 9.9, 9.10, 12.6, 18.1).
// The real Chapter 1 scenario must pass every check. Each broken fixture is a deep clone of the
// real scenario with one targeted break, so it shows the check that catches that break.

import { describe, expect, it } from "vitest";

import { CHAPTER_1_SCENARIO } from "./chapter1/scenario";
import type { ClaimId, EvidenceId, InteractableId } from "./chapter1/ids";
import type { ScenarioDefinition } from "./types";
import { FALLBACK_OPTION_ID, validateScenario } from "./validateScenario";

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
