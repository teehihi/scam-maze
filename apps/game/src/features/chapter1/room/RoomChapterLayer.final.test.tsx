// Mission 01 as the player lives it on the laptop, after Alex's school became UEH: the mistake path,
// the safe path and the skip path, end to end, with the real scenario. These tests do not repeat the
// unit checks of each app; they check that the apps agree with each other and with the game state.
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../../../app/settingsStorage";
import type { ChapterSession } from "../../../game/chapters/chapterSession";
import { LAST_SUBMISSION_SCENARIO as S } from "../../../game/narrative/chapter1/lastSubmission";
import { MISSION_01_CONFIG } from "../../../game/narrative/chapter1/mission01";
import type { ChapterStore } from "../../../game/narrative/store";
import type { CoreAction } from "../../../game/narrative/types";
import type { SaveGameSource } from "../../../game/saves/saveGame";
import { applyLocale } from "../../../i18n";
import type { RoomStoryCommands } from "../../roomv2/game/outside";
import { MISSION01_VOICE_CUES, passedVoiceCues, reachedVoiceCues } from "../voice/mission01Voice";
import { RoomChapterLayer } from "./RoomChapterLayer";
import { RoomStoryBridge } from "./roomStoryBridge";

vi.mock("../../../game/narrative/activeScenario", async (importOriginal) => importOriginal());
vi.mock("../../../i18n/narrative/lastSubmission.vi", async (importOriginal) => importOriginal());

const SESSION: ChapterSession = { chapterId: "chapter-1", chapterNumber: 1, sceneId: "apartment", origin: "new-game" };
const SAVE_SOURCE: SaveGameSource = { read: () => ({ status: "none" }), write: () => true, clear: () => true };
const advance = (minutes: number): CoreAction => ({ type: "ADVANCE_TIME", minutes });
const use = (itemId: string, actionId: string): CoreAction => ({ type: "USE_DEVICE_ITEM", itemId, actionId });
const PORTAL = "https://student.ueh.edu.vn/";
const FAKE = "https://payment-ueh.vn/confirm";
const START_CASH = 2_500_000;

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

function play(rig: Rig, actions: CoreAction[]) {
  for (const action of actions) {
    let accepted = false;
    act(() => {
      accepted = rig.store().dispatch(action).accepted;
    });
    expect(accepted, JSON.stringify(action)).toBe(true);
  }
}

/** Shows an app of the laptop (opening the laptop first when needed). */
function app(rig: Rig, id: string) {
  if (screen.queryByRole("dialog") === null) act(() => rig.bridge.onProp("laptop", "inspect-ready"));
  const laptop = screen.getByRole("dialog");
  if (within(laptop).queryByTestId("desktop-window") !== null) fireEvent.click(within(laptop).getByTestId("desktop-back"));
  fireEvent.click(within(laptop).getByTestId(`desktop-icon-${id}`));
  return laptop;
}

async function goToBookmark(rig: Rig, url: string) {
  const laptop = app(rig, "browser");
  fireEvent.click(within(laptop).getByTestId("browser-bookmarks"));
  fireEvent.click(within(laptop).getByTestId(`menu-bookmark-${url}`));
  await within(laptop).findByTestId("portal-site");
  return laptop;
}

/** One free work session on the Thesis desk. */
function workOnThesis(laptop: HTMLElement) {
  fireEvent.click(within(laptop).getByTestId("thesis-work"));
}

beforeEach(() => {
  act(() => {
    applyLocale("en");
  });
});

describe("the mistake path: Mail, Fake Clearance, Banking, Security Breach, Files, UEH Portal, Training Office", () => {
  it("plays through with every step taken by the player, and the apps agree", async () => {
    const rig = mountLayer();
    play(rig, [advance(10)]);

    // Mail: the email of the "Graduation Office", then the link.
    let laptop = app(rig, "device-mail");
    fireEvent.click(within(laptop).getByTestId("mail-row-mail.clearance"));
    expect(within(laptop).getByTestId("mail-sender-address").textContent).toBe("clearance@payment-ueh.vn");
    fireEvent.click(within(laptop).getByTestId("mail-link"));
    await within(laptop).findByTestId("fake-step-notice");
    // The fake site uses the UEH name and logo, on another address than the portal, with no verdict.
    expect(within(laptop).getByTestId("ueh-logo")).toBeTruthy();
    expect((within(laptop).getByTestId("browser-address") as HTMLInputElement).value).toBe(FAKE);
    expect(new URL(FAKE).host).not.toBe(new URL(PORTAL).host);
    expect(within(laptop).getByTestId("clearance-site").textContent).not.toMatch(/scam|fake|phish|fraud|warning|dangerous|suspicious/i);

    // The chain, one step per page.
    fireEvent.click(within(laptop).getByTestId("clearance-continue"));
    await within(laptop).findByTestId("fake-step-login");
    fireEvent.focus(within(laptop).getByTestId("login-id"));
    fireEvent.click(within(laptop).getByTestId("login-fill"));
    fireEvent.click(within(laptop).getByTestId("login-submit"));
    await within(laptop).findByTestId("fake-step-payment");
    fireEvent.focus(within(laptop).getByTestId("pay-number"));
    fireEvent.click(within(laptop).getByTestId("pay-fill"));
    // The saved card leaves the security code to the player, as the browser does.
    for (const key of "123") fireEvent.keyDown(within(laptop).getByTestId("pay-cvc"), { key });
    fireEvent.click(within(laptop).getByTestId("pay-submit"));
    await within(laptop).findByTestId("fake-step-verify");
    // On the laptop the code is read on the phone and typed in.
    fireEvent.change(within(laptop).getByTestId("verify-code"), { target: { value: "481206" } });
    fireEvent.click(within(laptop).getByTestId("verify-submit"));
    await within(laptop).findByTestId("fake-step-complete");
    let state = rig.store().getState();
    expect(state.persistent.loginCredentialsExposed).toBe(true);
    expect(state.persistent.verificationCodeExposed).toBe(true);
    expect(state.persistent.accountCompromised).toBe(true);
    expect(state.resources.cash).toBe(START_CASH - MISSION_01_CONFIG.clearanceFeeVnd);

    // Time passes: a transfer happens. Banking shows it, the player reports it in steps.
    play(rig, [advance(MISSION_01_CONFIG.unauthorizedTransfers[0].afterMinutes + 1)]);
    laptop = app(rig, "device-bank");
    fireEvent.click(within(laptop).getByTestId("bank-tab-transactions"));
    expect(within(laptop).getAllByTestId(/^bank-tx-tx-/)).toHaveLength(2);
    fireEvent.click(within(laptop).getByTestId("bank-tab-support"));
    fireEvent.click(within(laptop).getByTestId("device-action-contact.bank-call"));
    fireEvent.click(within(laptop).getByTestId("device-action-contact.bank-report-fraud"));
    expect(rig.store().getState().persistent.bankReported).toBe(true);

    // Files: the evidence the player gathered, nothing the player did not save.
    laptop = app(rig, "device-files");
    fireEvent.click(within(laptop).getByTestId("files-folder-evidence"));
    expect(within(laptop).getByTestId("device-row-file.bank-report")).toBeTruthy();
    expect(within(laptop).queryByTestId("device-row-file.email-record")).toBeNull();

    // UEH Portal by bookmark: it knows no such fee, and the account can be checked.
    laptop = await goToBookmark(rig, PORTAL);
    expect(within(laptop).getByTestId("ueh-mark").textContent).toContain("University of Economics Ho Chi Minh City");
    expect(within(laptop).getByTestId("portal-access-dashboard").textContent).toBe("Access locked");
    fireEvent.click(within(laptop).getByTestId("portal-nav-services"));
    expect((await within(laptop).findByTestId("portal-fees")).textContent).not.toMatch(/confirmation/i);
    fireEvent.click(within(laptop).getByTestId("portal-nav-account"));
    fireEvent.click(await within(laptop).findByTestId("portal-check-account"));
    expect(within(laptop).getByTestId("portal-check-result")).toBeTruthy();

    // Training Office on the phone, with the number that the portal lists.
    fireEvent.click(within(laptop).getByTestId("portal-nav-services"));
    expect((await within(laptop).findByTestId("portal-training-phone")).textContent).toBe("+000 100 0200");
    play(rig, [use("contact.training-office", "call"), use("contact.training-office", "confirm-fee"), use("contact.training-office", "ask-account")]);
    state = rig.store().getState();
    expect(state.persistent.schoolAccessVerified).toBe(true);

    // What stays for later: both the mistake and the verification are in the state.
    expect(state.persistent.accountEverCompromised).toBe(true);
    expect(state.persistent.bankReported).toBe(true);
    // Voice cues: each reached once, in the list order, never twice.
    const cues = reachedVoiceCues(state, S, { mailListed: true, bankViewed: true });
    expect(new Set(cues).size).toBe(cues.length);
    expect(cues).toEqual(expect.arrayContaining(["emailReceived", "emailSuspicious", "verify", "securityBreach"]));
    expect(passedVoiceCues(state, S)).toEqual(cues);
    expect(MISSION01_VOICE_CUES.filter((cue) => cues.includes(cue as never))).toEqual(cues);
  }, 30_000);
});

describe("the safe path: Mail, UEH Portal bookmark, Training Office, Evidence, Thesis", () => {
  it("verifies without losing anything, saves evidence by choice and goes back to the thesis", async () => {
    const rig = mountLayer();
    play(rig, [advance(10)]);
    let laptop = app(rig, "device-mail");
    fireEvent.click(within(laptop).getByTestId("mail-row-mail.clearance"));
    fireEvent.click(within(laptop).getByTestId("device-action-mail.clearance-save-record"));
    expect(rig.store().getState().device.items["file.email-record"]).toBeDefined();

    // The link is not followed. The saved bookmark is used instead. The published fee page gives
    // Alex a natural way to compare the payment address before checking the account.
    laptop = await goToBookmark(rig, PORTAL);
    fireEvent.click(within(laptop).getByTestId("portal-nav-services"));
    expect((await within(laptop).findByTestId("portal-payment-domain")).textContent).toBe("payment.ueh.edu.vn");
    fireEvent.click(within(laptop).getByTestId("portal-nav-account"));
    await within(laptop).findByTestId("portal-check-account");
    expect(rig.store().getState().device.items["portal.saved"].done).not.toContain("check-account");
    fireEvent.click(within(laptop).getByTestId("portal-check-account"));
    expect(rig.store().getState().device.items["file.portal-status"]).toBeDefined();
    play(rig, [use("contact.training-office", "call"), use("contact.training-office", "confirm-fee"), use("contact.training-office", "ask-account")]);

    // The evidence is in Files: the saved email, the portal result and the Training Office reply.
    laptop = app(rig, "device-files");
    fireEvent.click(within(laptop).getByTestId("files-folder-evidence"));
    expect(within(laptop).getByTestId("device-row-file.email-record")).toBeTruthy();
    expect(within(laptop).getByTestId("device-row-file.office-confirmation")).toBeTruthy();

    // Back to the thesis in the document window.
    const before = rig.store().getState().resources.thesisProgress;
    laptop = app(rig, "thesis");
    expect(within(laptop).getByTestId("thesis-window")).toBeTruthy();
    workOnThesis(laptop);
    const after = rig.store().getState();
    expect(after.resources.thesisProgress).toBeGreaterThan(before);

    // Nothing was lost.
    expect(after.resources.cash).toBe(START_CASH);
    expect(after.persistent.schoolAccessVerified).toBe(true);
    expect(after.persistent.loginCredentialsExposed).toBeFalsy();
    expect(after.persistent.accountCompromised).toBeFalsy();
  });
});

describe("the final submission", () => {
  it("requires the saved draft and verified access, submits from the portal, and displays the receipt", async () => {
    const rig = mountLayer();
    let laptop = app(rig, "thesis");
    // The three reviews of the Thesis desk, recorded through the core (the desk UI has its own tests).
    play(rig, [
      { type: "COMPLETE_THESIS_TASK", taskId: "draft.intro-review", approachId: "qualify" },
      { type: "COMPLETE_THESIS_TASK", taskId: "draft.findings", approachId: "fix-chart" },
      { type: "COMPLETE_THESIS_TASK", taskId: "draft.final", approachId: "full-review" },
    ]);
    expect(rig.store().getState().world.thesisTasksDone).toEqual(expect.arrayContaining(["draft.intro-review", "draft.findings", "draft.final"]));
    expect(rig.store().getState().device.submission).toBe("not-submitted");

    laptop = await goToBookmark(rig, PORTAL);
    fireEvent.click(within(laptop).getByTestId("portal-nav-thesis"));
    const blockedSubmit = await within(laptop).findByTestId("portal-submit-thesis");
    expect((blockedSubmit as HTMLButtonElement).disabled).toBe(true);
    expect(within(laptop).getByTestId("portal-submit-blocked-hint").textContent).toContain("confirm access");

    fireEvent.click(within(laptop).getByTestId("portal-nav-account"));
    fireEvent.click(await within(laptop).findByTestId("portal-check-account"));
    fireEvent.click(within(laptop).getByTestId("portal-nav-thesis"));
    const submit = await within(laptop).findByTestId("portal-submit-thesis");
    expect((submit as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(submit);
    expect(await within(laptop).findByTestId("portal-submission-receipt")).toBeTruthy();
    expect(rig.store().getState().device.submission).toBe("submitted");
    expect(rig.store().getState().world.missions["m01.final-submission"].status).toBe("completed");
  }, 30_000);
});

describe("the skip path: no email, the thesis goes on, the access stays unverified", () => {
  it("loses nothing and leaves the question open for Friday", () => {
    const rig = mountLayer();
    play(rig, [advance(10)]);
    const laptop = app(rig, "thesis");
    workOnThesis(laptop);
    const state = rig.store().getState();
    expect(state.resources.thesisProgress).toBeGreaterThan(60);
    expect(state.resources.cash).toBe(START_CASH);
    expect(state.persistent.schoolAccessVerified).toBe(false);
    expect(state.device.items["mail.clearance"].read).toBe(false);
    // Friday morning the unverified access comes back as a question.
    play(rig, [advance(MISSION_01_CONFIG.lateAccessCheckMinute)]);
    const pending = rig.store().getState().world.events["m01.late-access-check"];
    expect(pending?.status).toBe("pending");
  });
});

describe("switching apps", () => {
  it("never changes the game state: Mail, Browser, Portal, Banking, Files, Thesis and Calendar only show it", async () => {
    const rig = mountLayer();
    play(rig, [advance(10)]);
    const before = rig.store().getState();
    app(rig, "device-mail");
    await goToBookmark(rig, PORTAL);
    app(rig, "device-bank");
    app(rig, "device-files");
    app(rig, "thesis");
    const laptop = app(rig, "device-calendar");
    expect(within(laptop).getByTestId("calendar-time-left")).toBeTruthy();
    expect(within(laptop).getByTestId("calendar-group-upcoming")).toBeTruthy();
    const after = rig.store().getState();
    expect(after.events).toHaveLength(before.events.length);
    expect(after.resources).toEqual(before.resources);
  });
});
