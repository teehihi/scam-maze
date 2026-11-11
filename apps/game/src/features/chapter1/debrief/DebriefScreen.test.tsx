// Consequence-to-debrief tests (task 11.3). Requirements 13.11, 14.1, 14.3, 14.5 and 18.6.
//
// Each run dispatches real Core_Actions through a real Chapter_Store (action lists copied from
// `game/narrative/chapter1/playthroughs.test.ts`), builds the DebriefView with `buildDebrief`,
// and renders the real EndingTransition and DebriefScreen. Expected text comes from Scenario_Data.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildDebrief, type DebriefView } from "../../../game/narrative/debrief";
import { createInitialState } from "../../../game/narrative/reducer";
import { createChapterStore } from "../../../game/narrative/store";
import type { ChapterState, CoreAction } from "../../../game/narrative/types";
import type { EvidenceId } from "../../../game/narrative/chapter1/ids";
import { CHAPTER_1_ENDINGS, SIMULATION_LABEL } from "../../../game/narrative/chapter1/endings";
import { CHAPTER_1_SCENARIO } from "../../../game/narrative/chapter1/scenario";
import { applyLocale } from "../../../i18n";
import { getDisplayScenario } from "../../../i18n/narrative";
import viOutcome from "../../../i18n/locales/vi/chapter1/outcome";
import { EndingTransition, ENDING_TEXT } from "../ending/EndingTransition";
import { DebriefScreen, DEBRIEF_TEXT } from "./DebriefScreen";

// ---------------------------------------------------------------------------
// Scripted runs
// ---------------------------------------------------------------------------

const START: CoreAction = { type: "START_CHAPTER" };
const ANSWER: CoreAction = { type: "ANSWER_CALL" };
const END_CALL: CoreAction = { type: "END_CALL" };
const OPEN_PHONE: CoreAction = { type: "OPEN_PHONE" };
const CLOSE_PHONE: CoreAction = { type: "CLOSE_PHONE" };
const FINISH: CoreAction = { type: "FINISH_CHAPTER" };

function option(optionId: string): CoreAction {
  return { type: "SELECT_DIALOGUE_OPTION", optionId };
}

const VERIFIED_RUN: CoreAction[] = [
  START,
  { type: "INTERACT_OBJECT", objectId: "obj.wallet" },
  { type: "RING_CALL", callId: "call.scam-1", reason: "first-interaction" },
  ANSWER,
  option("opt.scam.open.ask-proof"),
  option("opt.scam.knows.challenge"),
  option("opt.scam.challenged.call-card"),
  OPEN_PHONE,
  { type: "INSPECT_EVIDENCE", evidenceId: "ev.caller-number" },
  { type: "VERIFY_CLAIM", claimId: "claim.account-suspended", method: "bank-app" },
  CLOSE_PHONE,
  { type: "VERIFY_CLAIM", claimId: "claim.caller-identity", method: "official-line" },
  option("opt.official.greeting.wait"),
  option("opt.official.agent.report"),
  option("opt.official.confirm.block"),
  { type: "MAKE_DECISION", decision: "verify-independently" },
  FINISH,
];

const RISKY_MONEY_MOVED_RUN: CoreAction[] = [
  START,
  { type: "RING_CALL", callId: "call.scam-1", reason: "exploration-timer" },
  ANSWER,
  option("opt.scam.open.yes-what"),
  OPEN_PHONE,
  { type: "INSPECT_EVIDENCE", evidenceId: "ev.otp-sms" },
  option("opt.scam.code.read-code"),
  option("opt.scam.move.move-money"),
  FINISH,
];

const UNCERTAIN_RUN: CoreAction[] = [
  START,
  { type: "RING_CALL", callId: "call.scam-1", reason: "exploration-timer" },
  END_CALL,
  { type: "RING_CALL", callId: "call.scam-1", reason: "re-ring" },
  ANSWER,
  END_CALL,
  OPEN_PHONE,
  { type: "INSPECT_EVIDENCE", evidenceId: "ev.caller-number" },
  CLOSE_PHONE,
  { type: "MAKE_DECISION", decision: "stop-and-wait" },
  FINISH,
];

function playthrough(actions: readonly CoreAction[]): ChapterState {
  const store = createChapterStore(createInitialState(), CHAPTER_1_SCENARIO);
  actions.forEach((action, index) => {
    const result = store.dispatch(action);
    expect(result.accepted, `action ${index} ${JSON.stringify(action)} rejected: ${result.reason ?? ""}`).toBe(
      true,
    );
  });
  return store.getState();
}

function debriefFor(actions: readonly CoreAction[]): DebriefView {
  const view = buildDebrief(playthrough(actions), CHAPTER_1_SCENARIO);
  expect(view).not.toBeNull();
  return view as DebriefView;
}

function renderDebrief(view: DebriefView) {
  const onReplay = vi.fn();
  const onReturnToMenu = vi.fn();
  render(<DebriefScreen view={view} onReplay={onReplay} onReturnToMenu={onReturnToMenu} />);
  return { screenEl: screen.getByTestId("debrief-screen"), onReplay, onReturnToMenu };
}

function sectionItems(container: HTMLElement, headingText: string): string[] {
  const heading = within(container).getByRole("heading", { name: headingText });
  const section = heading.closest("section") as HTMLElement;
  return within(section)
    .queryAllByRole("listitem")
    .map((item) => item.textContent ?? "");
}

/** Never call anything "safe" (safety.md). */
function expectNoSafeWord(element: HTMLElement): void {
  expect(element.textContent ?? "").not.toMatch(/\bsafe\b/i);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EndingTransition and DebriefScreen from scripted runs", () => {
  it("risky run: the ending shows the simulation label and the money-moved variant; Continue calls onContinue", () => {
    const view = debriefFor(RISKY_MONEY_MOVED_RUN);
    const variant = CHAPTER_1_ENDINGS.risky.variants.find((v) => v.id === "risky.money-moved");
    expect(view.outcome.consequence?.id).toBe("risky.money-moved");

    const onContinue = vi.fn();
    render(<EndingTransition outcome={view.outcome} onContinue={onContinue} />);
    const ending = screen.getByTestId("ending-transition");

    expect(ending.getAttribute("data-outcome")).toBe("risky");
    expect(within(ending).getByRole("heading", { name: CHAPTER_1_ENDINGS.risky.title })).toBeTruthy();
    expect(within(ending).getByText(SIMULATION_LABEL)).toBeTruthy();
    expect(SIMULATION_LABEL).toBe("Simulation: nothing real happened.");
    const variantEl = within(ending).getByText(variant?.text ?? "<missing variant>");
    expect(variantEl.getAttribute("data-variant")).toBe("risky.money-moved");
    expectNoSafeWord(ending);

    expect(onContinue).not.toHaveBeenCalled();
    fireEvent.click(within(ending).getByRole("button", { name: ENDING_TEXT.continue }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("risky run: the debrief shows the simulation label and the money-moved variant", () => {
    const view = debriefFor(RISKY_MONEY_MOVED_RUN);
    const { screenEl } = renderDebrief(view);

    expect(screenEl.getAttribute("data-outcome")).toBe("risky");
    expect(within(screenEl).getByText(SIMULATION_LABEL)).toBeTruthy();
    const variant = CHAPTER_1_ENDINGS.risky.variants.find((v) => v.id === "risky.money-moved");
    expect(within(screenEl).getByText(variant?.text ?? "<missing variant>")).toBeTruthy();
    expect(sectionItems(screenEl, DEBRIEF_TEXT.evidenceFound)).toEqual([
      CHAPTER_1_SCENARIO.evidence["ev.otp-sms"].title,
    ]);
    expectNoSafeWord(screenEl);
  });

  it("verified run: the debrief lists evidence found, warning signs and clues missed from Scenario_Data", () => {
    const view = debriefFor(VERIFIED_RUN);
    const { screenEl } = renderDebrief(view);

    const found: EvidenceId[] = [
      "ev.bank-card",
      "ev.partial-info",
      "ev.caller-number",
      "ev.bank-app",
      "ev.official-confirmation",
    ];
    expect(sectionItems(screenEl, DEBRIEF_TEXT.evidenceFound)).toEqual(
      found.map((id) => CHAPTER_1_SCENARIO.evidence[id].title),
    );
    expect(sectionItems(screenEl, DEBRIEF_TEXT.warningSigns)).toEqual([
      CHAPTER_1_SCENARIO.warningSigns["ws.partial-details"].label,
      CHAPTER_1_SCENARIO.warningSigns["ws.unknown-number"].label,
    ]);

    // Clues missed: every hinted Evidence_Item not discovered, in scenario order, with its hint.
    const missed = (Object.keys(CHAPTER_1_SCENARIO.evidence) as EvidenceId[]).filter(
      (id) => CHAPTER_1_SCENARIO.evidence[id].debriefHint !== undefined && !found.includes(id),
    );
    expect(missed.length).toBeGreaterThan(0);
    expect(sectionItems(screenEl, DEBRIEF_TEXT.cluesMissed)).toEqual(
      missed.map((id) => `${CHAPTER_1_SCENARIO.evidence[id].title}${CHAPTER_1_SCENARIO.evidence[id].debriefHint}`),
    );

    expect(within(screenEl).getByText(SIMULATION_LABEL)).toBeTruthy();
    expect(within(screenEl).getByText(CHAPTER_1_SCENARIO.debrief.mechanism)).toBeTruthy();
    expectNoSafeWord(screenEl);
  });

  it("uncertain run: the ending and debrief show the partial-result wording", () => {
    const view = debriefFor(UNCERTAIN_RUN);
    expect(view.outcome.id).toBe("uncertain");

    render(<EndingTransition outcome={view.outcome} onContinue={() => {}} />);
    const ending = screen.getByTestId("ending-transition");
    expect(within(ending).getByText(SIMULATION_LABEL)).toBeTruthy();
    expect(within(ending).getByText(CHAPTER_1_ENDINGS.uncertain.variants[0].text)).toBeTruthy();
    expectNoSafeWord(ending);

    const { screenEl } = renderDebrief(view);
    expect(screenEl.getAttribute("data-outcome")).toBe("uncertain");
    const summary = CHAPTER_1_SCENARIO.debrief.outcomeSummaries.uncertain;
    expect(summary).toContain("partial result, not a failure");
    expect(within(screenEl).getByText(summary)).toBeTruthy();
    expect(screenEl.textContent).toContain("partial result, not a failure");
    expectNoSafeWord(screenEl);
  });

  it("Replay and Return to menu call their callbacks", () => {
    const view = debriefFor(UNCERTAIN_RUN);
    const { screenEl, onReplay, onReturnToMenu } = renderDebrief(view);

    fireEvent.click(within(screenEl).getByRole("button", { name: DEBRIEF_TEXT.replay }));
    expect(onReplay).toHaveBeenCalledTimes(1);
    expect(onReturnToMenu).not.toHaveBeenCalled();

    fireEvent.click(within(screenEl).getByRole("button", { name: DEBRIEF_TEXT.returnToMenu }));
    expect(onReturnToMenu).toHaveBeenCalledTimes(1);
    expect(onReplay).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Vietnamese (game-i18n-en-vi task 7.7, Requirements 8.3, 8.4, 8.6)
// ---------------------------------------------------------------------------

const VI_SCENARIO = getDisplayScenario("vi");
const VI_DEBRIEF = viOutcome.debrief;
const VI_SIMULATION_LABEL = "Mô phỏng: không có điều gì thật sự xảy ra.";

function viDebriefFor(actions: readonly CoreAction[]): DebriefView {
  const view = buildDebrief(playthrough(actions), VI_SCENARIO);
  expect(view).not.toBeNull();
  return view as DebriefView;
}

/** Never call anything "safe" ("an toàn" in Vietnamese; safety.md). */
function expectNoSafeWordVi(element: HTMLElement): void {
  expect(element.textContent ?? "").not.toMatch(/(^|[^\p{L}])an toàn/iu);
}

/** Ids, tags and order only: the parts of a DebriefView that must not depend on the language. */
function structureOf(view: DebriefView) {
  return {
    outcome: view.outcome.id,
    consequence: view.outcome.consequence?.id ?? null,
    decisions: view.decisions.map((decision) => [decision.seq, decision.tag]),
    evidenceFound: view.evidenceFound.map((item) => item.id),
    warningSigns: view.warningSignsNoticed.map((sign) => sign.id),
    cluesMissed: view.cluesMissed.map((clue) => clue.id),
    saferAlternatives: view.saferAlternatives.length,
  };
}

describe("EndingTransition and DebriefScreen in Vietnamese", () => {
  it.each([
    ["verified", VERIFIED_RUN],
    ["risky", RISKY_MONEY_MOVED_RUN],
    ["uncertain", UNCERTAIN_RUN],
  ] as const)("%s run: decisions and outcome match English", (outcomeId, actions) => {
    const english = debriefFor(actions);
    const vietnamese = viDebriefFor(actions);
    expect(vietnamese.outcome.id).toBe(outcomeId);
    expect(structureOf(vietnamese)).toEqual(structureOf(english));
    expect(vietnamese.outcome.title).not.toBe(english.outcome.title);
    expect(vietnamese.outcome.simulationLabel).toBe(VI_SIMULATION_LABEL);
  });

  it("risky run: the ending shows Vietnamese text and a Vietnamese Continue button", () => {
    applyLocale("vi");
    const view = viDebriefFor(RISKY_MONEY_MOVED_RUN);
    const onContinue = vi.fn();
    render(<EndingTransition outcome={view.outcome} onContinue={onContinue} />);
    const ending = screen.getByTestId("ending-transition");

    expect(ending.getAttribute("data-outcome")).toBe("risky");
    expect(screen.getByRole("dialog", { name: VI_SCENARIO.endings.risky.title })).toBe(ending);
    expect(within(ending).getByText(viOutcome.ending.eyebrow)).toBeTruthy();
    expect(within(ending).getByText(VI_SIMULATION_LABEL)).toBeTruthy();
    expect(within(ending).queryByText(SIMULATION_LABEL)).toBeNull();
    const variant = VI_SCENARIO.endings.risky.variants.find((v) => v.id === "risky.money-moved");
    expect(within(ending).getByText(variant?.text ?? "<missing variant>").getAttribute("data-variant")).toBe(
      "risky.money-moved",
    );
    expectNoSafeWordVi(ending);

    fireEvent.click(within(ending).getByRole("button", { name: viOutcome.ending.continue }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("verified run: the debrief shows Vietnamese headings and Vietnamese Scenario_Data text", () => {
    applyLocale("vi");
    const view = viDebriefFor(VERIFIED_RUN);
    const { screenEl } = renderDebrief(view);

    expect(screen.getByRole("dialog", { name: VI_SCENARIO.endings.verified.title })).toBe(screenEl);
    expect(within(screenEl).getByText(VI_DEBRIEF.eyebrow)).toBeTruthy();
    expect(within(screenEl).getByText(VI_SIMULATION_LABEL)).toBeTruthy();
    for (const heading of [
      VI_DEBRIEF.outcome,
      VI_DEBRIEF.decisions,
      VI_DEBRIEF.evidenceFound,
      VI_DEBRIEF.warningSigns,
      VI_DEBRIEF.cluesMissed,
      VI_DEBRIEF.mechanism,
      VI_DEBRIEF.saferAlternatives,
    ]) {
      expect(within(screenEl).getByRole("heading", { name: heading })).toBeTruthy();
    }
    for (const heading of Object.values(DEBRIEF_TEXT)) {
      expect(within(screenEl).queryByRole("heading", { name: heading })).toBeNull();
    }

    expect(sectionItems(screenEl, VI_DEBRIEF.evidenceFound)).toEqual(
      view.evidenceFound.map((item) => VI_SCENARIO.evidence[item.id].title),
    );
    expect(sectionItems(screenEl, VI_DEBRIEF.warningSigns)).toEqual(
      view.warningSignsNoticed.map((sign) => VI_SCENARIO.warningSigns[sign.id].label),
    );
    expect(sectionItems(screenEl, VI_DEBRIEF.cluesMissed)).toEqual(
      view.cluesMissed.map(
        (clue) => `${VI_SCENARIO.evidence[clue.id].title}${VI_SCENARIO.evidence[clue.id].debriefHint}`,
      ),
    );
    expect(within(screenEl).getByText(VI_SCENARIO.debrief.mechanism)).toBeTruthy();
    expect(within(screenEl).queryByText(CHAPTER_1_SCENARIO.debrief.mechanism)).toBeNull();
    expect(within(screenEl).getByText(VI_SCENARIO.debrief.outcomeSummaries.verified)).toBeTruthy();
    expectNoSafeWordVi(screenEl);
  });

  it("uncertain run: the debrief shows the Vietnamese partial-result wording", () => {
    applyLocale("vi");
    const view = viDebriefFor(UNCERTAIN_RUN);
    const { screenEl } = renderDebrief(view);
    const summary = VI_SCENARIO.debrief.outcomeSummaries.uncertain;
    expect(summary).toContain("không phải thất bại");
    expect(within(screenEl).getByText(summary)).toBeTruthy();
    expect(within(screenEl).getByText(VI_SCENARIO.endings.uncertain.variants[0].text)).toBeTruthy();
    expectNoSafeWordVi(screenEl);
  });

  it("Replay and Return to menu have Vietnamese accessible names and call their callbacks", () => {
    applyLocale("vi");
    const view = viDebriefFor(UNCERTAIN_RUN);
    const { screenEl, onReplay, onReturnToMenu } = renderDebrief(view);

    expect(within(screenEl).queryByRole("button", { name: DEBRIEF_TEXT.replay })).toBeNull();
    fireEvent.click(within(screenEl).getByRole("button", { name: VI_DEBRIEF.replay }));
    expect(onReplay).toHaveBeenCalledTimes(1);
    fireEvent.click(within(screenEl).getByRole("button", { name: VI_DEBRIEF.returnToMenu }));
    expect(onReturnToMenu).toHaveBeenCalledTimes(1);
  });
});
