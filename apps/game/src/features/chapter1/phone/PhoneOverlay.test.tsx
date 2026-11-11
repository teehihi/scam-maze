// Phone and dialogue tests (task 9.4). Requirements 7.2, 7.3, 7.4, 7.6, 8.3, 9.5 and 18.6.
//
// The components are driven by a real Chapter_Store and the real selectors, so every assertion
// checks the same data path the Chapter_Page uses. The harness below mirrors the page wiring for
// the phone overlay (callbacks dispatch Core_Actions; the call slot follows `state.call`).
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import React, { useSyncExternalStore } from "react";
import { describe, expect, it, vi } from "vitest";
import { CHAPTER_1_SCENARIO } from "../../../game/narrative/chapter1/scenario";
import { createInitialState } from "../../../game/narrative/reducer";
import { selectCallLog, selectDialogueView, selectPhoneMessages } from "../../../game/narrative/selectors";
import { createChapterStore, type ChapterStore } from "../../../game/narrative/store";
import { CallScreen } from "./CallScreen";
import { IncomingCallScreen } from "./IncomingCallScreen";
import { PhoneOverlay } from "./PhoneOverlay";

function startedStore(): ChapterStore {
  const store = createChapterStore(createInitialState());
  expect(store.dispatch({ type: "START_CHAPTER" }).accepted).toBe(true);
  expect(store.dispatch({ type: "OPEN_PHONE" }).accepted).toBe(true);
  return store;
}

/** Phone overlay bound to a real store, wired like the Chapter_Page. */
const PhoneHarness: React.FC<{ store: ChapterStore; onInspect?: (id: string) => void }> = ({ store, onInspect }) => {
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const dialogue = selectDialogueView(state);
  const current = state.call.current;
  let callSlot: React.ReactNode = null;
  if (current !== null) {
    const def = CHAPTER_1_SCENARIO.calls[current];
    callSlot =
      state.call.status === "ringing" ? (
        <IncomingCallScreen
          callerName={def.displayName}
          number={def.number}
          onAccept={() => store.dispatch({ type: "ANSWER_CALL" })}
          onDecline={() => store.dispatch({ type: "END_CALL" })}
        />
      ) : (
        <CallScreen
          callerName={def.displayName}
          number={def.number}
          dialogue={dialogue !== null && dialogue.callId === current ? dialogue : null}
          onSelectOption={(optionId) => store.dispatch({ type: "SELECT_DIALOGUE_OPTION", optionId })}
          onHangUp={() => store.dispatch({ type: "END_CALL" })}
        />
      );
  }
  return (
    <PhoneOverlay
      messages={selectPhoneMessages(state)}
      callLog={selectCallLog(state)}
      bankApp={CHAPTER_1_SCENARIO.phone.bankApp}
      onInspectEvidence={(evidenceId) => {
        onInspect?.(evidenceId);
        store.dispatch({ type: "INSPECT_EVIDENCE", evidenceId });
      }}
      onVerifyBankApp={() => store.dispatch({ type: "VERIFY_CLAIM", claimId: "claim.account-suspended", method: "bank-app" })}
      onClose={() => store.dispatch({ type: "CLOSE_PHONE" })}
      callSlot={callSlot}
    />
  );
};

const phoneDialog = () => screen.getByRole("dialog", { name: "Phone" });

describe("PhoneOverlay with a real chapter store", () => {
  it("shows the urgent message as unread at the start (Requirement 7.2)", () => {
    const store = startedStore();
    expect(selectPhoneMessages(store.getState()).filter((m) => m.unread)).toHaveLength(1);
    render(<PhoneHarness store={store} />);

    const messagesButton = within(phoneDialog()).getByRole("button", { name: /Messages/ });
    expect((messagesButton).textContent).toContain("1 unread");

    fireEvent.click(messagesButton);
    expect(within(phoneDialog()).getByText("Unread")).toBeTruthy();
  });

  it("opening the message dispatches INSPECT_EVIDENCE and records the evidence (Requirements 7.3, 7.4)", () => {
    const store = startedStore();
    const onInspect = vi.fn();
    render(<PhoneHarness store={store} onInspect={onInspect} />);

    fireEvent.click(within(phoneDialog()).getByRole("button", { name: /Messages/ }));
    const [message] = selectPhoneMessages(store.getState());
    fireEvent.click(within(phoneDialog()).getByRole("button", { name: new RegExp(message.from) }));

    expect(onInspect).toHaveBeenCalledTimes(1);
    expect(onInspect).toHaveBeenCalledWith("ev.sms-alert");
    const state = store.getState();
    expect(state.discovered).toContain("ev.sms-alert");
    expect(state.phone.unread).toHaveLength(0);
    // The body, with its look-alike domain, is shown as plain text.
    expect(within(phoneDialog()).getByText(/northgate-secure-verify\.invalid/)).toBeTruthy();
    expect(within(phoneDialog()).getByText("Recorded in your journal")).toBeTruthy();

    // Reopening does not dispatch again.
    fireEvent.click(within(phoneDialog()).getByRole("button", { name: "Back to messages" }));
    fireEvent.click(within(phoneDialog()).getByRole("button", { name: new RegExp(message.from) }));
    expect(onInspect).toHaveBeenCalledTimes(1);
  });

  it("renders no anchor elements in any app (Requirement 7.6)", () => {
    const store = startedStore();
    // Put an entry in the call history too, so the Calls app has content.
    store.dispatch({ type: "RING_CALL", callId: "call.scam-1", reason: "first-interaction" });
    store.dispatch({ type: "END_CALL" });
    const { container } = render(<PhoneHarness store={store} />);
    const dialog = phoneDialog();
    const noAnchors = () => expect(container.querySelectorAll("a")).toHaveLength(0);

    noAnchors();
    for (const app of [/Messages/, /Calls/, new RegExp(CHAPTER_1_SCENARIO.phone.bankApp.title)]) {
      fireEvent.click(within(dialog).getByRole("button", { name: app }));
      noAnchors();
      for (const button of within(dialog).queryAllByRole("button")) {
        if (/Back|Close/.test(button.textContent ?? "") || button.getAttribute("aria-label") === "Close phone") continue;
        fireEvent.click(button);
        noAnchors();
      }
      // Return to the home screen (the detail view has its own back button first).
      const backToList = within(dialog).queryByRole("button", { name: "Back to messages" });
      if (backToList) fireEvent.click(backToList);
      const back = within(dialog).queryByRole("button", { name: "Back" });
      if (back) fireEvent.click(back);
    }
  });

  it("supports keyboard navigation: focus moves into the phone and apps are buttons (Requirement 18.6)", () => {
    const store = startedStore();
    render(<PhoneHarness store={store} />);
    const dialog = phoneDialog();

    // Focus is moved to the phone heading on open.
    expect(document.activeElement).toBe(within(dialog).getByRole("heading", { name: "Home", level: 2 }));

    // Every control is a native, focusable button (Enter and Space activate native buttons).
    const buttons = within(dialog).getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(4);
    for (const button of buttons) {
      expect(button.tagName).toBe("BUTTON");
      expect(button.getAttribute("type")).toBe("button");
      expect(button.tabIndex).toBe(0);
    }

    const messagesButton = within(dialog).getByRole("button", { name: /Messages/ });
    messagesButton.focus();
    expect(document.activeElement).toBe(messagesButton);
    fireEvent.keyDown(messagesButton, { key: "Enter" });
    fireEvent.click(messagesButton); // the browser's activation of a focused button
    expect(within(dialog).getByRole("heading", { name: "Messages", level: 2 })).toBeTruthy();
    expect(document.activeElement).toBe(within(dialog).getByRole("heading", { name: "Messages", level: 2 }));

    fireEvent.click(within(dialog).getByRole("button", { name: "Close phone" }));
    expect(store.getState().phone.open).toBe(false);
  });
});

describe("Phone call → dialogue with a real chapter store", () => {
  function ringingStore(): ChapterStore {
    const store = startedStore();
    expect(store.dispatch({ type: "RING_CALL", callId: "call.scam-1", reason: "first-interaction" }).accepted).toBe(true);
    return store;
  }

  it("Accept dispatches ANSWER_CALL and shows the options from selectDialogueView (Requirement 8.3)", () => {
    const store = ringingStore();
    render(<PhoneHarness store={store} />);
    const def = CHAPTER_1_SCENARIO.calls["call.scam-1"];

    expect(screen.getByText("Incoming call")).toBeTruthy();
    expect((screen.getByTestId("incoming-call-number")).textContent).toContain(def.number);
    // The phone cannot be closed while the call rings.
    expect(within(phoneDialog()).queryByRole("button", { name: "Close phone" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Accept" }));

    const state = store.getState();
    expect(state.call.status).toBe("active");
    const view = selectDialogueView(state);
    expect(view).not.toBeNull();
    expect(view?.callId).toBe("call.scam-1");
    expect(view?.options.length).toBeGreaterThan(0);

    expect(screen.getByTestId("call-screen")).toBeTruthy();
    expect((screen.getByTestId("dialogue-line")).textContent).toContain(view!.line);
    for (const option of view!.options) {
      expect((screen.getByTestId(`dialogue-option-${option.id}`)).textContent).toContain(option.text);
    }
    // The first option takes focus, so keyboard players can answer at once.
    expect(document.activeElement).toBe(screen.getByTestId(`dialogue-option-${view!.options[0].id}`));
  });

  it("selecting an option advances the node (Requirement 9.5)", () => {
    const store = ringingStore();
    render(<PhoneHarness store={store} />);
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));

    const before = selectDialogueView(store.getState())!;
    fireEvent.click(screen.getByTestId(`dialogue-option-${before.options[0].id}`));

    const after = store.getState().conversation;
    expect(after).not.toBeNull();
    expect(after?.nodeId).not.toBe(before.nodeId);
    const view = selectDialogueView(store.getState())!;
    expect((screen.getByTestId("dialogue-line")).textContent).toContain(view.line);
  });

  it("number key 1 selects the first option (Requirement 18.6)", () => {
    const store = ringingStore();
    render(<PhoneHarness store={store} />);
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));

    const before = selectDialogueView(store.getState())!;
    const dispatch = vi.spyOn(store, "dispatch");
    act(() => {
      fireEvent.keyDown(window, { key: "1" });
    });
    expect(dispatch).toHaveBeenCalledWith({ type: "SELECT_DIALOGUE_OPTION", optionId: before.options[0].id });
    expect(store.getState().conversation?.nodeId).not.toBe(before.nodeId);
  });

  it("arrow keys move focus between options", () => {
    const store = ringingStore();
    render(<PhoneHarness store={store} />);
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    const view = selectDialogueView(store.getState())!;
    if (view.options.length < 2) return;
    const first = screen.getByTestId(`dialogue-option-${view.options[0].id}`);
    const second = screen.getByTestId(`dialogue-option-${view.options[1].id}`);
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(document.activeElement).toBe(second);
    fireEvent.keyDown(second, { key: "Home" });
    expect(document.activeElement).toBe(first);
  });
});
