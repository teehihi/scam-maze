// Evidence-to-decision tests (task 10.4). Requirements 11.7, 11.9, 13.3 and 18.6.
//
// The decision panel and the evidence journal are driven by a real Chapter_Store and the real
// selectors, so every assertion checks the same data path the Chapter_Page uses. The harness
// mirrors the page wiring: the journal's Decide button opens the decision panel, step 1 dispatches
// VERIFY_CLAIM `official-line`, and a confirmed choice dispatches MAKE_DECISION.
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import React, { useState, useSyncExternalStore } from "react";
import { describe, expect, it, vi } from "vitest";
import { CHAPTER_1_SCENARIO } from "../../../game/narrative/chapter1/scenario";
import { createInitialState } from "../../../game/narrative/reducer";
import {
  STANCE_TEXT,
  selectClaimStatuses,
  selectDecisionPanel,
  selectJournalEntries,
} from "../../../game/narrative/selectors";
import { createChapterStore, type ChapterStore } from "../../../game/narrative/store";
import type { CoreAction } from "../../../game/narrative/types";
import { EVIDENCE_JOURNAL_TEXT, EvidenceJournal } from "../journal/EvidenceJournal";
import { DECISION_PANEL_TEXT, DecisionPanel } from "./DecisionPanel";

const OFFICIAL_HINT = "You need the bank's official number. Where might you find it?";
const STEP_ONE_LABEL = CHAPTER_1_SCENARIO.decisions["verify-independently"].preStep!.label;
const REPORT_LABEL = CHAPTER_1_SCENARIO.decisions["verify-independently"].label;

/** Dispatches outside React handlers, wrapped in `act` so subscribed components re-render. */
function dispatchAll(store: ChapterStore, actions: readonly CoreAction[]): void {
  for (const action of actions) {
    let result: ReturnType<ChapterStore["dispatch"]> | undefined;
    act(() => {
      result = store.dispatch(action);
    });
    expect(result?.accepted, `${JSON.stringify(action)} rejected: ${result?.reason ?? ""}`).toBe(true);
  }
}

function startedStore(): ChapterStore {
  const store = createChapterStore(createInitialState(), CHAPTER_1_SCENARIO);
  dispatchAll(store, [{ type: "START_CHAPTER" }]);
  return store;
}

/** First scam call answered and hung up, so the decision panel is offered. */
function afterFirstCall(store: ChapterStore): void {
  dispatchAll(store, [
    { type: "RING_CALL", callId: "call.scam-1", reason: "exploration-timer" },
    { type: "ANSWER_CALL" },
    { type: "SELECT_DIALOGUE_OPTION", optionId: "opt.scam.open.verify" },
  ]);
  expect(store.getState().call.current).toBeNull();
}

/** Journal and decision panel bound to a real store, wired like the Chapter_Page. */
const Harness: React.FC<{ store: ChapterStore; initial?: "journal" | "decision" }> = ({
  store,
  initial = "journal",
}) => {
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const [view, setView] = useState<"journal" | "decision" | null>(initial);
  const panel = selectDecisionPanel(state);
  if (view === "journal") {
    return (
      <EvidenceJournal
        entries={selectJournalEntries(state)}
        claims={selectClaimStatuses(state)}
        decisionOffered={panel.offered}
        onDecide={() => setView("decision")}
        onClose={() => setView(null)}
      />
    );
  }
  if (view === "decision") {
    return (
      <DecisionPanel
        panel={panel}
        onStartOfficialCall={() =>
          store.dispatch({ type: "VERIFY_CLAIM", claimId: "claim.caller-identity", method: "official-line" })
        }
        onDecide={(decision) => {
          if (store.dispatch({ type: "MAKE_DECISION", decision }).accepted) setView(null);
        }}
        onClose={() => setView(null)}
      />
    );
  }
  return null;
};

const dialog = () => screen.getByRole("dialog");
const stepOneButton = () => within(dialog()).getByRole("button", { name: STEP_ONE_LABEL });
const reportButton = () => within(dialog()).getByRole("button", { name: REPORT_LABEL });
const isDisabled = (element: HTMLElement) => (element as HTMLButtonElement).disabled;

describe("DecisionPanel with a real chapter store", () => {
  it("keeps the official option unavailable with its hint until the card or letter is found (Requirement 13.3)", () => {
    const store = startedStore();
    afterFirstCall(store);
    render(<Harness store={store} initial="decision" />);

    expect(selectDecisionPanel(store.getState()).offered).toBe(true);
    expect(isDisabled(stepOneButton())).toBe(true);
    expect(isDisabled(reportButton())).toBe(true);
    const hint = within(dialog()).getByText(OFFICIAL_HINT);
    // The hint is shown once and describes both steps.
    expect(within(dialog()).getAllByText(OFFICIAL_HINT)).toHaveLength(1);
    const hintId = hint.closest("p")!.id;
    expect(stepOneButton().getAttribute("aria-describedby")).toBe(hintId);
    expect(reportButton().getAttribute("aria-describedby")).toBe(hintId);

    // Checking the wallet reveals the bank card and enables step 1.
    dispatchAll(store, [{ type: "INTERACT_OBJECT", objectId: "obj.wallet" }]);
    expect(store.getState().discovered).toContain("ev.bank-card");
    expect(isDisabled(stepOneButton())).toBe(false);
    expect(within(dialog()).queryByText(OFFICIAL_HINT)).toBeNull();
    expect(isDisabled(reportButton())).toBe(true);
  });

  it("the bank letter also enables step 1", () => {
    const store = startedStore();
    afterFirstCall(store);
    render(<Harness store={store} initial="decision" />);
    dispatchAll(store, [{ type: "INTERACT_OBJECT", objectId: "obj.mailbox" }]);
    expect(isDisabled(stepOneButton())).toBe(false);
  });

  it("step 1 starts the official call; after confirmation the report decision is confirmed and decided (Requirements 13.3, 18.6)", () => {
    const store = startedStore();
    afterFirstCall(store);
    dispatchAll(store, [{ type: "INTERACT_OBJECT", objectId: "obj.wallet" }]);
    const dispatch = vi.spyOn(store, "dispatch");
    render(<Harness store={store} initial="decision" />);

    fireEvent.click(stepOneButton());
    expect(dispatch).toHaveBeenCalledWith({
      type: "VERIFY_CLAIM",
      claimId: "claim.caller-identity",
      method: "official-line",
    });
    let state = store.getState();
    expect(state.call.current).toBe("call.official");
    expect(state.conversation?.graphId).toBe("dlg.official-line");

    // Reach the confirmation node of the official conversation.
    dispatchAll(store, [
      { type: "SELECT_DIALOGUE_OPTION", optionId: "opt.official.greeting.wait" },
      { type: "SELECT_DIALOGUE_OPTION", optionId: "opt.official.agent.report" },
    ]);
    state = store.getState();
    expect(state.conversation?.nodeId).toBe("official.confirm");
    expect(state.discovered).toContain("ev.official-confirmation");
    // Still on the call: nothing can be decided yet.
    expect(isDisabled(reportButton())).toBe(true);

    dispatchAll(store, [{ type: "SELECT_DIALOGUE_OPTION", optionId: "opt.official.confirm.block" }]);
    expect(store.getState().call.current).toBeNull();
    expect(within(dialog()).getByText(DECISION_PANEL_TEXT.stepDone)).toBeTruthy();
    expect(within(dialog()).queryByRole("button", { name: STEP_ONE_LABEL })).toBeNull();
    expect(isDisabled(reportButton())).toBe(false);

    // Choosing asks for confirmation first; Back returns without deciding.
    fireEvent.click(reportButton());
    expect(within(dialog()).getByRole("heading", { name: DECISION_PANEL_TEXT.confirmHeading })).toBeTruthy();
    expect(document.activeElement).toBe(
      within(dialog()).getByRole("heading", { name: DECISION_PANEL_TEXT.confirmHeading }),
    );
    fireEvent.click(within(dialog()).getByRole("button", { name: DECISION_PANEL_TEXT.back }));
    expect(store.getState().decision).toBeNull();
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: "MAKE_DECISION" }));

    fireEvent.click(reportButton());
    fireEvent.click(within(dialog()).getByRole("button", { name: DECISION_PANEL_TEXT.confirm }));
    expect(dispatch).toHaveBeenLastCalledWith({ type: "MAKE_DECISION", decision: "verify-independently" });
    state = store.getState();
    expect(state.decision).toBe("verify-independently");
    expect(state.outcome).toBe("verified");
  });
});

describe("EvidenceJournal with a real chapter store", () => {
  it("shows only discovered items, in discovery order, with the contradicts text (Requirements 11.7, 11.9)", () => {
    const store = startedStore();
    render(<Harness store={store} />);
    expect(within(dialog()).getByText(EVIDENCE_JOURNAL_TEXT.emptyState)).toBeTruthy();

    dispatchAll(store, [
      { type: "INTERACT_OBJECT", objectId: "obj.shop-poster" },
      { type: "INTERACT_OBJECT", objectId: "obj.wallet" },
    ]);
    const evidence = within(dialog()).getByRole("region", { name: EVIDENCE_JOURNAL_TEXT.evidenceHeading });
    const titles = within(evidence)
      .getAllByRole("heading", { level: 4 })
      .map((heading) => heading.textContent);
    expect(titles).toEqual([
      CHAPTER_1_SCENARIO.evidence["ev.shop-poster"].title,
      CHAPTER_1_SCENARIO.evidence["ev.bank-card"].title,
    ]);
    expect(titles).toEqual(selectJournalEntries(store.getState()).map((entry) => entry.title));
    for (const id of ["ev.bank-letter", "ev.official-confirmation", "ev.community-alert"] as const) {
      expect(within(dialog()).queryByText(CHAPTER_1_SCENARIO.evidence[id].title)).toBeNull();
    }

    // The shop notice contradicts two claims; each is described as pointing against it.
    expect(STANCE_TEXT.contradicts).toBe("Points against this claim");
    const posterEntry = within(evidence).getAllByRole("listitem")[0];
    expect(within(posterEntry).getAllByText(`${STANCE_TEXT.contradicts}.`)).toHaveLength(2);
  });

  it("shows the Decide button only while the decision is offered (Requirement 13.1)", () => {
    const store = startedStore();
    render(<Harness store={store} />);
    const decide = () => within(dialog()).queryByRole("button", { name: EVIDENCE_JOURNAL_TEXT.decide });
    expect(decide()).toBeNull();

    afterFirstCall(store);
    expect(decide()).not.toBeNull();
    fireEvent.click(decide()!);
    expect(within(dialog()).getByRole("heading", { name: DECISION_PANEL_TEXT.heading })).toBeTruthy();
  });

  it("hides the Decide button once a decision is made", () => {
    const store = startedStore();
    afterFirstCall(store);
    dispatchAll(store, [{ type: "MAKE_DECISION", decision: "stop-and-wait" }]);
    render(<Harness store={store} />);
    expect(within(dialog()).queryByRole("button", { name: EVIDENCE_JOURNAL_TEXT.decide })).toBeNull();
  });
});
