// Dialogue engine for the deterministic chapter core.
// Pure TypeScript: no React, Three.js, R3F, Drei, Rapier, Zustand or Dexie imports.
// See .kiro/specs/chapter-01-the-urgent-call/design.md, "Dialogue engine", and
// Requirements 9.2-9.7, 10.3, 10.6 and 10.7.
//
// Every function here is pure and never mutates its input.
//
// Node entry (start node and every next node), in this order:
// 1. `pressure: true` adds 1 pressure, capped at MAX_PRESSURE (Requirement 10.6).
// 2. `onEnter` effects run in authored order (for example the one-time-code delivery at
//    `scam.code-request`, Requirement 10.3, and idempotent evidence discovery).
// 3. If the node is an end node, the conversation ends.
//
// Ending a conversation archives it in `conversationHistory`, clears `conversation`, and ends the
// linked Call when it is the current Call, so `callEnded` conditions see it as ended.

import type { CallId, DialogueGraphId } from "./chapter1/ids";
import { applyEffect, applyEffects, evaluateConditions } from "./conditions";
import type {
  ChapterState,
  ConversationState,
  DialogueGraph,
  DialogueNode,
  DialogueOption,
  ScenarioDefinition,
} from "./types";
import { FALLBACK_OPTION_ID } from "./validateScenario";

export { FALLBACK_OPTION_ID };

/** Line ID of the fallback option. Not part of any graph's `lines` map. */
export const FALLBACK_LINE_ID = "__fallback.end";

/** Text of the fallback option (Requirement 9.4). */
export const FALLBACK_OPTION_TEXT = "End the conversation";

/** Rejection reason for an unavailable option (Requirement 9.6). */
export const OPTION_NOT_AVAILABLE = "Option not available.";

/** An option as the UI and the reducer see it. */
export interface DialogueOptionView {
  id: string;
  lineId: string;
  text: string;
  /** True only for the engine-provided fallback option. */
  fallback: boolean;
}

export interface ConversationEnd {
  /** End node ID, or `null` when ended by the fallback option or a `{ end: "hang-up" }` option. */
  endNodeId: string | null;
  kind: "hung-up" | "completed";
}

export type SelectOptionResult =
  | {
      ok: true;
      state: ChapterState;
      /** Debrief tags from the selected option and, if reached, the end node, in that order. */
      debriefTags: string[];
      /** Set when the selection ended the conversation. */
      ended: ConversationEnd | null;
    }
  | { ok: false; reason: string };

export interface StartConversationOptions {
  /** Linked Call; `null` (default) for face-to-face conversations. */
  callId?: CallId | null;
  /** Explicit start node. Overrides `startNodeWhen` and `startNodeId`. */
  startNodeId?: string;
}

function getGraph(scenario: ScenarioDefinition, graphId: DialogueGraphId): DialogueGraph | undefined {
  return Object.hasOwn(scenario.dialogues, graphId) ? scenario.dialogues[graphId] : undefined;
}

function getNode(graph: DialogueGraph, nodeId: string): DialogueNode | undefined {
  return Object.hasOwn(graph.nodes, nodeId) ? graph.nodes[nodeId] : undefined;
}

/** The current graph and node, or `undefined` when there is no valid conversation. */
function currentNode(
  state: ChapterState,
  scenario: ScenarioDefinition,
): { graph: DialogueGraph; node: DialogueNode; conversation: ConversationState } | undefined {
  const conversation = state.conversation;
  if (!conversation) return undefined;
  const graph = getGraph(scenario, conversation.graphId);
  if (!graph) return undefined;
  const node = getNode(graph, conversation.nodeId);
  if (!node) return undefined;
  return { graph, node, conversation };
}

/**
 * The start node for a graph: the first `startNodeWhen` entry whose conditions all hold,
 * otherwise `startNodeId` (Requirements 9.2 and 10.7).
 */
export function resolveStartNode(
  state: ChapterState,
  graph: DialogueGraph,
  scenario: ScenarioDefinition,
): string {
  for (const entry of graph.startNodeWhen ?? []) {
    if (evaluateConditions(entry.when, state, scenario)) return entry.nodeId;
  }
  return graph.startNodeId;
}

function endedCallLog(state: ChapterState, callId: CallId): ChapterState["call"]["log"] {
  let index = -1;
  for (let i = state.call.log.length - 1; i >= 0; i -= 1) {
    const record = state.call.log[i];
    if (record.callId === callId && (record.status === "answered" || record.status === "ringing")) {
      index = i;
      break;
    }
  }
  if (index === -1) return state.call.log;
  return state.call.log.map((record, i) => (i === index ? { ...record, status: "ended" } : record));
}

/**
 * Ends the current conversation: archives it in `conversationHistory`, clears `conversation`,
 * and ends its Call when that Call is the current one. Returns the input when there is no
 * conversation. The reducer can reuse this for hanging up an active call.
 */
export function endConversation(state: ChapterState, endNodeId: string | null): ChapterState {
  const conversation = state.conversation;
  if (!conversation) return state;
  let next: ChapterState = {
    ...state,
    conversation: null,
    conversationHistory: [
      ...state.conversationHistory,
      { graphId: conversation.graphId, history: conversation.history, endNodeId },
    ],
  };
  const callId = conversation.callId;
  if (callId !== null && state.call.current === callId) {
    next = {
      ...next,
      call: { current: null, status: "ended", log: endedCallLog(state, callId) },
    };
  }
  return next;
}

/**
 * Makes `nodeId` the current node and runs node entry: pressure marker, `onEnter` effects, and
 * end handling. Assumes `state.conversation` belongs to the node's graph.
 */
function enterNode(
  state: ChapterState,
  node: DialogueNode,
  scenario: ScenarioDefinition,
): { state: ChapterState; ended: ConversationEnd | null; endTag?: string } {
  const conversation = state.conversation;
  let next: ChapterState = conversation
    ? { ...state, conversation: { ...conversation, nodeId: node.id } }
    : state;
  if (node.pressure === true) {
    next = applyEffect(next, { kind: "addPressure", amount: 1 }, scenario);
  }
  next = applyEffects(next, node.onEnter, scenario);
  if (node.end) {
    return {
      state: endConversation(next, node.id),
      ended: { endNodeId: node.id, kind: node.end.kind },
      endTag: node.end.debriefTag,
    };
  }
  return { state: next, ended: null };
}

/**
 * Starts a conversation in `graphId` at the start node chosen by `startNodeWhen`
 * (or `options.startNodeId`), and runs node entry for it. Returns the input unchanged when the
 * graph or the start node does not exist, or when a conversation is already running.
 */
export function startConversation(
  state: ChapterState,
  graphId: DialogueGraphId,
  scenario: ScenarioDefinition,
  options: StartConversationOptions = {},
): ChapterState {
  if (state.conversation !== null) return state;
  const graph = getGraph(scenario, graphId);
  if (!graph) return state;
  const startNodeId = options.startNodeId ?? resolveStartNode(state, graph, scenario);
  const node = getNode(graph, startNodeId);
  if (!node) return state;
  const withConversation: ChapterState = {
    ...state,
    conversation: { graphId, nodeId: node.id, callId: options.callId ?? null, history: [] },
  };
  return enterNode(withConversation, node, scenario).state;
}

function authoredAvailable(
  node: DialogueNode,
  state: ChapterState,
  scenario: ScenarioDefinition,
): DialogueOption[] {
  return node.options.filter((option) => evaluateConditions(option.conditions, state, scenario));
}

/**
 * Options available at the current node (Requirement 9.3). When the node is not an end node and
 * no authored option is available, returns only the fallback option (Requirement 9.4).
 * Returns `[]` when there is no conversation or the current node is an end node.
 */
export function availableOptions(
  state: ChapterState,
  scenario: ScenarioDefinition,
): DialogueOptionView[] {
  const current = currentNode(state, scenario);
  if (!current || current.node.end) return [];
  const { graph, node } = current;
  const options = authoredAvailable(node, state, scenario);
  if (options.length === 0) {
    return [
      { id: FALLBACK_OPTION_ID, lineId: FALLBACK_LINE_ID, text: FALLBACK_OPTION_TEXT, fallback: true },
    ];
  }
  return options.map((option) => ({
    id: option.id,
    lineId: option.lineId,
    text: Object.hasOwn(graph.lines, option.lineId) ? graph.lines[option.lineId] : "",
    fallback: false,
  }));
}

/**
 * Selects an option at the current node. On success: appends `{ nodeId, optionId }` to the
 * history (Requirement 9.7), applies the option's effects in authored order (Requirement 9.5),
 * then enters the next node or ends the conversation. Rejects with "Option not available." when
 * the option is not in `availableOptions` (Requirement 9.6).
 */
export function selectOption(
  state: ChapterState,
  optionId: string,
  scenario: ScenarioDefinition,
): SelectOptionResult {
  const current = currentNode(state, scenario);
  if (!current || current.node.end) return { ok: false, reason: OPTION_NOT_AVAILABLE };
  const { graph, node, conversation } = current;
  const options = authoredAvailable(node, state, scenario);

  const withHistory: ChapterState = {
    ...state,
    conversation: {
      ...conversation,
      history: [...conversation.history, { nodeId: node.id, optionId }],
    },
  };

  if (options.length === 0) {
    if (optionId !== FALLBACK_OPTION_ID) return { ok: false, reason: OPTION_NOT_AVAILABLE };
    return {
      ok: true,
      state: endConversation(withHistory, null),
      debriefTags: [],
      ended: { endNodeId: null, kind: "hung-up" },
    };
  }

  const option = options.find((candidate) => candidate.id === optionId);
  if (!option) return { ok: false, reason: OPTION_NOT_AVAILABLE };

  const debriefTags: string[] = option.debriefTag ? [option.debriefTag] : [];
  const afterEffects = applyEffects(withHistory, option.effects, scenario);

  if (typeof option.next !== "string") {
    return {
      ok: true,
      state: endConversation(afterEffects, null),
      debriefTags,
      ended: { endNodeId: null, kind: "hung-up" },
    };
  }

  const nextNode = getNode(graph, option.next);
  if (!nextNode) {
    // Dangling reference: the validator reports it; end the conversation rather than soft-lock.
    return {
      ok: true,
      state: endConversation(afterEffects, null),
      debriefTags,
      ended: { endNodeId: null, kind: "hung-up" },
    };
  }

  const entered = enterNode(afterEffects, nextNode, scenario);
  if (entered.endTag) debriefTags.push(entered.endTag);
  return { ok: true, state: entered.state, debriefTags, ended: entered.ended };
}
