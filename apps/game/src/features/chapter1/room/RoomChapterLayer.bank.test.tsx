// The laptop's Banking app and File Explorer with the real Mission 01 scenario: the balance and the
// ledger from the game state, the transaction details, the report to the bank in separate steps,
// blocked and completed transfers apart, evidence saved only by choice, and the amounts after Easy
// Money and the Golden Platform.
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../../../app/settingsStorage";
import type { ChapterSession } from "../../../game/chapters/chapterSession";
import { MISSION_01_CONFIG } from "../../../game/narrative/chapter1/mission01";
import { MISSION_01_OFFERS_CONFIG as OFFERS } from "../../../game/narrative/chapter1/mission01Offers";
import { LAST_SUBMISSION_SCENARIO as S } from "../../../game/narrative/chapter1/lastSubmission";
import { selectDeviceView } from "../../../game/narrative/device";
import type { ChapterStore } from "../../../game/narrative/store";
import type { CoreAction } from "../../../game/narrative/types";
import type { SaveGameSource } from "../../../game/saves/saveGame";
import { applyLocale } from "../../../i18n";
import type { RoomStoryCommands } from "../../roomv2/game/outside";
import { RoomChapterLayer } from "./RoomChapterLayer";
import { RoomStoryBridge } from "./roomStoryBridge";

vi.mock("../../../game/narrative/activeScenario", async (importOriginal) => importOriginal());
vi.mock("../../../i18n/narrative/lastSubmission.vi", async (importOriginal) => importOriginal());

const SESSION: ChapterSession = { chapterId: "chapter-1", chapterNumber: 1, sceneId: "apartment", origin: "new-game" };
const SAVE_SOURCE: SaveGameSource = { read: () => ({ status: "none" }), write: () => true, clear: () => true };
const advance = (minutes: number): CoreAction => ({ type: "ADVANCE_TIME", minutes });
const use = (itemId: string, actionId: string): CoreAction => ({ type: "USE_DEVICE_ITEM", itemId, actionId });
const open = (itemId: string): CoreAction => ({ type: "OPEN_DEVICE_ITEM", itemId });
const MINUS = "\u2212";
const [T1, T2, T3] = MISSION_01_CONFIG.unauthorizedTransfers;
const FEE = MISSION_01_CONFIG.clearanceFeeVnd;

function mountLayer() {
  const bridge = new RoomStoryBridge();
  bridge.commands = {
    setPhoneMode: vi.fn(),
    ring: vi.fn(),
    setLaptopFrame: vi.fn(),
    chime: vi.fn(),
    setMood: vi.fn(),
    closeInspect: vi.fn(),
    setCursorMode: vi.fn(),
  } satisfies RoomStoryCommands;
  let store: ChapterStore | null = null;
  render(
    <RoomChapterLayer
      session={SESSION}
      settings={DEFAULT_SETTINGS}
      bridge={bridge}
      saveSource={SAVE_SOURCE}
      ringSettleMs={0}
      clockPaused
      onStoreReady={(s) => {
        store = s;
      }}
    />,
  );
  for (let i = 0; i < 12 && screen.queryByTestId("chapter-intro"); i += 1) fireEvent.click(screen.getByTestId("chapter-intro"));
  return {
    bridge,
    store: () => {
      if (!store) throw new Error("store not ready");
      return store;
    },
  };
}

type Rig = ReturnType<typeof mountLayer>;

/** The player's earlier steps, taken through the core (the way the earlier phases' tests set the story up). */
function play(rig: Rig, actions: CoreAction[]) {
  for (const action of actions) {
    let accepted = false;
    act(() => {
      accepted = rig.store().dispatch(action).accepted;
    });
    expect(accepted, JSON.stringify(action)).toBe(true);
  }
}

const CARD_GIVEN: CoreAction[] = [advance(10), open("mail.clearance"), use("mail.clearance", "open-link"), use("page.fee", "sign-in"), use("page.fee", "pay-card")];
/** The fee is taken when the bank's code is entered, as with a real card payment. */
const TO_PAID: CoreAction[] = [...CARD_GIVEN, use("page.fee", "enter-code")];
const CODE_GIVEN: CoreAction[] = TO_PAID;

function openApp(rig: Rig, id: string) {
  act(() => rig.bridge.onProp("laptop", "inspect-ready"));
  const laptop = screen.getByRole("dialog");
  const win = within(laptop).queryByTestId("desktop-window");
  if (win === null) fireEvent.click(within(laptop).getByTestId(`desktop-icon-${id}`));
  else {
    fireEvent.click(within(laptop).getByTestId("desktop-back"));
    fireEvent.click(within(laptop).getByTestId(`desktop-icon-${id}`));
  }
  return laptop;
}

const money = (amount: number) => `${new Intl.NumberFormat("en").format(amount)} VND`;
const laptopView = (rig: Rig) => selectDeviceView(rig.store().getState(), S, "laptop");

beforeEach(() => {
  act(() => {
    applyLocale("en");
  });
});

describe("the Banking app: figures from the game", () => {
  it("shows the balance, the finance summary and the ledger exactly as the game state has them", () => {
    const rig = mountLayer();
    play(rig, TO_PAID);
    const laptop = openApp(rig, "device-bank");
    const state = rig.store().getState();
    expect(within(laptop).getByTestId("bank-balance").textContent).toBe(money(state.resources.cash));
    expect(state.resources.cash).toBe(2_500_000 - FEE);
    expect(within(laptop).getByTestId("bank-finance-financialLoss").textContent).toContain(money(FEE));
    fireEvent.click(within(laptop).getByTestId("bank-tab-transactions"));
    const rows = within(laptop).getAllByTestId(/^bank-tx-tx-/);
    expect(rows).toHaveLength(laptopView(rig).bank.ledger.length);
    expect(rows[0].textContent).toContain("Student confirmation fee");
    expect(rows[0].textContent).toContain(`${MINUS}${money(FEE)}`);
    expect(rows[0].getAttribute("data-status")).toBe("completed");
  });

  it("opens a transaction: time, amount, recipient, status and the email that asked for the fee", () => {
    const rig = mountLayer();
    play(rig, TO_PAID);
    const laptop = openApp(rig, "device-bank");
    fireEvent.click(within(laptop).getByTestId("bank-tab-transactions"));
    fireEvent.click(within(laptop).getAllByTestId(/^bank-tx-tx-/)[0]);
    expect(within(laptop).getByTestId("bank-tx-amount").textContent).toBe(`${MINUS}${money(FEE)}`);
    expect(within(laptop).getByTestId("bank-tx-recipient").textContent).toBe("Payment page");
    expect(within(laptop).getByTestId("bank-tx-time").textContent).toMatch(/Tuesday/);
    expect(within(laptop).getByTestId("bank-status-completed")).toBeTruthy();
    const related = within(laptop).getByTestId("bank-related-mail.clearance");
    expect(related.textContent).toContain("Graduation Clearance");
    expect(related.textContent).toContain("international student confirmation fee");
    expect(within(laptop).getByTestId("bank-evidence-empty")).toBeTruthy();
  });

  it("does not use words that judge a transaction", () => {
    const rig = mountLayer();
    play(rig, CODE_GIVEN);
    play(rig, [advance(T1.afterMinutes + 1)]);
    const laptop = openApp(rig, "device-bank");
    fireEvent.click(within(laptop).getByTestId("bank-tab-transactions"));
    expect(laptop.textContent).not.toMatch(/scam|fraud|phish|fake|suspicious|criminal/i);
  });
});

describe("SECURITY BREACH in the Banking app", () => {
  it("shows no transfer before it happens, then the transfer that happened, with its alert to compare", () => {
    const rig = mountLayer();
    play(rig, CODE_GIVEN);
    let laptop = openApp(rig, "device-bank");
    fireEvent.click(within(laptop).getByTestId("bank-tab-transactions"));
    expect(within(laptop).getAllByTestId(/^bank-tx-tx-/)).toHaveLength(1);
    expect(within(laptop).queryByTestId("bank-filter-blocked")).not.toBeNull();
    expect(laptop.textContent).not.toContain(new Intl.NumberFormat("en").format(T1.amountVnd));

    play(rig, [advance(T1.afterMinutes + 1)]);
    laptop = openApp(rig, "device-bank");
    fireEvent.click(within(laptop).getByTestId("bank-tab-transactions"));
    const rows = within(laptop).getAllByTestId(/^bank-tx-tx-/);
    expect(rows).toHaveLength(2);
    fireEvent.click(rows[0]);
    expect(within(laptop).getByTestId("bank-tx-amount").textContent).toBe(`${MINUS}${money(T1.amountVnd)}`);
    expect(within(laptop).getByTestId("bank-tx-recipient").textContent).toBe("Unknown recipient");
    expect(within(laptop).getByTestId("bank-related-msg.bank-alert-1").textContent).toContain(money(T1.amountVnd));
    expect(within(laptop).getByTestId("bank-tx-report")).toBeTruthy();
  });

  it("reports in separate steps from the transaction, and separates what happened from what was blocked", () => {
    const rig = mountLayer();
    play(rig, [...CODE_GIVEN, advance(T1.afterMinutes + 1)]);
    const laptop = openApp(rig, "device-bank");
    fireEvent.click(within(laptop).getByTestId("bank-tab-transactions"));
    fireEvent.click(within(laptop).getAllByTestId(/^bank-tx-tx-/)[0]);
    fireEvent.click(within(laptop).getByTestId("bank-tx-report"));
    expect(within(laptop).getByTestId("bank-reporting-context").textContent).toContain(money(T1.amountVnd));

    // Step 1: the call. Nothing else is offered yet, and the report has not happened.
    const startMinutes = rig.store().getState().resources.timeMinutes;
    expect(within(laptop).getByTestId("bank-step-call").getAttribute("data-state")).toBe("open");
    expect(within(laptop).getByTestId("bank-step-report-fraud").getAttribute("data-state")).toBe("locked");
    expect(within(laptop).queryByTestId("device-action-contact.bank-report-fraud")).toBeNull();
    fireEvent.click(within(laptop).getByTestId("device-action-contact.bank-call"));
    expect(rig.store().getState().resources.timeMinutes).toBe(startMinutes - MISSION_01_CONFIG.minutes.bankCall);
    expect(rig.store().getState().persistent.bankReported).toBeFalsy();
    expect(within(laptop).getByTestId("bank-conversation").textContent).toContain("I will never ask for your password");

    // Step 2: the report. Only now does the bank block the transfers that were still to come.
    fireEvent.click(within(laptop).getByTestId("device-action-contact.bank-report-fraud"));
    expect(rig.store().getState().persistent.bankReported).toBe(true);
    expect(within(laptop).getByTestId("bank-result").textContent).toContain("A refund is not promised");
    expect(within(laptop).getByTestId("bank-report-file")).toBeTruthy();

    // Step 3: what to do next.
    fireEvent.click(within(laptop).getByTestId("device-action-contact.bank-ask-next"));
    expect(within(laptop).getByTestId("bank-conversation").textContent).toContain("Do not call back any number from a message");

    // The transaction list: one transfer happened, two were blocked and cost nothing.
    fireEvent.click(within(laptop).getByTestId("bank-tab-transactions"));
    fireEvent.click(within(laptop).getByTestId("bank-tx-back"));
    expect(within(laptop).getAllByTestId(/^bank-tx-tx-/).filter((row) => row.getAttribute("data-status") === "completed")).toHaveLength(2);
    fireEvent.click(within(laptop).getByTestId("bank-filter-blocked"));
    const blocked = within(laptop).getAllByTestId(/^bank-tx-blocked-/);
    expect(blocked).toHaveLength(2);
    expect(blocked[0].textContent).toContain(money(T3.amountVnd));
    expect(blocked[1].textContent).toContain(money(T2.amountVnd));
    fireEvent.click(blocked[0]);
    expect(within(laptop).getByTestId("bank-tx-blocked-note").textContent).toContain("No money left your account");
    // The balance only lost the fee and the transfer that happened.
    const cash = rig.store().getState().resources.cash;
    expect(cash).toBe(2_500_000 - FEE - T1.amountVnd);
    fireEvent.click(within(laptop).getByTestId("bank-tab-overview"));
    expect(within(laptop).getByTestId("bank-balance").textContent).toBe(money(cash));
    expect(within(laptop).getByTestId("bank-account-state").textContent).toBe("Outgoing transfers are blocked");
  });

  it("changing passwords from the Security tab does not return money or stop a planned transfer", () => {
    const rig = mountLayer();
    play(rig, CODE_GIVEN);
    const laptop = openApp(rig, "device-bank");
    fireEvent.click(within(laptop).getByTestId("bank-tab-security"));
    expect(within(laptop).getByTestId("bank-security-level")).toBeTruthy();
    const cash = rig.store().getState().resources.cash;
    // The change takes long enough for the first planned transfer to happen: changing passwords did not stop it.
    fireEvent.click(within(laptop).getByTestId("device-action-settings.security-change-passwords"));
    expect(rig.store().getState().resources.cash).toBe(cash - T1.amountVnd);
    expect(rig.store().getState().persistent.bankReported).toBeFalsy();
  });
});

describe("evidence", () => {
  it("is never created by opening or reading: only by a chosen save", () => {
    const rig = mountLayer();
    play(rig, TO_PAID);
    const before = rig.store().getState().resources.evidence;
    let laptop = openApp(rig, "device-bank");
    fireEvent.click(within(laptop).getByTestId("bank-tab-transactions"));
    fireEvent.click(within(laptop).getAllByTestId(/^bank-tx-tx-/)[0]);
    laptop = openApp(rig, "device-files");
    fireEvent.click(within(laptop).getByTestId("files-folder-evidence"));
    expect(within(laptop).getByTestId("files-evidence-note")).toBeTruthy();
    expect(within(laptop).getByTestId("files-empty")).toBeTruthy();
    expect(rig.store().getState().resources.evidence).toBe(before);
  });

  it("saves the bank record of the fee on purpose, once, and shows it in the Evidence folder and on the transaction", () => {
    const rig = mountLayer();
    play(rig, TO_PAID);
    const before = rig.store().getState();
    let laptop = openApp(rig, "device-bank");
    fireEvent.click(within(laptop).getByTestId("bank-tab-transactions"));
    fireEvent.click(within(laptop).getAllByTestId(/^bank-tx-tx-/)[0]);
    fireEvent.click(within(laptop).getByTestId("bank-save-record"));
    const after = rig.store().getState();
    expect(after.resources.evidence).toBe(before.resources.evidence + 1);
    expect(after.device.items["file.fee-record"]).toBeDefined();
    expect(after.resources.cash).toBe(before.resources.cash);
    expect(within(laptop).getByTestId("bank-evidence-file.fee-record")).toBeTruthy();
    expect(within(laptop).queryByTestId("bank-save-record")).toBeNull();
    laptop = openApp(rig, "device-files");
    fireEvent.click(within(laptop).getByTestId("files-folder-evidence"));
    expect(within(laptop).getByTestId("device-row-file.fee-record").textContent).toContain("Receipt: confirmation fee payment");
    expect(within(laptop).getByTestId("files-evidence-count").textContent).toContain(String(after.resources.evidence));
  });

  it("saves the email on purpose from Mail, and the page address from the Browser", () => {
    const rig = mountLayer();
    play(rig, [advance(10), open("mail.clearance"), use("mail.clearance", "open-link")]);
    const laptop = openApp(rig, "device-mail");
    fireEvent.click(within(laptop).getByTestId("mail-row-mail.clearance"));
    expect(rig.store().getState().device.items["file.email-record"]).toBeUndefined();
    fireEvent.click(within(laptop).getByTestId("device-action-mail.clearance-save-record"));
    expect(rig.store().getState().device.items["file.email-record"]).toBeDefined();
    expect(rig.store().getState().resources.evidence).toBe(1);
  });

  it("keeps the saved evidence in a save: replaying the saved actions gives the same state", async () => {
    const rig = mountLayer();
    play(rig, [...TO_PAID, use("bank.statement", "save-fee-record"), use("mail.clearance", "save-record"), use("page.fee", "save-address")]);
    const { encodeProgress, restoreProgress } = await import("../../../game/saves/chapterProgress");
    const state = rig.store().getState();
    const progress = encodeProgress(state, null, "checkpoint");
    expect(progress).not.toBeNull();
    const restored = restoreProgress(JSON.parse(JSON.stringify(progress)), S);
    expect(restored.ok).toBe(true);
    if (restored.ok) {
      expect(restored.state.resources.evidence).toBe(3);
      expect(Object.keys(restored.state.device.items).sort()).toEqual(Object.keys(state.device.items).sort());
      expect(restored.state.device.ledger).toEqual(state.device.ledger);
    }
  });
});

describe("the balance after Easy Money and the Golden Platform", () => {
  it("shows the same figures as the finance model, with no amount counted twice", () => {
    const rig = mountLayer();
    play(rig, [
      advance(OFFERS.easyMoneyAtMinute),
      use("msg.easy-money", "open-link"),
      use("job.platform", "do-task-1"),
      use("job.platform", "try-withdraw-1"),
      use("job.platform", "deposit-1"),
    ]);
    const laptop = openApp(rig, "device-bank");
    let finance = laptopView(rig).bank.finance;
    const state = rig.store().getState();
    expect(within(laptop).getByTestId("bank-balance").textContent).toBe(money(state.resources.cash));
    expect(finance.lockedFunds).toBe(OFFERS.easyMoney.depositsVnd[0]);
    expect(within(laptop).getByTestId("bank-finance-lockedFunds").textContent).toContain(money(finance.lockedFunds));
    expect(state.resources.cash).toBe(2_500_000 - OFFERS.easyMoney.depositsVnd[0]);

    fireEvent.click(within(laptop).getByTestId("bank-tab-transactions"));
    const rows = within(laptop).getAllByTestId(/^bank-tx-tx-/);
    expect(rows).toHaveLength(1);
    fireEvent.click(rows[0]);
    expect(within(laptop).getByTestId("bank-tx-type").textContent).toBe("Money sent to a platform");
    expect(within(laptop).getByTestId("bank-tx-amount").textContent).toBe(`${MINUS}${money(OFFERS.easyMoney.depositsVnd[0])}`);

    const remaining = state.resources.timeMinutes;
    play(rig, [advance(Math.max(1, OFFERS.goldenPlatformAtMinute - (S.initial!.resources.timeMinutes - remaining))), use("msg.golden-friend", "open-link"), use("page.golden", "invest")]);
    finance = laptopView(rig).bank.finance;
    fireEvent.click(within(laptop).getByTestId("bank-tab-overview"));
    expect(within(laptop).getByTestId("bank-balance").textContent).toBe(money(rig.store().getState().resources.cash));
    expect(within(laptop).getByTestId("bank-finance-lockedFunds").textContent).toContain(money(finance.lockedFunds));
    expect(finance.lockedFunds).toBeGreaterThan(OFFERS.easyMoney.depositsVnd[0]);
    // Cash plus locked plus lost never exceeds what Alex started with.
    expect(rig.store().getState().resources.cash + finance.lockedFunds + (finance.financialLoss - finance.lockedFunds)).toBeLessThanOrEqual(2_500_000);
    if (finance.displayedProfit > 0) expect(within(laptop).getByTestId("bank-finance-displayedProfit").textContent).toContain("not money in your account");
  });
});

describe("the File Explorer", () => {
  it("lists the files in folders with thumbnails, and previews a file with its own actions", () => {
    const rig = mountLayer();
    const laptop = openApp(rig, "device-files");
    expect(within(laptop).getByTestId("files-backup").textContent).toContain("No backup");
    expect(within(laptop).getByTestId("files-folder-thesis")).toBeTruthy();
    fireEvent.click(within(laptop).getByTestId("files-folder-bookmarks"));
    fireEvent.click(within(laptop).getByTestId("device-row-portal.saved"));
    expect(within(laptop).getByTestId("files-preview-portal.saved").textContent).toContain("Student portal (saved)");
    expect(within(laptop).getByTestId("device-action-portal.saved-check-account")).toBeTruthy();
    expect(laptop.textContent).not.toMatch(/Northgate/i);
  });
});

describe("Banking and Files in Vietnamese", () => {
  it("shows both in Vietnamese with the Vietnamese currency spelling", () => {
    act(() => {
      applyLocale("vi");
    });
    const rig = mountLayer();
    play(rig, TO_PAID);
    const laptop = openApp(rig, "device-bank");
    expect(within(laptop).getByText("Số dư khả dụng")).toBeTruthy();
    expect(within(laptop).getByTestId("bank-balance").textContent).toMatch(/VNĐ$/);
    fireEvent.click(within(laptop).getByTestId("bank-tab-transactions"));
    expect(within(laptop).getAllByTestId("bank-status-completed")[0].textContent).toBe("Đã hoàn tất");
    const files = openApp(rig, "device-files");
    expect(within(files).getByText("Tất cả tệp")).toBeTruthy();
  });
});
