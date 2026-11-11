// Evidence registry for the deterministic chapter core.
// Pure TypeScript: no React, Three.js, R3F, Drei, Rapier, Zustand or Dexie imports.
// See .kiro/specs/chapter-01-the-urgent-call/design.md, "Evidence registry".
//
// Note: this module and `conditions.ts` import each other (`evaluateConditions` here,
// `discover` there). Both sides only use hoisted function declarations at call time, so the
// cycle is safe under ES modules.

import type { ClaimId, EvidenceId, InteractableId, VerifyMethod } from "./chapter1/ids";
import { evaluateConditions } from "./conditions";
import type {
  ChapterState,
  DiscoveryVia,
  EvidenceItem,
  ScenarioDefinition,
  Stance,
} from "./types";

/**
 * The trigger currently being processed, when the caller knows it (for example the reducer while
 * it handles INTERACT_OBJECT or VERIFY_CLAIM). Passing a trigger checks that the trigger matches
 * the item's discovery condition exactly.
 */
export type DiscoveryTrigger =
  | { via: "interact"; objectId: InteractableId }
  | { via: "inspect" }
  | { via: "dialogue-node"; nodeId: string }
  | { via: "verify"; method: VerifyMethod };

/** True when the dialogue node has been entered in the current or any finished conversation. */
function hasReachedNode(state: ChapterState, nodeId: string): boolean {
  const current = state.conversation;
  if (current && (current.nodeId === nodeId || current.history.some((h) => h.nodeId === nodeId))) {
    return true;
  }
  return state.conversationHistory.some(
    (entry) => entry.endNodeId === nodeId || entry.history.some((h) => h.nodeId === nodeId),
  );
}

/** True when an accepted VERIFY_CLAIM with this method is in the Event_Log. */
function hasVerified(state: ChapterState, method: VerifyMethod): boolean {
  return state.events.some(
    (entry) => entry.action.type === "VERIFY_CLAIM" && entry.action.method === method,
  );
}

/**
 * True when the Evidence_Item exists, is not yet discovered, uses the given discovery route and
 * its discovery condition holds (Requirements 11.3, 11.4, 11.5).
 *
 * With a plain `via` string the condition is checked against the state alone, so call it after
 * the triggering action has been applied (for example after the object was added to
 * `interacted`). With a `DiscoveryTrigger` the trigger's object, node or method must match the
 * item's discovery condition.
 */
export function canDiscover(
  state: ChapterState,
  evidenceId: EvidenceId,
  via: DiscoveryVia | DiscoveryTrigger,
  scenario: ScenarioDefinition,
): boolean {
  if (!Object.hasOwn(scenario.evidence, evidenceId)) return false;
  if (state.discovered.includes(evidenceId)) return false;

  const discovery = scenario.evidence[evidenceId].discovery;
  const trigger = typeof via === "string" ? null : via;
  const route = typeof via === "string" ? via : via.via;
  if (discovery.via !== route) return false;

  switch (discovery.via) {
    case "interact":
      return trigger?.via === "interact"
        ? trigger.objectId === discovery.objectId
        : state.interacted.includes(discovery.objectId);
    case "inspect":
      return evaluateConditions(discovery.requires, state, scenario);
    case "dialogue-node":
      return trigger?.via === "dialogue-node"
        ? trigger.nodeId === discovery.nodeId
        : hasReachedNode(state, discovery.nodeId);
    case "verify":
      return trigger?.via === "verify"
        ? trigger.method === discovery.method
        : hasVerified(state, discovery.method);
  }
}

/**
 * Appends the Evidence_Item ID to `discovered`, preserving discovery order. Idempotent: returns
 * the same state object when the ID is already recorded. Never mutates `state`.
 * Availability is the caller's responsibility (`canDiscover`).
 */
export function discover(state: ChapterState, evidenceId: EvidenceId): ChapterState {
  if (state.discovered.includes(evidenceId)) return state;
  return { ...state, discovered: [...state.discovered, evidenceId] };
}

export interface ClaimEvidenceEntry {
  evidence: EvidenceItem;
  stance: Stance;
  note: string;
}

/**
 * Discovered Evidence_Items related to the Claim, in discovery order, with their Stance.
 * Undiscovered evidence is never included.
 */
export function evidenceForClaim(
  state: ChapterState,
  claimId: ClaimId,
  scenario: ScenarioDefinition,
): ClaimEvidenceEntry[] {
  const entries: ClaimEvidenceEntry[] = [];
  for (const id of state.discovered) {
    if (!Object.hasOwn(scenario.evidence, id)) continue;
    const evidence = scenario.evidence[id];
    for (const relation of evidence.relations) {
      if (relation.claimId === claimId) {
        entries.push({ evidence, stance: relation.stance, note: relation.note });
      }
    }
  }
  return entries;
}
