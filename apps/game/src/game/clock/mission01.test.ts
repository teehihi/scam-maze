// Mission 01 "THE MISSING ACCESS": the email, the three ways to play it, the SECURITY BREACH, the
// draft and the consequences that stay for later missions. Uses the real scenario.
import { describe, expect, it, vi } from "vitest";
import { encodeProgress, restoreProgress } from "../saves/chapterProgress";
import { LAST_SUBMISSION_SCENARIO } from "../narrative/chapter1/lastSubmission";
import { MISSION_01_CONFIG } from "../narrative/chapter1/mission01";
import { selectDeviceView, validateDeviceContent } from "../narrative/device";
import { narrativeTextEntries } from "../narrative/localize";
import { chapterReducer, createInitialState } from "../narrative/reducer";
import { CHAPTER_DURATION_MINUTES, minutesFromStart } from "../narrative/resources";
import type { ChapterState, CoreAction } from "../narrative/types";
import { validateScenario } from "../narrative/validateScenario";
import { selectOpenMissions, selectPendingEvents, selectThesisView, validateWorldContent } from "../narrative/world";

const S = LAST_SUBMISSION_SCENARIO;
const START: CoreAction = { type: "START_CHAPTER" };
const advance = (minutes: number): CoreAction => ({ type: "ADVANCE_TIME", minutes });
const open = (itemId: string): CoreAction => ({ type: "OPEN_DEVICE_ITEM", itemId });
const use = (itemId: string, actionId: string): CoreAction => ({ type: "USE_DEVICE_ITEM", itemId, actionId });
const task = (taskId: string): CoreAction => ({ type: "COMPLETE_THESIS_TASK", taskId });

function step(state: ChapterState, action: CoreAction): ChapterState {
  if (action.type === "COMPLETE_THESIS_TASK" && action.taskId === "draft.findings" && state.world.thesisDraft.findings === undefined) {
    const drafted = chapterReducer(state, {
      type: "SAVE_THESIS_DRAFT",
      sectionId: "findings",
      content: "In this interview sample, 6 of 24 participants asked a classmate when they could not identify the right office. This count describes these interviews, not all students.",
    }, S);
    expect(drafted.accepted, drafted.reason).toBe(true);
    state = drafted.state;
  }
  const result = chapterReducer(state, action, S);
  expect(result.accepted, `${action.type} ${JSON.stringify(action)}: ${result.reason ?? ""}`).toBe(true);
  return result.state;
}
function run(actions: CoreAction[], from: ChapterState = createInitialState(S)): ChapterState {
  return actions.reduce(step, from);
}
const rejection = (state: ChapterState, action: CoreAction) => chapterReducer(state, action, S).reason;

/** The email has arrived and the payment page is open. */
const PAGE_OPEN: CoreAction[] = [START, advance(10), open("mail.clearance"), use("mail.clearance", "open-link")];
const SIGNED_IN: CoreAction[] = [...PAGE_OPEN, use("page.fee", "sign-in")];
const PAID: CoreAction[] = [...SIGNED_IN, use("page.fee", "pay-card")];
const CODE_GIVEN: CoreAction[] = [...PAID, use("page.fee", "enter-code")];
/** The two steps that stop the transfers: call the official bank line and report. */
const REPORT: CoreAction[] = [use("contact.bank", "call"), use("contact.bank", "report-fraud")];
/** The whole Training Office conversation. */
const OFFICE: CoreAction[] = [use("contact.training-office", "call"), use("contact.training-office", "confirm-fee"), use("contact.training-office", "ask-account")];
const FEE = MISSION_01_CONFIG.clearanceFeeVnd;
const [T1, T2, T3] = MISSION_01_CONFIG.unauthorizedTransfers;

const status = (state: ChapterState, id: string) => state.world.missions[id].status;
const path = (state: ChapterState, id: string) => state.world.missions[id].path;
const ids = (view: { id: string }[]) => view.map((item) => item.id);

describe("the scenario", () => {
  it("is consistent: world, device and thesis content are valid and only the later missions' collections are empty", () => {
    expect(validateWorldContent(S)).toEqual([]);
    expect(validateDeviceContent(S)).toEqual([]);
    expect(validateScenario(S).filter((message) => !/needs at least one/.test(message))).toEqual([]);
  });

  it("opens Mission 01 at Tuesday 17:00 and brings the email at 17:10", () => {
    let state = run([START]);
    expect(status(state, "m01.missing-access")).toBe("open");
    expect(path(state, "m01.missing-access")).toBe("default");
    const openMissions = selectOpenMissions(state, S);
    expect(openMissions.find((mission) => mission.id === "m01.missing-access")?.objective).toBe(
      "Finish the draft by Wednesday, 06:00, and confirm you can sign in to submit by Friday, 17:00.",
    );
    expect(openMissions.map((mission) => mission.id)).toContain("m01.final-submission");
    expect(Object.hasOwn(state.device.items, "mail.clearance")).toBe(false);
    state = step(state, advance(10));
    const email = selectDeviceView(state, S, "phone").apps.mail.find((item) => item.id === "mail.clearance")!;
    expect(email.title).toBe("Graduation Clearance — Action Required");
    expect(email.from).toContain("payment-ueh.vn");
    expect(email.body).toContain("international student confirmation fee");
    expect(email.read).toBe(false);
  });

  it("shows ordinary mail, chats and appointments of Alex's life from the start", () => {
    const state = run([START]);
    const phone = selectDeviceView(state, S, "phone");
    expect(ids(phone.apps.messages)).toEqual(["msg.minh"]);
    expect(ids(phone.apps.mail).sort()).toEqual(["mail.library", "mail.print-shop", "mail.supervisor"]);
    expect(ids(phone.apps.calendar)).toEqual(["cal.draft-deadline", "cal.interview", "cal.m02-interview", "cal.final-deadline"]);
  });
});

describe("the draft on the laptop", () => {
  it("is edited through thesis tasks that cost time and add progress", () => {
    let state = run([START]);
    expect(selectThesisView(state, S).tasks.map((item) => [item.id, item.blocked])).toEqual([
      ["draft.intro-review", null],
      ["draft.findings", null],
      ["draft.final", "locked"],
    ]);
    expect(rejection(state, task("draft.final"))).toBe("This thesis task is not available now.");
    state = run([task("draft.intro-review"), task("draft.findings"), task("draft.final")], state);
    expect(state.resources.thesisProgress).toBe(67);
    expect(state.resources.timeMinutes).toBe(CHAPTER_DURATION_MINUTES - 240);
    expect(status(state, "m01.missing-access")).toBe("completed");
  });

  it("rejects a new-editor findings completion when the saved section has no evidence", () => {
    const state = run([START, task("draft.intro-review")]);
    const attempt = chapterReducer(state, {
      type: "COMPLETE_THESIS_TASK",
      taskId: "draft.findings",
      researchNotes: [],
    }, S);
    expect(attempt.accepted).toBe(false);
    expect(attempt.reason).toBe("Cite an interview count and state the sample limitation before resolving the findings revision.");
    expect(attempt.state.world.thesisTasksDone).not.toContain("draft.findings");
    expect(attempt.state.resources.timeMinutes).toBe(state.resources.timeMinutes);
  });

  it("makes the findings usable in the email only when Alex actually includes the saved-channel interview note", () => {
    const withoutSource = run([START, advance(10), task("draft.intro-review"), task("draft.findings")]);
    expect(withoutSource.persistent.researchSavedChannelIncluded).toBe(false);
    const plainEmail = selectDeviceView(withoutSource, S, "phone").apps.mail.find((item) => item.id === "mail.clearance")!;
    expect(plainEmail.actions.some((action) => action.id === "compare-fee-with-saved-portal")).toBe(false);

    const withSource = run([
      START,
      advance(10),
      task("draft.intro-review"),
      {
        type: "SAVE_THESIS_DRAFT",
        sectionId: "findings",
        content: "Across the interviews, students described checking an unexpected request against a channel they already knew. In this interview sample, 9 of 24 participants described checking a saved portal or a contact they had used before. This count describes these interviews, not all students.",
      },
      { type: "COMPLETE_THESIS_TASK", taskId: "draft.findings", researchNotes: ["saved-channel"] },
    ]);
    expect(withSource.persistent.researchSavedChannelIncluded).toBe(true);
    const informedEmail = selectDeviceView(withSource, S, "phone").apps.mail.find((item) => item.id === "mail.clearance")!;
    expect(informedEmail.actions.some((action) => action.id === "compare-fee-with-saved-portal")).toBe(true);
    const compared = run([use("mail.clearance", "compare-fee-with-saved-portal")], withSource);
    expect(compared.persistent.schoolFeeClaimContradicted).toBe(true);
    expect(compared.persistent.schoolAccessVerified).toBe(false);
    expect(compared.device.items["file.fee-comparison"]).toBeDefined();
  });

  it("goes on after the internal deadline, with the cost of working through the night", () => {
    const late = run([START, advance(MISSION_01_CONFIG.draftDeadlineMinute)]);
    expect(status(late, "m01.missing-access")).toBe("failed");
    expect(late.persistent.overnightWork).toBe(true);
    expect(late.resources.timeMinutes).toBe(CHAPTER_DURATION_MINUTES - MISSION_01_CONFIG.draftDeadlineMinute - MISSION_01_CONFIG.overnightWorkMinutes);
    // The draft can still be finished, and the overnight work is not reset.
    const after = run([task("draft.intro-review"), task("draft.findings"), task("draft.final")], late);
    expect(after.resources.thesisProgress).toBe(67);
    expect(after.persistent.overnightWork).toBe(true);
  });

  it("does not fail when the draft is done in time", () => {
    const state = run([START, task("draft.intro-review"), task("draft.findings"), task("draft.final"), advance(MISSION_01_CONFIG.draftDeadlineMinute)]);
    expect(status(state, "m01.missing-access")).toBe("completed");
    expect(state.persistent.overnightWork).toBe(false);
  });
});

describe("way A: follow the link", () => {
  it("opening the page alone costs a little time and no money, and nothing is exposed", () => {
    const state = run(PAGE_OPEN);
    expect(state.resources.cash).toBe(2_500_000);
    expect(state.resources.digitalSecurity).toBe(100);
    expect(state.persistent.loginCredentialsExposed).toBe(false);
    expect(state.persistent.accountCompromised).toBe(false);
    expect(status(state, "m01.security-breach")).toBe("locked");
    expect(state.resources.timeMinutes).toBe(CHAPTER_DURATION_MINUTES - 10 - 3);
    // Later steps are not even listed until the earlier one is done.
    const page = selectDeviceView(state, S, "phone").apps.mail.find((item) => item.id === "page.fee")!;
    expect(page.actions.map((action) => action.id)).toEqual(["close", "save-address", "sign-in"]);
    // Closing the page changes nothing else.
    const closed = step(state, use("page.fee", "close"));
    expect(closed.persistent).toEqual(state.persistent);
    expect(closed.resources.cash).toBe(state.resources.cash);
  });

  it("entering the student login exposes it and opens the SECURITY BREACH, without taking money", () => {
    const state = run(SIGNED_IN);
    expect(state.persistent.loginCredentialsExposed).toBe(true);
    expect(state.persistent.verificationCodeExposed).toBe(false);
    expect(state.persistent.accountCompromised).toBe(false);
    expect(state.resources.digitalSecurity).toBe(80);
    expect(state.resources.cash).toBe(2_500_000);
    expect(status(state, "m01.security-breach")).toBe("open");
    expect(path(state, "m01.security-breach")).toBe("credentials");
    expect(path(state, "m01.missing-access")).toBe("breach");
    const page = selectDeviceView(state, S, "phone").apps.mail.find((item) => item.id === "page.fee")!;
    expect(page.actions.map((action) => action.id)).toEqual(["close", "save-address", "sign-in", "pay-card"]);
  });

  it("with the login only, securing the account in time stops the takeover and closes the breach", () => {
    let state = run([...SIGNED_IN, use("settings.security", "change-passwords")]);
    expect(status(state, "m01.security-breach")).toBe("completed");
    expect(state.resources.digitalSecurity).toBe(100); // 80 + 15 + 10, capped at 100
    state = step(state, advance(300));
    expect(state.persistent.accountCompromised).toBe(false);
    expect(state.resources.cash).toBe(2_500_000);
    expect(path(state, "m01.missing-access")).toBe("default");
  });

  it("with the login only, waiting lets the account be taken over", () => {
    const state = run([...SIGNED_IN, advance(MISSION_01_CONFIG.takeoverAfterMinutes)]);
    expect(state.persistent.accountCompromised).toBe(true);
    expect(state.persistent.accountEverCompromised).toBe(true);
    expect(state.resources.digitalSecurity).toBe(60);
    expect(state.resources.cash).toBe(2_500_000);
    expect(Object.hasOwn(state.device.items, "mail.login-alert")).toBe(true);
  });

  it("paying and giving the verification code costs the fee and compromises the account", () => {
    const state = run(CODE_GIVEN);
    expect(state.resources.cash).toBe(2_500_000 - FEE);
    expect(state.device.ledger.map((entry) => [entry.label, entry.amount])).toEqual([["ledger.clearance-fee", -FEE]]);
    expect(state.persistent).toMatchObject({ loginCredentialsExposed: true, verificationCodeExposed: true, accountCompromised: true, accountEverCompromised: true });
    expect(state.resources.digitalSecurity).toBe(100 - 20 - 30);
    expect(path(state, "m01.security-breach")).toBe("code");
  });

  it("unauthorized transfers continue while nothing is done, and most of the reserve is lost", () => {
    const state = run([...CODE_GIVEN, advance(T3.afterMinutes + 5)]);
    expect(state.device.ledger.map((entry) => entry.amount)).toEqual([-FEE, -T1.amountVnd, -T2.amountVnd, -T3.amountVnd]);
    expect(state.resources.cash).toBe(2_500_000 - FEE - T1.amountVnd - T2.amountVnd - T3.amountVnd);
    expect(state.resources.cash).toBeLessThan(2_500_000 / 4);
    const alerts = selectDeviceView(state, S, "phone").apps.messages;
    expect(ids(alerts)).toEqual(expect.arrayContaining(["msg.bank-alert-1", "msg.bank-alert-2", "msg.bank-alert-3"]));
    [T1, T2, T3].forEach((transfer, index) => {
      expect(alerts.find((item) => item.id === `msg.bank-alert-${index + 1}`)?.body).toContain(
        `${transfer.amountVnd.toLocaleString("en-US")} VND`,
      );
    });
  });

  it("puts every transfer in the ledger at its scheduled minute, even after one long wait", () => {
    const codeAt = CHAPTER_DURATION_MINUTES - run(CODE_GIVEN).resources.timeMinutes;
    const state = run([...CODE_GIVEN, advance(500)]);
    expect(state.device.ledger.slice(1).map((entry) => entry.atMinute)).toEqual([T1, T2, T3].map((transfer) => codeAt + transfer.afterMinutes));
    // The bank alerts arrive at the same minutes.
    expect([1, 2, 3].map((index) => state.device.items[`msg.bank-alert-${index}`].arrivedAtMinute)).toEqual(
      [T1, T2, T3].map((transfer) => codeAt + transfer.afterMinutes),
    );
  });

  it("takes only the cash that is there, and never makes the cash negative", () => {
    const start = run(CODE_GIVEN);
    const poor: ChapterState = { ...start, resources: { ...start.resources, cash: 200_000 } };
    const state = step(poor, advance(500));
    expect(state.resources.cash).toBe(0);
    expect(state.device.ledger.slice(1).map((entry) => entry.amount)).toEqual([-200_000]);
  });

  it("never happens twice and never gives money back", () => {
    let state = run(CODE_GIVEN);
    let lowest = state.resources.cash;
    for (let i = 0; i < 60; i += 1) {
      const next = step(state, advance(15));
      expect(next.resources.cash).toBeLessThanOrEqual(state.resources.cash);
      lowest = Math.min(lowest, next.resources.cash);
      state = next;
    }
    expect(state.device.ledger.map((entry) => entry.label)).toEqual(["ledger.clearance-fee", "ledger.unauthorized-1", "ledger.unauthorized-2", "ledger.unauthorized-3"]);
    expect(state.resources.cash).toBe(lowest);
  });

  it("does nothing to the accounts when the player never takes a qualifying step", () => {
    const state = run([START, advance(2000)]);
    expect(state.persistent).toMatchObject({
      loginCredentialsExposed: false,
      verificationCodeExposed: false,
      accountCompromised: false,
      accountEverCompromised: false,
    });
    expect(state.resources.cash).toBe(2_500_000);
    expect(state.device.ledger).toEqual([]);
    expect(status(state, "m01.security-breach")).toBe("locked");
  });

  it("puts the takeover and the sign-in alert at their scheduled minutes", () => {
    const signedAt = CHAPTER_DURATION_MINUTES - run(SIGNED_IN).resources.timeMinutes;
    const state = run([...SIGNED_IN, advance(400)]);
    expect(state.world.events["m01.takeover"].firedAtMinute).toBe(signedAt + MISSION_01_CONFIG.takeoverAfterMinutes);
    expect(state.device.items["mail.login-alert"].arrivedAtMinute).toBe(signedAt + MISSION_01_CONFIG.loginAlertAfterMinutes);
  });

  it("does not take over the account when the passwords were changed before that minute", () => {
    const state = run([...SIGNED_IN, use("settings.security", "change-passwords"), advance(400)]);
    expect(Object.hasOwn(state.world.events, "m01.takeover")).toBe(false);
    // Giving the code is the other path: no takeover event, the transfers instead.
    const code = run([...CODE_GIVEN, advance(400)]);
    expect(Object.hasOwn(code.world.events, "m01.takeover")).toBe(false);
  });

  it("a fast report to the bank stops the transfers even before the passwords are changed", () => {
    const early = run([...CODE_GIVEN, ...REPORT, advance(200)]);
    expect(early.device.ledger).toHaveLength(1);
    expect(early.resources.cash).toBe(2_500_000 - FEE);
    expect(early.resources.evidence).toBe(1);
    expect(Object.hasOwn(early.device.items, "file.bank-report")).toBe(true);
    // The breach closes only after the passwords are changed as well.
    expect(status(early, "m01.security-breach")).toBe("open");
    const secured = step(early, use("settings.security", "change-passwords"));
    expect(status(secured, "m01.security-breach")).toBe("completed");
  });

  it("a report that finishes one minute after the first transfer is due does not undo it", () => {
    const late = run([...CODE_GIVEN, advance(1), ...REPORT, advance(200)]);
    expect(late.device.ledger.map((entry) => entry.amount)).toEqual([-FEE, -T1.amountVnd]);
  });

  it("a slow report loses what the earlier transfers took, and the loss stays", () => {
    const slow = run([...CODE_GIVEN, advance(T2.afterMinutes + 2), ...REPORT, use("settings.security", "change-passwords")]);
    expect(slow.device.ledger.map((entry) => entry.amount)).toEqual([-FEE, -T1.amountVnd, -T2.amountVnd]);
    expect(status(slow, "m01.security-breach")).toBe("completed");
    const later = step(slow, advance(1000));
    expect(later.resources.cash).toBe(2_500_000 - FEE - T1.amountVnd - T2.amountVnd);
  });

  it("the breach after the code needs both the bank report and the passwords", () => {
    const onlyPasswords = run([...CODE_GIVEN, use("settings.security", "change-passwords")]);
    expect(status(onlyPasswords, "m01.security-breach")).toBe("open");
  });

  it("access can be recovered, and the history of the compromise stays for later missions", () => {
    const secured = run([...CODE_GIVEN, ...REPORT, use("settings.security", "change-passwords")]);
    expect(secured.persistent.accountCompromised).toBe(true);
    const recovered = step(secured, use("settings.security", "recover-access"));
    expect(recovered.persistent.accountCompromised).toBe(false);
    expect(recovered.persistent.accountEverCompromised).toBe(true);
    expect(recovered.persistent.verificationCodeExposed).toBe(true);
    expect(recovered.resources.cash).toBe(2_500_000 - FEE);
  });

  it("does not list the recovery before the account is compromised", () => {
    const state = run([START]);
    const settings = selectDeviceView(state, S, "laptop").apps.files.find((item) => item.id === "settings.security")!;
    expect(settings.actions.map((action) => action.id)).toEqual(["change-passwords"]);
    expect(rejection(state, use("settings.security", "recover-access"))).toBe("This action is not available now.");
  });

  it("does not let the player skip the steps of the page", () => {
    const state = run(PAGE_OPEN);
    expect(rejection(state, use("page.fee", "pay-card"))).toBe("This action is not available now.");
    expect(rejection(state, use("page.fee", "enter-code"))).toBe("This action is not available now.");
  });
});

describe("way B: verify independently", () => {
  const VERIFIED: CoreAction[] = [
    START,
    advance(10),
    use("portal.saved", "check-account"),
    ...OFFICE,
  ];

  it("costs time, loses no money and creates evidence", () => {
    const state = run(VERIFIED);
    expect(state.resources.cash).toBe(2_500_000);
    expect(state.resources.digitalSecurity).toBe(100);
    expect(state.resources.timeMinutes).toBe(CHAPTER_DURATION_MINUTES - 10 - 15 - 40);
    expect(MISSION_01_CONFIG.minutes.officeCall + MISSION_01_CONFIG.minutes.officeDescribe + MISSION_01_CONFIG.minutes.officeAsk).toBe(40);
    expect(state.resources.evidence).toBe(1);
    expect(state.resources.supportNetwork).toBe(55);
    expect(state.persistent.schoolAccessVerified).toBe(true);
    const files = selectDeviceView(state, S, "laptop").apps.files.map((item) => item.id);
    expect(files).toEqual(expect.arrayContaining(["file.portal-status", "file.office-confirmation"]));
    expect(ids(selectDeviceView(state, S, "phone").apps.mail)).toContain("mail.office-reply");
    expect(selectDeviceView(state, S, "phone").files.evidenceCount).toBe(1);
    expect(path(state, "m01.missing-access")).toBe("verified");
  });

  it("still lets the player finish the draft and complete the mission", () => {
    const state = run([...VERIFIED, task("draft.intro-review"), task("draft.findings"), task("draft.final")]);
    expect(status(state, "m01.missing-access")).toBe("completed");
    expect(state.persistent.schoolAccessVerified).toBe(true);
    // Access was verified, so the question never comes back on Friday.
    const friday = step(state, advance(minutesFromStart(5, 12, 0)));
    expect(Object.hasOwn(friday.world.events, "m01.late-access-check")).toBe(false);
  });

  it("can be done only once", () => {
    const state = run(VERIFIED);
    expect(rejection(state, use("contact.training-office", "confirm-fee"))).toBe("This action was already used.");
  });

  it("is a conversation of several turns that must be followed in order", () => {
    const start = run([START, advance(10)]);
    // Only the first turn is offered at first.
    const contact = (state: ChapterState) => selectDeviceView(state, S, "phone").apps.contacts.find((item) => item.id === "contact.training-office")!;
    expect(contact(start).actions.map((action) => action.id)).toEqual(["call"]);
    expect(rejection(start, use("contact.training-office", "confirm-fee"))).toBe("This action is not available now.");
    const called = step(start, use("contact.training-office", "call"));
    expect(contact(called).actions.map((action) => [action.id, action.available])).toEqual([["call", false], ["confirm-fee", true]]);
    expect(called.persistent.schoolAccessVerified).toBe(false);
    // The history grows with each turn, in order, with the time each turn finished.
    const done = run(OFFICE.slice(1), called);
    const history = contact(done).conversation;
    expect(history.map((line) => line.speaker)).toEqual(["other", "alex", "alex", "other", "alex", "other"]);
    expect(history.map((line) => line.atMinute)).toEqual([...history.map((line) => line.atMinute)].sort((a, b) => a - b));
    expect(history[3].text).toContain("We have no such fee");
    expect(done.persistent.schoolAccessVerified).toBe(true);
  });

  it("costs the time of every turn and no money", () => {
    const start = run([START, advance(10)]);
    const state = run(OFFICE, start);
    const { officeCall, officeDescribe, officeAsk } = MISSION_01_CONFIG.minutes;
    expect(start.resources.timeMinutes - state.resources.timeMinutes).toBe(officeCall + officeDescribe + officeAsk);
    expect(state.resources.cash).toBe(start.resources.cash);
    expect(state.device.ledger).toEqual([]);
  });

  it("keeps the official channels apart from the attacker's page", () => {
    const state = run([...CODE_GIVEN, ...REPORT]);
    const contacts = selectDeviceView(state, S, "phone").apps.contacts;
    const bank = contacts.find((item) => item.id === "contact.bank")!;
    expect(bank.detail).toBe("+000 100 0100");
    expect(JSON.stringify(bank.conversation)).not.toMatch(/uni-graduation-office/);
    // Nothing in the official conversations asks the player to share a code or a login.
    expect(JSON.stringify(bank.conversation)).not.toMatch(/send me|tell me your (code|password)|give me/i);
  });
});

describe("way C: ignore the email", () => {
  const WRITING: CoreAction[] = [START, advance(10), task("draft.intro-review"), task("draft.findings"), task("draft.final")];

  it("loses no money and no security, and the mission completes with the access unverified", () => {
    const state = run(WRITING);
    expect(state.resources.cash).toBe(2_500_000);
    expect(state.resources.digitalSecurity).toBe(100);
    expect(state.resources.evidence).toBe(0);
    expect(state.persistent.schoolAccessVerified).toBe(false);
    expect(status(state, "m01.missing-access")).toBe("completed");
    expect(status(state, "m01.security-breach")).toBe("locked");
  });

  it("brings the unverified access back on Friday morning, when it costs more time to settle", () => {
    const early = run(WRITING);
    const friday = step(early, advance(MISSION_01_CONFIG.lateAccessCheckMinute - 10));
    expect(selectPendingEvents(friday, S).map((event) => event.id)).toEqual(["m01.late-access-check"]);
    const view = selectPendingEvents(friday, S)[0];
    expect(view.responses.map((response) => [response.id, response.timeCostMinutes])).toEqual([
      ["verify-now", MISSION_01_CONFIG.lateAccessCheckMinutes],
      ["later", 0],
    ]);
    const settled = step(friday, { type: "RESPOND_EVENT", eventId: "m01.late-access-check", response: "verify-now" });
    expect(settled.persistent.schoolAccessVerified).toBe(true);
    expect(settled.resources.evidence).toBe(1);
    expect(settled.resources.timeMinutes).toBe(friday.resources.timeMinutes - MISSION_01_CONFIG.lateAccessCheckMinutes);
    // It cost more than doing it on Tuesday.
    expect(MISSION_01_CONFIG.lateAccessCheckMinutes).toBeGreaterThan(40);
  });
});

describe("consequences that last and sync", () => {
  it("restores everything from a save: time, money, security, evidence, flags, missions and the ledger", () => {
    const actions = [...CODE_GIVEN, advance(T1.afterMinutes + 1), ...REPORT, task("draft.intro-review"), use("contact.bank", "ask-next"), { type: "REST", mode: "nap" } as CoreAction];
    const state = run(actions);
    expect(state.device.ledger).toHaveLength(2);
    const progress = encodeProgress(state, null, "start");
    const restored = restoreProgress(JSON.parse(JSON.stringify(progress)), S);
    expect(restored.ok && restored.state).toEqual(state);
  });

  it("is deterministic", () => {
    const actions = [...PAID, advance(500)];
    expect(run(actions)).toEqual(run(actions));
  });

  it("keeps the same facts on the phone and on the laptop", () => {
    const state = run(CODE_GIVEN);
    expect(selectDeviceView(state, S, "phone").bank.balance).toBe(selectDeviceView(state, S, "laptop").bank.balance);
    expect(selectDeviceView(state, S, "phone").bank.ledger).toEqual(selectDeviceView(state, S, "laptop").bank.ledger);
  });

  it("never calls an item safe, unsafe or a scam, and shows no score", () => {
    const state = run([...CODE_GIVEN, advance(200)]);
    const views = JSON.stringify([selectDeviceView(state, S, "phone"), selectDeviceView(state, S, "laptop"), selectOpenMissions(state, S)]);
    expect(views).not.toMatch(/\b(safe|unsafe|scam|phish|fake|good|bad|score)\b/i);
  });
});

describe("Vietnamese text", () => {
  it("covers every text key of the scenario and has no key the scenario does not use", async () => {
    const { LAST_SUBMISSION_NARRATIVE_VI } = await vi.importActual<typeof import("../../i18n/narrative/lastSubmission.vi")>(
      "../../i18n/narrative/lastSubmission.vi",
    );
    const keys = narrativeTextEntries(S, {} as never)
      .filter((entry) => entry.text.trim().length > 0)
      .map((entry) => entry.key);
    const overlayKeys = Object.keys(LAST_SUBMISSION_NARRATIVE_VI);
    expect(keys.filter((key) => !overlayKeys.includes(key))).toEqual([]);
    expect(overlayKeys.filter((key) => !keys.includes(key))).toEqual([]);
  });

  it("keeps the fee of the English text", async () => {
    const { LAST_SUBMISSION_NARRATIVE_VI: vi_ } = await vi.importActual<typeof import("../../i18n/narrative/lastSubmission.vi")>(
      "../../i18n/narrative/lastSubmission.vi",
    );
    const format = (amount: number) => amount.toLocaleString("de-DE");
    expect(vi_["device/mail.clearance/body"]).toContain(format(FEE));
    expect(vi_["device/page.fee/body"]).toContain(format(FEE));
    // Each alert states the exact transfer amount, with Vietnamese thousands separators.
    [T1, T2, T3].forEach((transfer, index) =>
      expect(vi_[`device/msg.bank-alert-${index + 1}/body`]).toContain(`${transfer.amountVnd.toLocaleString("de-DE")} VNĐ`),
    );
  });
});

describe("the Files app", () => {
  it("lists saved evidence documents as evidence", () => {
    const state = run([START, advance(10), use("portal.saved", "check-account"), ...OFFICE]);
    const files = selectDeviceView(state, S, "phone").files;
    expect(files.evidenceTitles).toEqual(["Training Office reply (saved)"]);
    expect(files.evidenceCount).toBe(1);
  });
});

describe("unread counts", () => {
  it("count only mail and chats, not appointments or files", () => {
    const view = selectDeviceView(run([START, advance(10)]), S, "phone");
    expect(view.unread.mail).toBe(4);
    expect(view.unread.messages).toBe(1);
    expect(view.unread.calendar).toBe(0);
    expect(view.unread.files).toBe(0);
    expect(view.apps.calendar.every((item) => !item.tracksUnread)).toBe(true);
  });
});