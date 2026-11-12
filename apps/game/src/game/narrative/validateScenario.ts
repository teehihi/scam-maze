// Scenario validator: checks Scenario_Data for broken references and unreachable dialogue.
// Pure TypeScript: no React, Three.js, R3F, Drei, Rapier, Zustand or Dexie imports.
// See design.md, "Scenario validator", and Requirements 9.8, 9.9, 9.10, 12.6.
//
// `validateScenario` returns one error string per problem; an empty array means the data passed
// every check. It never throws on malformed references, so tests can feed broken fixtures.

import { FLAG_IDS, VERIFY_METHODS } from "./chapter1/ids";
import type {
  Condition,
  DialogueGraph,
  DiscoveryCondition,
  Effect,
  ScenarioDefinition,
} from "./types";

/** Option ID the dialogue engine adds when a node has no available option (Requirement 9.4). */
export const FALLBACK_OPTION_ID = "__fallback.end";

const KNOWN_FLAGS: ReadonlySet<string> = new Set(FLAG_IDS);
const KNOWN_VERIFY_METHODS: ReadonlySet<string> = new Set(VERIFY_METHODS);

interface RefSets {
  evidence: ReadonlySet<string>;
  claims: ReadonlySet<string>;
  objects: ReadonlySet<string>;
  calls: ReadonlySet<string>;
  messages: ReadonlySet<string>;
  decisions: ReadonlySet<string>;
  dialogues: ReadonlySet<string>;
  npcs: ReadonlySet<string>;
}

export function validateScenario(scenario: ScenarioDefinition): string[] {
  const errors: string[] = [];
  const refs: RefSets = {
    evidence: new Set(Object.keys(scenario.evidence)),
    claims: new Set(Object.keys(scenario.claims)),
    objects: new Set(Object.keys(scenario.interactables)),
    calls: new Set(Object.keys(scenario.calls)),
    messages: new Set(Object.keys(scenario.phone.messages)),
    decisions: new Set(Object.keys(scenario.decisions)),
    dialogues: new Set(Object.keys(scenario.dialogues)),
    npcs: new Set(Object.keys(scenario.npcs)),
  };
  // A tag counts as having text only when its decision note is a non-empty string.
  const debriefTags = new Set(
    Object.entries(scenario.debrief.decisionNotes)
      .filter(([, text]) => typeof text === "string" && text.trim().length > 0)
      .map(([tag]) => tag),
  );

  // Record keys must match the item `id`.
  checkRecordKeys(errors, "objective", scenario.objectives);
  checkRecordKeys(errors, "interactable", scenario.interactables);
  checkRecordKeys(errors, "claim", scenario.claims);
  checkRecordKeys(errors, "evidence", scenario.evidence);
  checkRecordKeys(errors, "warning sign", scenario.warningSigns);
  checkRecordKeys(errors, "call", scenario.calls);
  checkRecordKeys(errors, "NPC", scenario.npcs);
  checkRecordKeys(errors, "dialogue graph", scenario.dialogues);
  checkRecordKeys(errors, "message", scenario.phone.messages);
  checkRecordKeys(errors, "decision", scenario.decisions);
  checkRecordKeys(errors, "ending", scenario.endings);

  // Duplicate IDs in arrays.
  checkDuplicates(errors, "journal note", scenario.journalNotes.map((n) => n.id));
  checkDuplicates(errors, "bank app screen", scenario.phone.bankApp.screens.map((s) => s.id));
  for (const ending of Object.values(scenario.endings)) {
    checkDuplicates(errors, `ending "${ending.id}" variant`, ending.variants.map((v) => v.id));
  }

  // Interactables.
  for (const item of Object.values(scenario.interactables)) {
    const where = `Interactable "${item.id}"`;
    for (const evidenceId of item.reveals) {
      if (!refs.evidence.has(evidenceId)) {
        errors.push(`${where} reveals unknown evidence "${evidenceId}".`);
      }
    }
    if (item.produces.type === "TALK_TO_NPC" && !refs.npcs.has(item.produces.npcId)) {
      errors.push(`${where} talks to unknown NPC "${item.produces.npcId}".`);
    }
  }

  // Evidence.
  const allNodeIds = new Set<string>();
  for (const graph of Object.values(scenario.dialogues)) {
    for (const nodeId of Object.keys(graph.nodes)) allNodeIds.add(nodeId);
  }
  const warningSigns = new Set(Object.keys(scenario.warningSigns));
  for (const item of Object.values(scenario.evidence)) {
    const where = `Evidence "${item.id}"`;
    checkDiscovery(errors, where, item.discovery, refs, allNodeIds);
    for (const relation of item.relations) {
      if (!refs.claims.has(relation.claimId)) {
        errors.push(`${where} relates to unknown claim "${relation.claimId}".`);
      }
    }
    for (const sign of item.warningSigns) {
      if (!warningSigns.has(sign)) {
        errors.push(`${where} references unknown warning sign "${sign}".`);
      }
    }
  }

  // Journal notes.
  for (const note of scenario.journalNotes) {
    for (const evidenceId of note.requires) {
      if (!refs.evidence.has(evidenceId)) {
        errors.push(`Journal note "${note.id}" requires unknown evidence "${evidenceId}".`);
      }
    }
  }

  // Calls and NPCs.
  for (const call of Object.values(scenario.calls)) {
    if (!refs.dialogues.has(call.graphId)) {
      errors.push(`Call "${call.id}" uses unknown dialogue graph "${call.graphId}".`);
    }
  }
  for (const npc of Object.values(scenario.npcs)) {
    if (!refs.objects.has(npc.interactableId)) {
      errors.push(`NPC "${npc.id}" uses unknown object "${npc.interactableId}".`);
    }
    if (!refs.dialogues.has(npc.graphId)) {
      errors.push(`NPC "${npc.id}" uses unknown dialogue graph "${npc.graphId}".`);
    }
  }

  // Phone messages.
  for (const message of Object.values(scenario.phone.messages)) {
    if (!refs.evidence.has(message.evidenceId)) {
      errors.push(`Message "${message.id}" records unknown evidence "${message.evidenceId}".`);
    }
  }

  // Dialogue graphs. Option IDs must be unique across all graphs, because
  // SELECT_DIALOGUE_OPTION names an option by ID only.
  const optionOwners = new Map<string, string>();
  for (const graph of Object.values(scenario.dialogues)) {
    validateGraph(errors, graph, refs, debriefTags, optionOwners);
  }

  // Decisions.
  for (const decision of Object.values(scenario.decisions)) {
    const where = `Decision "${decision.id}"`;
    checkConditions(errors, where, decision.requires, refs);
    if (decision.preStep) {
      checkConditions(errors, `${where} pre-step`, decision.preStep.requires, refs);
      if (!refs.claims.has(decision.preStep.claimId)) {
        errors.push(`${where} pre-step references unknown claim "${decision.preStep.claimId}".`);
      }
      if (!KNOWN_VERIFY_METHODS.has(decision.preStep.method)) {
        errors.push(`${where} pre-step uses unknown verify method "${decision.preStep.method}".`);
      }
    }
    checkDebriefTag(errors, where, decision.debriefTag, debriefTags);
  }

  // Endings and debrief.
  for (const ending of Object.values(scenario.endings)) {
    for (const variant of ending.variants) {
      checkConditions(errors, `Ending "${ending.id}" variant "${variant.id}"`, variant.when, refs);
    }
  }
  const outcomeIds = new Set(Object.keys(scenario.endings));
  for (const outcomeId of Object.keys(scenario.debrief.outcomeSummaries)) {
    if (!outcomeIds.has(outcomeId)) {
      errors.push(`Debrief outcome summary "${outcomeId}" has no ending.`);
    }
  }
  for (const outcomeId of outcomeIds) {
    if (!(outcomeId in scenario.debrief.outcomeSummaries)) {
      errors.push(`Ending "${outcomeId}" has no debrief outcome summary.`);
    }
  }

  return errors;
}

function validateGraph(
  errors: string[],
  graph: DialogueGraph,
  refs: RefSets,
  debriefTags: ReadonlySet<string>,
  optionOwners: Map<string, string>,
): void {
  const g = `Dialogue graph "${graph.id}"`;
  const nodes = graph.nodes;
  const hasNode = (id: string): boolean => Object.prototype.hasOwnProperty.call(nodes, id);
  const hasLine = (id: string): boolean => Object.prototype.hasOwnProperty.call(graph.lines, id);

  checkRecordKeys(errors, `${g} node`, nodes);

  // Start references (Requirement 9.8).
  if (!hasNode(graph.startNodeId)) {
    errors.push(`${g} start node "${graph.startNodeId}" does not exist.`);
  }
  for (const entry of graph.startNodeWhen ?? []) {
    if (!hasNode(entry.nodeId)) {
      errors.push(`${g} conditional start node "${entry.nodeId}" does not exist.`);
    }
    checkConditions(errors, `${g} conditional start "${entry.nodeId}"`, entry.when, refs);
  }

  for (const [key, node] of Object.entries(nodes)) {
    const n = `${g} node "${key}"`;
    // Approved line IDs (Requirement 9.10).
    if (!hasLine(node.lineId)) errors.push(`${n} uses unknown line "${node.lineId}".`);
    checkEffects(errors, n, node.onEnter ?? [], graph, refs);
    if (node.end) {
      checkDebriefTag(errors, n, node.end.debriefTag, debriefTags);
      if (node.options.length > 0) errors.push(`${n} is an end node but has options.`);
    }

    for (const option of node.options) {
      const o = `${g} option "${option.id}"`;
      if (option.id === FALLBACK_OPTION_ID) {
        errors.push(`${o} uses the reserved fallback option ID.`);
      }
      const owner = optionOwners.get(option.id);
      if (owner !== undefined) {
        errors.push(`Duplicate option ID "${option.id}" (in ${owner} and node "${key}" of "${graph.id}").`);
      } else {
        optionOwners.set(option.id, `node "${key}" of "${graph.id}"`);
      }
      if (!hasLine(option.lineId)) errors.push(`${o} uses unknown line "${option.lineId}".`);
      if (typeof option.next === "string" && !hasNode(option.next)) {
        errors.push(`${o} points to unknown node "${option.next}".`);
      }
      checkConditions(errors, o, option.conditions ?? [], refs);
      checkEffects(errors, o, option.effects ?? [], graph, refs);
      checkDebriefTag(errors, o, option.debriefTag, debriefTags);
    }
  }

  // Nodes from which no end is reachable (Requirement 9.9). An end node, or an option that ends
  // the conversation directly, counts as an end. Conditions are ignored: this is a static check.
  const canEnd = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const [key, node] of Object.entries(nodes)) {
      if (canEnd.has(key)) continue;
      const ends =
        node.end !== undefined ||
        node.options.some((option) =>
          typeof option.next === "string" ? canEnd.has(option.next) : true,
        );
      if (ends) {
        canEnd.add(key);
        changed = true;
      }
    }
  }
  for (const key of Object.keys(nodes)) {
    if (!canEnd.has(key)) errors.push(`${g} node "${key}" cannot reach an end node.`);
  }
}

function checkConditions(
  errors: string[],
  where: string,
  conditions: Condition[],
  refs: RefSets,
): void {
  for (const cond of conditions) {
    switch (cond.kind) {
      case "hasEvidence":
        checkRef(errors, where, "evidence", cond.evidenceId, refs.evidence);
        break;
      case "hasAnyEvidence":
        for (const id of cond.evidenceIds) checkRef(errors, where, "evidence", id, refs.evidence);
        break;
      case "flag":
      case "notFlag":
        checkRef(errors, where, "flag", cond.flag, KNOWN_FLAGS);
        break;
      case "callEnded":
        checkRef(errors, where, "call", cond.callId, refs.calls);
        break;
      case "claimStatus":
        checkRef(errors, where, "claim", cond.claimId, refs.claims);
        break;
      default:
        errors.push(`${where} has unknown condition kind "${(cond as { kind: string }).kind}".`);
    }
  }
}

function checkEffects(
  errors: string[],
  where: string,
  effects: Effect[],
  graph: DialogueGraph,
  refs: RefSets,
): void {
  for (const effect of effects) {
    switch (effect.kind) {
      case "setFlag":
        checkRef(errors, where, "flag", effect.flag, KNOWN_FLAGS);
        break;
      case "discoverEvidence":
        checkRef(errors, where, "evidence", effect.evidenceId, refs.evidence);
        break;
      case "addPressure":
        break;
      case "setClaimStatus":
        // Requirement 12.6: claim statuses change only through an independent channel.
        if (!graph.independentChannel) {
          errors.push(
            `${where} sets claim "${effect.claimId}" status outside an independent-channel graph.`,
          );
        }
        checkRef(errors, where, "claim", effect.claimId, refs.claims);
        break;
      case "recordDecision":
        checkRef(errors, where, "decision", effect.decision, refs.decisions);
        break;
      case "deliverMessage":
        checkRef(errors, where, "message", effect.messageId, refs.messages);
        break;
      default:
        errors.push(`${where} has unknown effect kind "${(effect as { kind: string }).kind}".`);
    }
  }
}

function checkDiscovery(
  errors: string[],
  where: string,
  discovery: DiscoveryCondition,
  refs: RefSets,
  allNodeIds: ReadonlySet<string>,
): void {
  switch (discovery.via) {
    case "interact":
      checkRef(errors, where, "object", discovery.objectId, refs.objects);
      break;
    case "inspect":
      checkConditions(errors, where, discovery.requires, refs);
      break;
    case "dialogue-node":
      checkRef(errors, where, "dialogue node", discovery.nodeId, allNodeIds);
      break;
    case "verify":
      checkRef(errors, where, "verify method", discovery.method, KNOWN_VERIFY_METHODS);
      break;
    default:
      errors.push(`${where} has unknown discovery kind "${(discovery as { via: string }).via}".`);
  }
}

function checkRef(
  errors: string[],
  where: string,
  kind: string,
  id: string,
  known: ReadonlySet<string>,
): void {
  if (!known.has(id)) errors.push(`${where} references unknown ${kind} "${id}".`);
}

function checkDebriefTag(
  errors: string[],
  where: string,
  tag: string | undefined,
  known: ReadonlySet<string>,
): void {
  if (tag === undefined) return;
  if (!known.has(tag)) {
    errors.push(`${where} uses debrief tag "${tag}" with no decision note text.`);
  }
}

function checkRecordKeys(
  errors: string[],
  kind: string,
  record: Record<string, { id: string }>,
): void {
  for (const [key, item] of Object.entries(record)) {
    if (item.id !== key) {
      errors.push(`The ${kind} stored under key "${key}" has id "${item.id}".`);
    }
  }
}

function checkDuplicates(errors: string[], kind: string, ids: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) errors.push(`Duplicate ${kind} ID "${id}".`);
    seen.add(id);
  }
}
