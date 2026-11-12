// Display-only localization of the Chapter 1 scenario (game-i18n-en-vi, Requirement 9).
// Pure TypeScript: no React, Three.js, i18next, react-i18next or src/i18n/ imports.
// See .kiro/specs/game-i18n-en-vi/design.md, section 9 "Narrative overlay".
//
// One walker visits every translatable text field in a fixed order. `narrativeTextEntries`
// runs it with a collector, `localizeScenario` runs it with an overlay lookup, so the list of
// Narrative_Text_Keys and the rebuilt object can never disagree. Everything that is not a
// translatable text (IDs, numbers, domains, conditions, effects, ordering) is copied unchanged.

import type { InteractableId } from "./chapter1/ids";
import type {
  DebriefContent,
  DecisionDef,
  DialogueGraph,
  EndingDef,
  EvidenceItem,
  PhoneContent,
  ScenarioDefinition,
} from "./types";

/** Narrative_Text_Key → translated text. Missing or empty entries fall back to English. */
export type NarrativeOverlay = Readonly<Record<string, string>>;

export interface NarrativeTextEntry {
  key: string;
  text: string;
}

/** Receives a Narrative_Text_Key and its English text, returns the text to keep. */
type TextVisitor = (key: string, english: string) => string;

/** Rebuilds a record with the same keys in the same order. */
function mapRecord<K extends string, V, R>(
  record: Readonly<Record<K, V>>,
  map: (value: V, key: K) => R,
): Record<K, R> {
  const result = {} as Record<K, R>;
  for (const key of Object.keys(record) as K[]) {
    result[key] = map(record[key], key);
  }
  return result;
}

function walkEvidence(item: EvidenceItem, text: TextVisitor): EvidenceItem {
  const base = `evidence/${item.id}`;
  const seenClaims = new Set<string>();
  const title = text(`${base}/title`, item.title);
  const description = text(`${base}/description`, item.description);
  const location = text(`${base}/location`, item.location);
  const relations = item.relations.map((relation) => {
    if (seenClaims.has(relation.claimId)) {
      throw new Error(
        `Evidence "${item.id}" has two relations for claim "${relation.claimId}"; ` +
          "relation note keys would collide.",
      );
    }
    seenClaims.add(relation.claimId);
    return { ...relation, note: text(`${base}/relations/${relation.claimId}/note`, relation.note) };
  });
  const relevance = text(`${base}/relevance`, item.relevance);
  const localized: EvidenceItem = { ...item, title, description, location, relations, relevance };
  if (item.debriefHint !== undefined) {
    localized.debriefHint = text(`${base}/debriefHint`, item.debriefHint);
  }
  return localized;
}

function walkDialogue(graph: DialogueGraph, text: TextVisitor): DialogueGraph {
  const base = `dialogues/${graph.id}`;
  const persona = {
    ...graph.persona,
    name: text(`${base}/persona/name`, graph.persona.name),
    role: text(`${base}/persona/role`, graph.persona.role),
  };
  const lines = mapRecord(graph.lines, (line, lineId) => text(`${base}/lines/${lineId}`, line));
  return { ...graph, persona, lines };
}

function walkPhone(phone: PhoneContent, text: TextVisitor): PhoneContent {
  const messages = mapRecord(phone.messages, (message, messageId) => ({
    ...message,
    from: text(`phone/messages/${messageId}/from`, message.from),
    body: text(`phone/messages/${messageId}/body`, message.body),
  }));
  const seenNumbers = new Set<string>();
  const contacts = phone.contacts.map((contact) => {
    if (seenNumbers.has(contact.number)) {
      throw new Error(`Two phone contacts share the number "${contact.number}"; contact name keys would collide.`);
    }
    seenNumbers.add(contact.number);
    return { ...contact, name: text(`phone/contacts/${contact.number}/name`, contact.name) };
  });
  const bankApp = {
    ...phone.bankApp,
    title: text("phone/bankApp/title", phone.bankApp.title),
    screens: phone.bankApp.screens.map((screen) => ({
      ...screen,
      title: text(`phone/bankApp/screens/${screen.id}/title`, screen.title),
      body: text(`phone/bankApp/screens/${screen.id}/body`, screen.body),
    })),
  };
  return { ...phone, messages, contacts, bankApp };
}

function walkDecision(decision: DecisionDef, text: TextVisitor): DecisionDef {
  const base = `decisions/${decision.id}`;
  const localized: DecisionDef = {
    ...decision,
    label: text(`${base}/label`, decision.label),
    unavailableHint: text(`${base}/unavailableHint`, decision.unavailableHint),
  };
  if (decision.preStep !== undefined) {
    localized.preStep = {
      ...decision.preStep,
      label: text(`${base}/preStep/label`, decision.preStep.label),
      unavailableHint: text(`${base}/preStep/unavailableHint`, decision.preStep.unavailableHint),
    };
  }
  return localized;
}

function walkEnding(ending: EndingDef, text: TextVisitor): EndingDef {
  const base = `endings/${ending.id}`;
  const title = text(`${base}/title`, ending.title);
  const simulationLabel = text(`${base}/simulationLabel`, ending.simulationLabel);
  const variants = ending.variants.map((variant) => ({
    ...variant,
    text: text(`${base}/variants/${variant.id}/text`, variant.text),
  }));
  return { ...ending, title, simulationLabel, variants };
}

function walkDebrief(debrief: DebriefContent, text: TextVisitor): DebriefContent {
  return {
    ...debrief,
    mechanism: text("debrief/mechanism", debrief.mechanism),
    saferAlternatives: debrief.saferAlternatives.map((alternative, index) =>
      text(`debrief/saferAlternatives/${index}`, alternative),
    ),
    outcomeSummaries: mapRecord(debrief.outcomeSummaries, (summary, outcomeId) =>
      text(`debrief/outcomeSummaries/${outcomeId}`, summary),
    ),
    decisionNotes: mapRecord(debrief.decisionNotes, (note, tag) => text(`debrief/decisionNotes/${tag}`, note)),
  };
}

/** The single walker over the scenario. Returns a new object and never mutates the input. */
function walkScenario(scenario: ScenarioDefinition, text: TextVisitor): ScenarioDefinition {
  return {
    ...scenario,
    title: text("title", scenario.title),
    subtitle: text("subtitle", scenario.subtitle),
    objectives: mapRecord(scenario.objectives, (objective, id) => ({
      ...objective,
      text: text(`objectives/${id}/text`, objective.text),
    })),
    interactables: mapRecord(scenario.interactables, (interactable, id) => ({
      ...interactable,
      label: text(`interactables/${id}/label`, interactable.label),
      actionLabel: text(`interactables/${id}/actionLabel`, interactable.actionLabel),
      inspectionText: text(`interactables/${id}/inspectionText`, interactable.inspectionText),
    })),
    claims: mapRecord(scenario.claims, (claim, id) => ({ ...claim, text: text(`claims/${id}/text`, claim.text) })),
    evidence: mapRecord(scenario.evidence, (item) => walkEvidence(item, text)),
    warningSigns: mapRecord(scenario.warningSigns, (sign, id) => ({
      ...sign,
      label: text(`warningSigns/${id}/label`, sign.label),
      description: text(`warningSigns/${id}/description`, sign.description),
    })),
    journalNotes: scenario.journalNotes.map((note) => ({
      ...note,
      text: text(`journalNotes/${note.id}/text`, note.text),
    })),
    calls: mapRecord(scenario.calls, (call, id) => ({
      ...call,
      displayName: text(`calls/${id}/displayName`, call.displayName),
    })),
    npcs: mapRecord(scenario.npcs, (npc, id) => ({ ...npc, name: text(`npcs/${id}/name`, npc.name) })),
    dialogues: mapRecord(scenario.dialogues, (graph) => walkDialogue(graph, text)),
    phone: walkPhone(scenario.phone, text),
    decisions: mapRecord(scenario.decisions, (decision) => walkDecision(decision, text)),
    endings: mapRecord(scenario.endings, (ending) => walkEnding(ending, text)),
    debrief: walkDebrief(scenario.debrief, text),
  };
}

function walkPrompts(
  prompts: Readonly<Record<InteractableId, string>>,
  text: TextVisitor,
): Record<InteractableId, string> {
  return mapRecord(prompts, (prompt, id) => text(`prompts/${id}`, prompt));
}

/** Uses the overlay text only when it is a non-empty string; otherwise keeps the English text. */
function overlayVisitor(overlay: NarrativeOverlay): TextVisitor {
  return (key, english) => {
    const translated = Object.prototype.hasOwnProperty.call(overlay, key) ? overlay[key] : undefined;
    return typeof translated === "string" && translated.length > 0 ? translated : english;
  };
}

/** Every translatable text field of the scenario and the interaction prompts, in a fixed order. */
export function narrativeTextEntries(
  scenario: ScenarioDefinition,
  prompts: Readonly<Record<InteractableId, string>>,
): NarrativeTextEntry[] {
  const entries: NarrativeTextEntry[] = [];
  const collect: TextVisitor = (key, english) => {
    entries.push({ key, text: english });
    return english;
  };
  walkScenario(scenario, collect);
  walkPrompts(prompts, collect);
  return entries;
}

/** Display-only copy; IDs, structure, conditions and effects are copied unchanged. */
export function localizeScenario(scenario: ScenarioDefinition, overlay: NarrativeOverlay): ScenarioDefinition {
  return walkScenario(scenario, overlayVisitor(overlay));
}

export function localizeInteractionPrompts(
  prompts: Readonly<Record<InteractableId, string>>,
  overlay: NarrativeOverlay,
): Record<InteractableId, string> {
  return walkPrompts(prompts, overlayVisitor(overlay));
}
