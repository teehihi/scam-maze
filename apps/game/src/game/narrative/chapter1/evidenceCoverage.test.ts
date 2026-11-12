// Evidence coverage for Chapter 1 (Requirements 10.2, 10.3, 14.5; design.md "Evidence" table and
// gap G14). Checks that every Evidence_Item is fully described, that its discovery maps to an
// existing interactable, device screen or dialogue node, that the six evidence types of
// requirement 10.2 are covered (or their absence is documented), and that the investigator evidence set needs
// no long scammer call. The G14 checks that need the chapter registry and the 3D layout live in
// features/chapter1/world/noNewWorldObjects.test.ts, because game/narrative must not import them.

import { describe, expect, it } from "vitest";

import type { DialogueGraph, EvidenceItem } from "../types";
import { EVIDENCE_IDS, type EvidenceId } from "./ids";
import { CHAPTER_1_SCENARIO } from "./scenario";

const evidence = Object.values(CHAPTER_1_SCENARIO.evidence) as EvidenceItem[];
const graphs = Object.values(CHAPTER_1_SCENARIO.dialogues) as DialogueGraph[];

/** Device screens that exist today (phone only; see G14). */
const DEVICE_SCREEN_LOCATIONS = ["Phone · Messages", "Phone · Calls", "Phone · Northgate Bank", "Phone · official call"];

function findNode(nodeId: string): { graph: DialogueGraph } | undefined {
  const graph = graphs.find((g) => nodeId in g.nodes);
  return graph ? { graph } : undefined;
}

/** Fewest option steps from the graph start node to `nodeId` (start variants count as steps 0). */
function stepsToNode(graph: DialogueGraph, nodeId: string): number | null {
  const starts = [graph.startNodeId, ...(graph.startNodeWhen ?? []).map((v) => v.nodeId)];
  const seen = new Map<string, number>(starts.map((s) => [s, 0]));
  const queue = [...starts];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    const depth = seen.get(id) as number;
    if (id === nodeId) return depth;
    for (const option of graph.nodes[id]?.options ?? []) {
      if (typeof option.next === "string" && !seen.has(option.next)) {
        seen.set(option.next, depth + 1);
        queue.push(option.next);
      }
    }
  }
  return null;
}

describe("Chapter 1 evidence coverage", () => {
  it("defines exactly the 15 listed evidence items", () => {
    expect(evidence).toHaveLength(15);
    expect(Object.keys(CHAPTER_1_SCENARIO.evidence).sort()).toEqual([...EVIDENCE_IDS].sort());
  });

  describe.each(evidence.map((e) => [e.id, e] as const))("%s", (_id, item) => {
    it("has a stable ID, source, discovery method, related claim, meaning and consequence", () => {
      expect(CHAPTER_1_SCENARIO.evidence[item.id]).toBe(item);
      expect(item.id).toMatch(/^ev\.[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(["physical", "device", "dialogue", "npc", "verification"]).toContain(item.source);
      expect(["interact", "inspect", "dialogue-node", "verify"]).toContain(item.discovery.via);
      expect(item.relations.length).toBeGreaterThan(0);
      for (const relation of item.relations) {
        expect(CHAPTER_1_SCENARIO.claims[relation.claimId]).toBeDefined();
        expect(relation.note.trim()).not.toBe("");
      }
      // Meaning.
      expect(item.title.trim()).not.toBe("");
      expect(item.description.trim()).not.toBe("");
      expect(item.relevance.trim()).not.toBe("");
      // Narrative consequence: what the debrief says when the clue is missed.
      expect((item.debriefHint ?? "").trim()).not.toBe("");
      for (const sign of item.warningSigns) {
        expect(CHAPTER_1_SCENARIO.warningSigns[sign]).toBeDefined();
      }
    });

    it("has a discovery that maps to an existing interactable, device screen or dialogue node", () => {
      const { discovery } = item;
      switch (discovery.via) {
        case "interact": {
          const def = CHAPTER_1_SCENARIO.interactables[discovery.objectId];
          expect(def).toBeDefined();
          expect(def.reveals).toContain(item.id);
          break;
        }
        case "dialogue-node": {
          const found = findNode(discovery.nodeId);
          expect(found, `node ${discovery.nodeId}`).toBeDefined();
          const effects = (found?.graph.nodes[discovery.nodeId].onEnter ?? []).filter(
            (e) => e.kind === "discoverEvidence" && e.evidenceId === item.id,
          );
          const viaOption = Object.values(found?.graph.nodes ?? {}).some((n) =>
            n.options.some((o) =>
              (o.effects ?? []).some((e) => e.kind === "discoverEvidence" && e.evidenceId === item.id),
            ),
          );
          // The dialogue node (or one of its options) must really discover this item.
          expect(effects.length > 0 || viaOption).toBe(true);
          break;
        }
        case "inspect":
          // A device screen: the clue appears on the phone.
          expect(item.source).toBe("device");
          expect(DEVICE_SCREEN_LOCATIONS).toContain(item.location);
          break;
        case "verify":
          expect(item.source).toBe("device");
          expect(DEVICE_SCREEN_LOCATIONS).toContain(item.location);
          break;
      }
    });
  });

  describe("evidence types of requirement 10.2", () => {
    const ids = (pred: (e: EvidenceItem) => boolean): EvidenceId[] => evidence.filter(pred).map((e) => e.id);

    it("covers suspicious caller information", () => {
      const found = ids((e) => e.warningSigns.includes("ws.unknown-number") || e.warningSigns.includes("ws.partial-details"));
      expect(found).toEqual(expect.arrayContaining(["ev.caller-number", "ev.partial-info", "ev.second-number"]));
    });

    it("covers a contradiction between account or transaction information and the caller's claim", () => {
      const found = ids(
        (e) =>
          ["ev.bank-app", "ev.transfer-check"].includes(e.id) &&
          e.relations.some((r) => r.stance === "contradicts" && r.claimId === "claim.account-suspended"),
      );
      expect(found).toEqual(["ev.bank-app", "ev.transfer-check"]);
    });

    it("covers a Verification_Channel result", () => {
      const found = ids((e) => e.source === "verification");
      expect(found).toEqual(expect.arrayContaining(["ev.official-confirmation", "ev.transfer-check"]));
      for (const id of found) {
        const discovery = CHAPTER_1_SCENARIO.evidence[id].discovery;
        expect(discovery.via).toBe("dialogue-node");
        if (discovery.via === "dialogue-node") {
          expect(findNode(discovery.nodeId)?.graph.independentChannel).toBe(true);
        }
      }
    });

    it("covers a historical account notification or document", () => {
      expect(ids((e) => e.id === "ev.bank-letter" && e.source === "physical")).toEqual(["ev.bank-letter"]);
    });

    it("covers a clue in the 3D environment", () => {
      const found = ids((e) => e.source === "physical" && e.discovery.via === "interact");
      expect(found).toEqual(
        expect.arrayContaining(["ev.bank-card", "ev.bank-letter", "ev.shop-poster", "ev.community-alert"]),
      );
    });

    it("covers a clue on a virtual device, and documents that no computer screen exists (G14)", () => {
      const onPhone = ids((e) => e.source === "device" && e.location.startsWith("Phone"));
      expect(onPhone).toEqual(
        expect.arrayContaining(["ev.sms-alert", "ev.otp-sms", "ev.caller-number", "ev.bank-app", "ev.case-sms", "ev.second-number"]),
      );
      // Requirement 10.4 only applies WHERE a computer screen is used. None is: no evidence
      // names a computer, so the "computer" half of 10.2 is absent by design (gap G14).
      const mentionsComputer = evidence.filter((e) => /computer|laptop|desktop/i.test(`${e.location} ${e.title}`));
      expect(mentionsComputer).toEqual([]);
    });
  });

  describe("investigator evidence set needs no long exchange with a scammer (Requirement 14.5)", () => {
    const unlock = CHAPTER_1_SCENARIO.endings.investigator.unlockWhen ?? [];
    const countCondition = unlock.find((c) => c.kind === "evidenceCountAtLeast");

    it("has an evidence count rule and a report requirement", () => {
      expect(countCondition).toBeDefined();
      expect(unlock).toContainEqual({ kind: "flag", flag: "report_filed" });
    });

    it("leaves out evidence from the callback story and the case text", () => {
      if (countCondition?.kind !== "evidenceCountAtLeast") throw new Error("missing count rule");
      expect(countCondition.evidenceIds).not.toContain("ev.shifting-story");
      expect(countCondition.evidenceIds).not.toContain("ev.case-sms");
    });

    it("reaches every scammer-graph evidence item within two option steps", () => {
      if (countCondition?.kind !== "evidenceCountAtLeast") throw new Error("missing count rule");
      for (const id of countCondition.evidenceIds) {
        const discovery = CHAPTER_1_SCENARIO.evidence[id].discovery;
        if (discovery.via !== "dialogue-node") continue;
        const found = findNode(discovery.nodeId);
        if (found?.graph.persona.honesty !== "scammer") continue;
        const steps = stepsToNode(found.graph, discovery.nodeId);
        expect(steps, `${id} via ${discovery.nodeId}`).not.toBeNull();
        expect(steps as number).toBeLessThanOrEqual(2);
      }
    });

    it("can be met without any evidence taken from a scammer graph", () => {
      if (countCondition?.kind !== "evidenceCountAtLeast") throw new Error("missing count rule");
      const withoutScammer = countCondition.evidenceIds.filter((id) => {
        const discovery = CHAPTER_1_SCENARIO.evidence[id].discovery;
        if (discovery.via !== "dialogue-node") return true;
        return findNode(discovery.nodeId)?.graph.persona.honesty !== "scammer";
      });
      expect(withoutScammer.length).toBeGreaterThanOrEqual(countCondition.count);
    });
  });
});
