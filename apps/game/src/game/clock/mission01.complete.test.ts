// Mission 01 as a whole: the finance model, the flags every branch leaves, the submission
// consequences, skipping the optional missions, save and load, and old saves. Real scenario.
import { describe, expect, it } from "vitest";
import { encodeProgress, restoreProgress } from "../saves/chapterProgress";
import { SAVE_CONTENT_VERSION } from "../saves/saveGame";
import { LAST_SUBMISSION_SCENARIO } from "../narrative/chapter1/lastSubmission";
import { MISSION_01_CONFIG } from "../narrative/chapter1/mission01";
import { MISSION_01_OFFERS_CONFIG as OFFERS } from "../narrative/chapter1/mission01Offers";
import { selectDeviceView, selectFinance } from "../narrative/device";
import { chapterReducer, createInitialState } from "../narrative/reducer";
import { CHAPTER_DURATION_MINUTES } from "../narrative/resources";
import type { ChapterState, CoreAction } from "../narrative/types";
import { selectPendingEvents } from "../narrative/world";

const S = LAST_SUBMISSION_SCENARIO;
const START: CoreAction = { type: "START_CHAPTER" };
const advance = (minutes: number): CoreAction => ({ type: "ADVANCE_TIME", minutes });
const use = (itemId: string, actionId: string): CoreAction => ({ type: "USE_DEVICE_ITEM", itemId, actionId });
const task = (taskId: string): CoreAction => ({ type: "COMPLETE_THESIS_TASK", taskId });
const toMinute = (state: ChapterState, minute: number): CoreAction => advance(Math.max(1, minute - (CHAPTER_DURATION_MINUTES - state.resources.timeMinutes)));

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
const run = (actions: CoreAction[], from: ChapterState = createInitialState(S)) => actions.reduce(step, from);
const DRAFT = [task("draft.intro-review"), task("draft.findings"), task("draft.final")];

const FEE_PAGE: CoreAction[] = [advance(10), use("mail.clearance", "open-link"), use("page.fee", "sign-in"), use("page.fee", "pay-card"), use("page.fee", "enter-code")];
const JOB: CoreAction[] = [use("msg.easy-money", "open-link"), use(P(), "do-task-1"), use(P(), "try-withdraw-1"), use(P(), "deposit-1")];
const GOLD: CoreAction[] = [use("msg.golden-friend", "open-link"), use("page.golden", "invest"), use("page.golden", "check-dashboard"), use("page.golden", "withdraw-1"), use("page.golden", "pay-fee-1")];
function P() {
  return "job.platform";
}

/** Everything that can go wrong, in time order. */
function chaos(): ChapterState {
  let state = run([START]);
  state = step(state, toMinute(state, OFFERS.easyMoneyAtMinute));
  state = run(JOB, state);
  state = step(state, toMinute(state, OFFERS.goldenPlatformAtMinute));
  state = run(GOLD, state);
  return run([advance(10), use("mail.clearance", "open-link"), use("page.fee", "sign-in"), use("page.fee", "pay-card"), use("page.fee", "enter-code"), advance(400)], state);
}

describe("finance model", () => {
  it("uses the one ledger: cash, spendable, debt, locked funds, loss and shown profit never double count", () => {
    const state = chaos();
    const finance = selectFinance(state, S);
    const spent = 2_500_000 - state.resources.cash;
    expect(finance.cash).toBe(state.resources.cash);
    expect(finance.financialLoss).toBe(spent);
    expect(finance.lockedFunds).toBe(OFFERS.easyMoney.depositsVnd[0] + OFFERS.goldenPlatform.investVnd);
    expect(finance.lockedFunds).toBeLessThanOrEqual(finance.financialLoss);
    expect(finance.displayedProfit).toBe(OFFERS.easyMoney.shownVnd[1] - OFFERS.easyMoney.depositsVnd[0] + (OFFERS.goldenPlatform.shownVnd[1] - OFFERS.goldenPlatform.investVnd));
    // The shown profit is not money: it is in no cash figure and not in the ledger.
    expect(state.device.ledger.every((entry) => entry.amount < 0)).toBe(true);
    expect(finance.spendable).toBe(Math.max(0, state.resources.cash));
    expect(finance.debt).toBe(0);
    // The bank view and the selector agree.
    expect(selectDeviceView(state, S, "phone").bank.finance).toEqual(finance);
    expect(selectDeviceView(state, S, "laptop").bank.finance).toEqual(finance);
  });

  it("counts the transfers and the fee once even after a long wait and a reload", () => {
    const state = chaos();
    const later = step(state, advance(1000));
    expect(selectFinance(later, S)).toEqual(selectFinance(state, S));
    const restored = restoreProgress(JSON.parse(JSON.stringify(encodeProgress(later, null, "start"))), S);
    expect(restored.ok && selectFinance(restored.state, S)).toEqual(selectFinance(later, S));
    const labels = later.device.ledger.map((entry) => entry.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("shows debt only when cash is below zero, and keeps the loan on top of the loss", () => {
    const base = run([START]);
    const rich = step(base, toMinute(base, OFFERS.easyMoneyAtMinute));
    const ready = run(
      [use("msg.easy-money", "open-link"), use(P(), "do-task-1"), use(P(), "try-withdraw-1"), use(P(), "deposit-1"), use(P(), "do-task-2"), use(P(), "try-withdraw-2"), use(P(), "deposit-2"), use(P(), "do-task-3"), use(P(), "try-withdraw-3")],
      rich,
    );
    const poor: ChapterState = { ...ready, resources: { ...ready.resources, cash: 100_000 } };
    const loan = step(poor, use(P(), "deposit-3-borrow"));
    const finance = selectFinance(loan, S);
    expect(finance.debt).toBe(OFFERS.easyMoney.depositsVnd[2] - 100_000);
    expect(finance.spendable).toBe(0);
    expect(finance.lockedFunds).toBe(OFFERS.easyMoney.depositsVnd.reduce((sum, value) => sum + value, 0));
  });

  it("shows the finance lines in the bank app only when there is something to show", () => {
    expect(selectFinance(run([START]), S)).toEqual({ cash: 2_500_000, spendable: 2_500_000, debt: 0, lockedFunds: 0, financialLoss: 0, displayedProfit: 0 });
  });
});

describe("flags that every branch leaves", () => {
  const flags = (state: ChapterState) => state.persistent;

  it("the email: nothing, the link, the login, the code", () => {
    expect(flags(run([START, advance(10), use("mail.clearance", "open-link")]))).toMatchObject({ loginCredentialsExposed: false, accountCompromised: false, lostMoneyToScam: false });
    expect(flags(run([START, ...FEE_PAGE.slice(0, 3)]))).toMatchObject({ loginCredentialsExposed: true, verificationCodeExposed: false, accountCompromised: false });
    expect(flags(run([START, ...FEE_PAGE]))).toMatchObject({ verificationCodeExposed: true, accountCompromised: true, accountEverCompromised: true, bankReported: false });
  });

  it("the bank report sets bankReported and the Training Office sets schoolAccessVerified", () => {
    const state = run([START, ...FEE_PAGE, use("contact.bank", "call"), use("contact.bank", "report-fraud")]);
    expect(flags(state)).toMatchObject({ bankReported: true, accountCompromised: true });
    const verified = run([START, advance(10), use("contact.training-office", "call"), use("contact.training-office", "confirm-fee")]);
    expect(flags(verified)).toMatchObject({ schoolAccessVerified: true });
  });

  it("Easy Money: joined, stopped, deposited, and the saved records", () => {
    const base = run([START]);
    let state = step(base, toMinute(base, OFFERS.easyMoneyAtMinute));
    expect(flags(state)).toMatchObject({ easyMoneyJoined: false, easyMoneyStopped: false });
    state = run([use("msg.easy-money", "open-link"), use(P(), "do-task-1")], state);
    expect(flags(state)).toMatchObject({ easyMoneyJoined: true, easyMoneyStopped: false, easyMoneyDeposited: false });
    state = run([use(P(), "try-withdraw-1"), use(P(), "deposit-1"), use(P(), "save-records"), use(P(), "stop")], state);
    expect(flags(state)).toMatchObject({ easyMoneyJoined: true, easyMoneyStopped: true, easyMoneyDeposited: true, scamEvidenceSaved: true, lostMoneyToScam: true });
  });

  it("The Golden Platform: joined, locked and the fees", () => {
    const base = run([START]);
    let state = step(base, toMinute(base, OFFERS.goldenPlatformAtMinute));
    state = run([use("msg.golden-friend", "open-link"), use("page.golden", "invest")], state);
    expect(flags(state)).toMatchObject({ goldenPlatformJoined: true, investmentFundsLocked: true, goldenFeesPaid: false });
    state = run([use("page.golden", "check-dashboard"), use("page.golden", "withdraw-1"), use("page.golden", "pay-fee-1")], state);
    expect(flags(state)).toMatchObject({ goldenFeesPaid: true, lostMoneyToScam: true, recoveryOfferEligible: true });
  });

  it("the draft: finished on time or late, and overnight work only when it was late", () => {
    const early = run([START, ...DRAFT]);
    expect(flags(early)).toMatchObject({ draftFinished: true, overnightWork: false });
    const late = run([START, advance(MISSION_01_CONFIG.draftDeadlineMinute), ...DRAFT]);
    expect(flags(late)).toMatchObject({ draftFinished: true, overnightWork: true });
  });
});

describe("the draft deadline", () => {
  it("starts the night of work, costs time and fatigue, and never ends the game", () => {
    const before = run([START, advance(MISSION_01_CONFIG.draftDeadlineMinute - 1)]);
    const after = step(before, advance(1));
    expect(after.persistent.overnightWork).toBe(true);
    expect(before.resources.timeMinutes - after.resources.timeMinutes).toBe(1 + MISSION_01_CONFIG.overnightWorkMinutes);
    expect(after.resources.fatigue).toBeGreaterThan(before.resources.fatigue);
    expect(after.status).toBe("playing");
    expect(after.outcome).toBeNull();
    // There is still a way on: the draft can be finished.
    const finished = run(DRAFT, after);
    expect(finished.persistent.draftFinished).toBe(true);
    expect(finished.world.missions["m01.missing-access"].status).toBe("failed");
  });
});

describe("the submission consequences", () => {
  it("requires the saved final draft and a usable account, then records a real submission receipt", () => {
    let state = run([START, ...DRAFT]);
    expect(state.device.submission).toBe("not-submitted");
    expect(state.world.missions["m01.final-submission"].status).toBe("open");
    const blocked = selectDeviceView(state, S, "laptop").apps.files.find((item) => item.id === "portal.saved")!.actions.find((action) => action.id === "submit-thesis")!;
    expect(blocked.available).toBe(false);

    state = step(state, use("portal.saved", "check-account"));
    const ready = selectDeviceView(state, S, "laptop").apps.files.find((item) => item.id === "portal.saved")!.actions.find((action) => action.id === "submit-thesis")!;
    expect(ready.available).toBe(true);
    state = step(state, use("portal.saved", "submit-thesis"));
    expect(state.device.submission).toBe("submitted");
    expect(state.device.items["portal.saved"].done).toContain("submit-thesis");
    expect(state.world.missions["m01.final-submission"].status).toBe("completed");
  });

  it("marks a missed final submission deadline without inventing a submission", () => {
    const state = run([START, advance(CHAPTER_DURATION_MINUTES)]);
    expect(state.device.submission).toBe("not-submitted");
    expect(state.world.missions["m01.final-submission"].status).toBe("failed");
    expect(state.persistent.submissionDeadlineMissed).toBe(true);
  });

  it("rejects tasks and device actions that cannot finish in the remaining time", () => {
    const initial = S.initial!;
    const limited = {
      ...S,
      initial: {
        resources: { ...initial.resources, timeMinutes: 4 },
        persistent: { ...initial.persistent },
      },
    };
    let state = chapterReducer(createInitialState(limited), START, limited).state;
    const taskResult = chapterReducer(state, task("draft.intro-review"), limited);
    expect(taskResult.accepted).toBe(false);
    expect(taskResult.reason).toBe("There is not enough time left to complete this action.");
    expect(taskResult.state.resources.timeMinutes).toBe(4);
    expect(taskResult.state.world.thesisTasksDone).not.toContain("draft.intro-review");

    const itemResult = chapterReducer(state, use("portal.saved", "check-account"), limited);
    expect(itemResult.accepted).toBe(false);
    expect(itemResult.reason).toBe("There is not enough time left to complete this action.");
    expect(itemResult.state.device.items["portal.saved"].done).not.toContain("check-account");
  });

  it("keeps a taken-over account locked on Friday morning until it is recovered, at a cost in time", () => {
    const base = run([START, ...FEE_PAGE, use("contact.bank", "call"), use("contact.bank", "report-fraud"), use("settings.security", "change-passwords")]);
    const friday = step(base, toMinute(base, MISSION_01_CONFIG.lateAccessCheckMinute));
    expect(selectPendingEvents(friday, S).map((event) => event.id)).toContain("m01.access-locked");
    const recovered = step(friday, { type: "RESPOND_EVENT", eventId: "m01.access-locked", response: "recover-now" });
    expect(recovered.persistent.accountCompromised).toBe(false);
    expect(friday.resources.timeMinutes - recovered.resources.timeMinutes).toBe(MISSION_01_CONFIG.lateRecoveryMinutes);
    expect(recovered.persistent.accountEverCompromised).toBe(true);
    // It never fires twice.
    const later = step(recovered, advance(500));
    expect(Object.keys(later.world.events).filter((id) => id === "m01.access-locked")).toHaveLength(1);
  });

  it("does not appear when the account was recovered in time", () => {
    const base = run([START, ...FEE_PAGE, use("contact.bank", "call"), use("contact.bank", "report-fraud"), use("settings.security", "change-passwords"), use("settings.security", "recover-access")]);
    const friday = step(base, toMinute(base, MISSION_01_CONFIG.lateAccessCheckMinute + 10));
    expect(Object.hasOwn(friday.world.events, "m01.access-locked")).toBe(false);
  });

  it("brings the unverified access back on Friday only when it was never verified", () => {
    const skipped = run([START]);
    const friday = step(skipped, toMinute(skipped, MISSION_01_CONFIG.lateAccessCheckMinute + 1));
    expect(Object.hasOwn(friday.world.events, "m01.late-access-check")).toBe(true);
    const verified = run([START, advance(10), use("contact.training-office", "call"), use("contact.training-office", "confirm-fee")]);
    const fridayVerified = step(verified, toMinute(verified, MISSION_01_CONFIG.lateAccessCheckMinute + 1));
    expect(Object.hasOwn(fridayVerified.world.events, "m01.late-access-check")).toBe(false);
  });
});

describe("skipping both optional missions", () => {
  it("leaves them open and harmless, forces nothing, and the chapter plays to the end with no repeat", () => {
    let state = run([START, ...DRAFT]);
    state = step(state, advance(MISSION_01_CONFIG.lateAccessCheckMinute + 10));
    expect(state.world.missions["m01.missing-access"].status).toBe("completed");
    expect(state.world.missions["m01.easy-money"].status).toBe("open");
    expect(state.world.missions["m01.golden-platform"].status).toBe("open");
    expect(state.resources.cash).toBe(2_500_000);
    expect(state.device.ledger).toEqual([]);
    expect(state.persistent).toMatchObject({ lostMoneyToScam: false, recoveryOfferEligible: false, easyMoneyJoined: false, goldenPlatformJoined: false, accountCompromised: false });
    // The only thing left to answer is the access question; time can run out with nothing stuck.
    const end = step(state, advance(CHAPTER_DURATION_MINUTES));
    expect(end.resources.timeMinutes).toBe(0);
    expect(end.status).toBe("playing");
  });

  it("never fires an event twice however time is cut", () => {
    let fine = run([START]);
    while (fine.resources.timeMinutes > 0) fine = step(fine, advance(Math.min(90, fine.resources.timeMinutes)));
    const coarse = run([START, advance(CHAPTER_DURATION_MINUTES)]);
    const fired = (state: ChapterState) => Object.fromEntries(Object.entries(state.world.events).map(([id, event]) => [id, event.firedAtMinute]));
    expect(fired(coarse)).toEqual(Object.fromEntries(Object.entries(fired(fine)).filter(([id]) => Object.hasOwn(coarse.world.events, id))));
    expect(state0Items(fine)).toEqual(state0Items(coarse));
  });
});

const state0Items = (state: ChapterState) => Object.keys(state.device.items).sort();

describe("save and continue", () => {
  it("restores the whole chaos run exactly, with the same events and no new ones", () => {
    const state = chaos();
    const restored = restoreProgress(JSON.parse(JSON.stringify(encodeProgress(state, null, "start"))), S);
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.state).toEqual(state);
    expect(Object.keys(restored.state.world.events)).toEqual(Object.keys(state.world.events));
    expect(restored.state.device.ledger).toEqual(state.device.ledger);
    // Time goes on after the reload without re-firing anything.
    const after = step(restored.state, advance(60));
    expect(after.device.ledger).toEqual(state.device.ledger);
  });

  it("still restores an action log recorded for the previous content version, without changing it", () => {
    // A log as the game saved it before the finance summary and the extra flags (content version -2).
    const log: CoreAction[] = [
      START,
      advance(10),
      use("mail.clearance", "open-link"),
      use("page.fee", "sign-in"),
      use("contact.training-office", "call"),
      use("contact.training-office", "confirm-fee"),
      task("draft.intro-review"),
      { type: "REST", mode: "nap" },
      advance(30),
    ];
    const state = run(log);
    const progress = JSON.parse(JSON.stringify(encodeProgress(state, null, "start")));
    expect(SAVE_CONTENT_VERSION).toBe("ch1-last-submission-2");
    const restored = restoreProgress(progress, S);
    expect(restored.ok && restored.state).toEqual(state);
    // The new flags have their default (false) in a restored old run, because the state is rebuilt from the log.
    expect(restored.ok && restored.state.persistent).toMatchObject({ bankReported: false, easyMoneyJoined: false, goldenPlatformJoined: false, draftFinished: false });
  });
});

describe("no soft lock", () => {
  it("every branch leaves at least one way to use the remaining time", () => {
    const branches: Record<string, ChapterState> = {
      "ignored everything": run([START]),
      "fooled and reported": run([START, ...FEE_PAGE, use("contact.bank", "call"), use("contact.bank", "report-fraud")]),
      "fooled and silent": run([START, ...FEE_PAGE, advance(500)]),
      "verified": run([START, advance(10), use("contact.training-office", "call"), use("contact.training-office", "confirm-fee")]),
      "all the platforms": chaos(),
    };
    for (const [name, state] of Object.entries(branches)) {
      const work = chapterReducer(state, { type: "WORK_ON_THESIS", minutes: 180 }, S);
      const rest = chapterReducer(state, { type: "REST", mode: "nap" }, S);
      expect(work.accepted || rest.accepted, name).toBe(true);
      expect(state.status, name).toBe("playing");
    }
  });

  it("the main goal can still be reached with no money left", () => {
    const state = chaos();
    const broke: ChapterState = { ...state, resources: { ...state.resources, cash: 0 } };
    const done = run(DRAFT.filter((action) => !state.world.thesisTasksDone.includes((action as { taskId: string }).taskId)), broke);
    expect(done.persistent.draftFinished).toBe(true);
  });
});
