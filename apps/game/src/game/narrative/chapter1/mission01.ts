// Mission 01 "THE MISSING ACCESS" of "LAST SUBMISSION: 72 GIỜ CUỐI" (Tuesday, 17:00).
// Pure TypeScript data. The goal: finish the thesis draft and confirm access to the submission
// system. An email in the name of the university asks for an unannounced "international student
// confirmation fee". Three ways to play it, from the design brief:
//   A. Speed: follow the link. Opening the page costs nothing. Entering the student login can expose it
//      and opens the SECURITY BREACH sub-mission. Going on to pay and give the verification code
//      leads to unauthorized transfers until the player reports to the bank on its official line.
//   B. Verification: check the account through the saved portal; this alone confirms access. The
//      Training Office can also corroborate the fee in a multi-turn call and leave a written record.
//      These checks cost time; no money is lost.
//   C. Ignore the email and keep writing. No money is lost, the access stays unverified, and the
//      question comes back on Friday morning.
// Everything is simulated: no real login, card, code or URL is used, and addresses are plain text on
// reserved domains. Numbers the brief does not give are placeholders in `MISSION_01_CONFIG`.
//
// Timing rules (all enforced by the core, covered by tests):
//   - A scheduled consequence happens at its scheduled minute, even when a long action ends later,
//     and the bank ledger shows that minute.
//   - A step that stops a consequence only counts when it finished at or before that minute.
//   - Money that leaves without approval can only take the cash that is there, and never twice.
//   - Nothing gives money back: the bank can block and review, it never refunds in the game.
import { CHAPTER_DURATION_MINUTES, minutesFromStart, type PersistentFlagId } from "../resources";
import type { Condition, DeviceItemDef, GameEventDef, MissionDef, MissionStepDef, ThesisTaskDef } from "../types";

/**
 * Every number of Mission 01 that the brief does not state is a placeholder, and all of them live
 * here. Change them here, not in the data below. Times are simulated minutes, money is VND.
 */
export const MISSION_01_CONFIG = {
  /** The amount the fake email asks for. */
  clearanceFeeVnd: 800_000,
  /**
   * The one-time code the bank texts after the card payment on the fake page. Fictional; the player
   * reads it on the phone and types it on the page, like the real thing.
   */
  paymentCode: "481206",
  /**
   * Unauthorized transfers after the verification code was given: minutes after the code was
   * entered, and the amount. A transfer can only take the cash that is there.
   */
  unauthorizedTransfers: [
    { afterMinutes: 20, amountVnd: 300_000 },
    { afterMinutes: 45, amountVnd: 500_000 },
    { afterMinutes: 90, amountVnd: 700_000 },
  ],
  /** Minutes after the student login was entered at which the account is taken over, if not secured. */
  takeoverAfterMinutes: 60,
  /** Minutes after the student login was entered at which the sign-in alert mail arrives. */
  loginAlertAfterMinutes: 10,
  /** The internal deadline of the draft: Wednesday 06:00. */
  draftDeadlineMinute: minutesFromStart(3, 6, 0),
  /** Time lost when the draft misses that deadline and Alex works through the night. */
  overnightWorkMinutes: 180,
  /** Fatigue added by that night of work. */
  overnightFatigue: 25,
  /** Friday morning: the unverified access comes back. */
  lateAccessCheckMinute: minutesFromStart(5, 9, 0),
  /** Time the late check takes (the office is busy near the deadline). */
  lateAccessCheckMinutes: 90,
  /** Friday morning: an account that was taken over and never recovered still blocks the submission system. */
  lateRecoveryMinutes: 120,
  /** Simulated minutes of each device action. */
  minutes: {
    openLink: 3,
    closePage: 1,
    signIn: 2,
    payCard: 3,
    enterCode: 1,
    checkPortal: 15,
    officeCall: 10,
    officeDescribe: 20,
    officeAsk: 10,
    changePasswords: 20,
    recoverAccess: 60,
    bankCall: 5,
    submitThesis: 5,
    bankReport: 15,
    bankNext: 5,
    /** Saving a record of the email, the page address or a bank transaction as evidence. */
    saveRecord: 3,
  },
  /** Change of Digital Security by each step. */
  security: {
    signIn: -20,
    enterCode: -30,
    transfer: -5,
    takeover: -20,
    changePasswords: 15,
    bankReport: 10,
    breachResolved: 10,
  },
  /** Change of Support Network when the Training Office helps. */
  officeSupport: 5,
} as const;

const M = MISSION_01_CONFIG.minutes;
const SEC = MISSION_01_CONFIG.security;
const FEE = "800,000";

const done = (itemId: string, actionId: string): Condition => ({ kind: "itemActionDone", itemId, actionId });
const flag = (name: PersistentFlagId, value = true): Condition => ({ kind: "persistent", flag: name, value });

const CODE_GIVEN = flag("verificationCodeExposed");
const CREDENTIALS_GIVEN = flag("loginCredentialsExposed");

export const MISSION_01_THESIS_TASKS: ThesisTaskDef[] = [
  {
    id: "draft.intro-review",
    label: "Edit the introduction and literature review",
    description: "Tighten the argument and check whether each citation supports it.",
    timeCostMinutes: 90,
    progressGain: 2,
    effects: [{ kind: "setPersistent", flag: "draftSourcesChecked", value: true }],
    approaches: [
      { id: "qualify", label: "Keep the claim, but qualify the wording", description: "Preserve the idea while making the evidence boundary clear.", timeCostMinutes: 90, progressGain: 2 },
      { id: "swap-source", label: "Swap in the stronger source", description: "Add a better comparison, but leave less time for the final pass.", timeCostMinutes: 120, progressGain: 3 },
      { id: "rewrite", label: "Rewrite the claim around the evidence", description: "Use the safest wording, with a smaller conclusion.", timeCostMinutes: 60, progressGain: 1 },
    ],
  },
  {
    id: "draft.findings",
    label: "Revise the findings section",
    description: "Reconcile the interview notes with every figure before you keep the claim.",
    timeCostMinutes: 90,
    progressGain: 2,
    effects: [{ kind: "setPersistent", flag: "findingsReconciled", value: true }],
    approaches: [
      { id: "fix-chart", label: "Fix the chart to six", description: "Preserve the source record and correct the visible figure.", timeCostMinutes: 60, progressGain: 2 },
      { id: "fix-conclusion", label: "Fix the conclusion to six", description: "Keep the chart for a later source check.", timeCostMinutes: 45, progressGain: 1 },
      { id: "mark-check", label: "Keep both and mark for checking", description: "The fastest path, but the warning remains visible.", timeCostMinutes: 30, progressGain: 1 },
      { id: "delete-claim", label: "Remove the over-strong claim", description: "Reduce risk, but weaken the section.", timeCostMinutes: 75, progressGain: 2 },
    ],
  },
  {
    id: "draft.final",
    label: "Finish the full draft",
    description: "Run the final review and mark the draft ready for your supervisor.",
    requires: [{ kind: "thesisTaskDone", taskId: "draft.intro-review" }, { kind: "thesisTaskDone", taskId: "draft.findings" }],
    timeCostMinutes: 60,
    progressGain: 3,
    effects: [
      { kind: "setPersistent", flag: "finalDraftReviewed", value: true },
      { kind: "setPersistent", flag: "supervisorFeedbackRequested", value: true },
      { kind: "setPersistent", flag: "draftFinished", value: true },
    ],
    approaches: [
      { id: "quick-scan", label: "Quick scan", description: "Catch the obvious warnings.", timeCostMinutes: 30, progressGain: 1 },
      { id: "full-review", label: "Full review", description: "Check every item and mark the draft reviewed.", timeCostMinutes: 90, progressGain: 3 },
      { id: "ask-supervisor", label: "Ask the supervisor for feedback", description: "Create a feedback request before submission.", timeCostMinutes: 45, progressGain: 2 },
    ],
  },
];

export const MISSION_01_LEDGER_LABELS: Record<string, string> = {
  "ledger.clearance-fee": "Student confirmation fee (payment page)",
  "ledger.unauthorized-1": "Transfer to an unknown recipient",
  "ledger.unauthorized-2": "Transfer to an unknown recipient",
  "ledger.unauthorized-3": "Transfer to an unknown recipient",
};

/** The bank's one-time code text (English); the code itself is `MISSION_01_CONFIG.paymentCode`. */
const MISSION_01_CODE_TEXT = `${MISSION_01_CONFIG.paymentCode} is your code to approve a card payment of ${FEE} VND to UNI GRADUATION OFFICE. Never share this code with anyone. The bank will never ask you for it.`;
/** Each alert names the amount that moved, as a bank notification would, and points to an official contact route. */
const transferAlert = (amountVnd: number): string =>
  `A transfer of ${amountVnd.toLocaleString("en-US")} VND to an unfamiliar recipient was completed. If this wasn't you, call the number on your bank card.`;

export const MISSION_01_DEVICE_ITEMS: DeviceItemDef[] = [
  // --- The email and the page it leads to ---------------------------------------------------------
  {
    id: "mail.clearance",
    app: "mail",
    folder: "university",
    title: "Graduation Clearance — Action Required",
    from: "Graduation Office <clearance@payment-ueh.vn>",
    body:
      "Dear student,\n\nYour thesis submission account has been locked because the international student confirmation fee has not been paid.\n\n" +
      `Fee: ${FEE} VND\nDeadline: today\n\n` +
      "Pay now to unlock your account: https://payment-ueh.vn/confirm\n\n" +
      "If the fee is not paid today, your account will stay locked and you may miss the graduation period.\n\nGraduation Office",
    arrives: { atMinute: 10 },
    thesisInterruption: { urgent: true, appHint: "email" },
    actions: [
      { id: "open-link", label: "Open the payment link", timeCostMinutes: M.openLink, once: true },
      // Reporting is a choice, never a side effect of opening the mail. The report keeps a copy of the
      // email, the sender and the link address (the "evidence" of this mission).
      {
        id: "save-record",
        label: "Report to the IT help desk",
        timeCostMinutes: M.saveRecord,
        once: true,
        effects: [{ kind: "adjustResource", resource: "evidence", delta: 1 }],
      },
      {
        // Revising the findings turns Alex's research into an action in the live situation: compare
        // the claim through the portal he already saved. It reveals a result, never a verdict label.
        id: "compare-fee-with-saved-portal",
        label: "Compare this fee with the services page in the saved student portal",
        visibleWhen: [flag("researchSavedChannelIncluded"), flag("schoolFeeClaimContradicted", false)],
        timeCostMinutes: 5,
        once: true,
        effects: [
          { kind: "setPersistent", flag: "schoolFeeClaimContradicted", value: true },
          { kind: "adjustResource", resource: "evidence", delta: 1 },
          { kind: "deliverItem", itemId: "file.fee-comparison" },
        ],

      },
    ],
  },
  {
    id: "page.fee",
    app: "mail",
    folder: "other",
    title: "Payment page: student confirmation fee",
    from: "Payment page",
    detail: "payment-ueh.vn",
    body:
      `Student confirmation fee: ${FEE} VND.\nSign in with your student account to continue.\n\n` +
      "This page is a simulation. No real login, card or code is used in this game.",
    arrives: { when: [done("mail.clearance", "open-link")] },
    actions: [
      { id: "close", label: "Close the page", timeCostMinutes: M.closePage },
      {
        id: "save-address",
        label: "Report this site",
        timeCostMinutes: M.saveRecord,
        once: true,
        effects: [{ kind: "adjustResource", resource: "evidence", delta: 1 }],
      },
      {
        id: "sign-in",
        label: "Sign in with my student login",
        timeCostMinutes: M.signIn,
        once: true,
        effects: [
          { kind: "setPersistent", flag: "loginCredentialsExposed", value: true },
          { kind: "adjustResource", resource: "digitalSecurity", delta: SEC.signIn },
        ],
      },
      {
        id: "pay-card",
        label: "Pay the fee by card",
        visibleWhen: [done("page.fee", "sign-in")],
        timeCostMinutes: M.payCard,
        once: true,
      },
      // As with a real card payment, the money leaves only when the bank's code is entered.
      {
        id: "enter-code",
        label: "Enter the verification code from my phone",
        visibleWhen: [done("page.fee", "pay-card")],
        timeCostMinutes: M.enterCode,
        cashCost: MISSION_01_CONFIG.clearanceFeeVnd,
        ledgerLabel: "ledger.clearance-fee",
        ledgerCategory: "loss",
        counterparty: "Payment page",
        once: true,
        effects: [
          { kind: "setPersistent", flag: "verificationCodeExposed", value: true },
          { kind: "setPersistent", flag: "accountCompromised", value: true },
          { kind: "setPersistent", flag: "accountEverCompromised", value: true },
          { kind: "adjustResource", resource: "digitalSecurity", delta: SEC.enterCode },
        ],
      },
    ],
  },

  // --- Way B: the saved portal and the Training Office ---------------------------------------------
  {
    id: "portal.saved",
    app: "files",
    folder: "bookmarks",
    title: "Student portal (saved)",
    detail: "student.ueh.edu.vn",
    body: "The bookmark you saved for the submission portal when you registered.",
    actions: [
      {
        id: "check-account",
        label: "Sign in to the saved portal and check my account",
        timeCostMinutes: M.checkPortal,
        once: true,
        effects: [{ kind: "setPersistent", flag: "schoolAccessVerified", value: true }],
      },
      {
        id: "submit-thesis",
        label: "Submit the final thesis and save the receipt",
        requires: [
          { kind: "thesisTaskDone", taskId: "draft.intro-review" },
          { kind: "thesisTaskDone", taskId: "draft.findings" },
          { kind: "thesisTaskDone", taskId: "draft.final" },
          flag("schoolAccessVerified"),
          flag("accountCompromised", false),
        ],
        timeCostMinutes: M.submitThesis,
        once: true,
        effects: [{ kind: "setSubmission", status: "submitted" }],
      },
    ],
  },
  {
    id: "file.portal-status",
    app: "files",
    folder: "portal",
    title: "Portal status (saved)",
    body: "Thesis submission account: active.\nOutstanding fees: none.",
    arrives: { when: [done("portal.saved", "check-account")] },
  },
  {
    id: "file.fee-comparison",
    app: "files",
    folder: "portal",
    title: "Fee address comparison",
    body: "The saved student portal lists payment at payment.ueh.edu.vn. The email asks for payment at payment-ueh.vn. The domains do not match; this comparison does not confirm the account status.",
  },
  {
    id: "contact.training-office",
    app: "contacts",
    title: "Training Office (official contact)",
    detail: "+000 100 0200",
    body: "The office number saved in your phone from the student handbook.",
    actions: [
      {
        id: "call",
        label: "Call the Training Office",
        timeCostMinutes: M.officeCall,
        once: true,
        transcript: [
          { speaker: "other", text: "Training Office, good afternoon. How can I help you?" },
          { speaker: "alex", text: "Hello, this is Alex, a final-year international student. I am calling the number from my student handbook." },
        ],
      },
      {
        id: "confirm-fee",
        label: "Describe the email and ask if the fee is real",
        visibleWhen: [done("contact.training-office", "call")],
        timeCostMinutes: M.officeDescribe,
        once: true,
        transcript: [
          {
            speaker: "alex",
            text: `I received an email that says my submission account is locked until I pay a confirmation fee of ${FEE} VND today. Is this fee real?`,
          },
          {
            speaker: "other",
            text: "No. We have no such fee for thesis submission. Please do not use that link. Do not give anyone your login or a verification code. We never ask for them.",
          },
        ],
        effects: [
          { kind: "setPersistent", flag: "schoolAccessVerified", value: true },
          { kind: "adjustResource", resource: "evidence", delta: 1 },
          { kind: "adjustResource", resource: "supportNetwork", delta: MISSION_01_CONFIG.officeSupport },
        ],
      },
      {
        id: "ask-account",
        label: "Ask them to confirm my submission account is active",
        visibleWhen: [done("contact.training-office", "confirm-fee")],
        timeCostMinutes: M.officeAsk,
        once: true,
        transcript: [
          { speaker: "alex", text: "Can you also confirm that my submission account is active and that I owe nothing?" },
          { speaker: "other", text: "Yes. Your account is active and you owe nothing. We will send you a short written reply so that you have it on record." },
        ],
      },
    ],
  },
  {
    id: "mail.office-reply",
    app: "mail",
    folder: "university",
    title: "Re: Question about a confirmation fee",
    from: "Training Office <training@ueh.edu.vn>",
    body:
      "Hello,\n\nThere is no international student confirmation fee for thesis submission. Your submission account is active and nothing is owed.\n\n" +
      "Please write to us again if you receive other messages about fees.\n\nTraining Office",
    arrives: { when: [done("contact.training-office", "ask-account")] },
  },
  {
    id: "file.office-confirmation",
    app: "files",
    folder: "evidence",
    title: "Training Office reply (saved)",
    body: "A saved copy of the Training Office reply: there is no confirmation fee and the submission account is active.",
    arrives: { when: [done("contact.training-office", "ask-account")] },
  },

  // --- SECURITY BREACH: what the player can do, and what arrives while time passes -----------------
  {
    id: "settings.security",
    app: "files",
    folder: "security",
    title: "Account security settings",
    body: "Change your passwords, sign out other devices and check the recovery options of your student email and your bank app.",
    actions: [
      {
        id: "change-passwords",
        label: "Change my passwords and sign out other devices",
        timeCostMinutes: M.changePasswords,
        once: true,
        effects: [{ kind: "adjustResource", resource: "digitalSecurity", delta: SEC.changePasswords }],
      },
      {
        id: "recover-access",
        label: "Recover access to my accounts",
        visibleWhen: [flag("accountCompromised")],
        requires: [done("settings.security", "change-passwords")],
        timeCostMinutes: M.recoverAccess,
        once: true,
        effects: [{ kind: "setPersistent", flag: "accountCompromised", value: false }],
      },
    ],
  },
  {
    id: "contact.bank",
    app: "contacts",
    title: "Bank support (official line)",
    detail: "+000 100 0100",
    body: "The number printed on the back of your bank card.",
    actions: [
      {
        id: "call",
        label: "Call the official line",
        visibleWhen: [{ kind: "anyOf", conditions: [CREDENTIALS_GIVEN, CODE_GIVEN] }],
        timeCostMinutes: M.bankCall,
        once: true,
        transcript: [
          { speaker: "other", text: "Bank support. For your safety, I will never ask for your password, your PIN or any verification code." },
          { speaker: "alex", text: "Hello. I think someone has my login and may use my bank account. I want to report it." },
        ],
      },
      {
        id: "report-fraud",
        label: "Explain what happened and ask the bank to block transfers",
        visibleWhen: [done("contact.bank", "call")],
        timeCostMinutes: M.bankReport,
        once: true,
        transcript: [
          {
            speaker: "alex",
            text: "I entered my login on a payment page that was not the school's. Please check my account and stop any transfer I did not approve.",
          },
          {
            speaker: "other",
            text: "I have blocked outgoing transfers from your account and opened a review of the earlier ones. I cannot promise a refund. The review decides that.",
          },
        ],
        effects: [
          { kind: "adjustResource", resource: "evidence", delta: 1 },
          { kind: "adjustResource", resource: "digitalSecurity", delta: SEC.bankReport },
          { kind: "setPersistent", flag: "bankReported", value: true },
        ],
      },
      {
        id: "ask-next",
        label: "Ask what to do next",
        visibleWhen: [done("contact.bank", "report-fraud")],
        timeCostMinutes: M.bankNext,
        once: true,
        transcript: [
          { speaker: "alex", text: "What should I do now?" },
          {
            speaker: "other",
            text: "Change your passwords on every account that uses the same one, sign out other devices and keep your records. Do not call back any number from a message.",
          },
        ],
      },
    ],
  },
  {
    id: "file.bank-report",
    app: "files",
    folder: "evidence",
    title: "Bank report reference (saved)",
    body: "Reference: BR-0001. The bank blocked further transfers from your account and will review the earlier ones.",
    arrives: { when: [done("contact.bank", "report-fraud")] },
  },
  // --- Records the player can save from the bank statement and the other apps (never saved by looking) ---
  {
    id: "bank.statement",
    app: "files",
    folder: "bank",
    title: "Online bank statement",
    body: "Your online bank statement. You can download the receipt of a payment or a statement of transfers.",
    actions: [
      {
        id: "save-fee-record",
        label: "Download the receipt of the confirmation fee payment",
        visibleWhen: [done("page.fee", "enter-code")],
        timeCostMinutes: M.saveRecord,
        once: true,
        effects: [{ kind: "adjustResource", resource: "evidence", delta: 1 }],
      },
      {
        id: "save-transfer-record",
        label: "Download a statement of the unauthorized transfers",
        visibleWhen: [{ kind: "eventStatus", eventId: "m01.transfer-1", status: "resolved" }],
        timeCostMinutes: M.saveRecord,
        once: true,
        effects: [{ kind: "adjustResource", resource: "evidence", delta: 1 }],
      },
    ],
  },
  {
    id: "file.email-record",
    app: "files",
    folder: "evidence",
    title: "Report sent: Graduation Clearance email",
    body: "You reported the Graduation Clearance email to the university IT help desk. The report keeps a copy of the email: the sender address, the fee it asks for and the link address.",
    arrives: { when: [done("mail.clearance", "save-record")] },
  },
  {
    id: "file.address-record",
    app: "files",
    folder: "evidence",
    title: "Report sent: payment page address",
    body: "You reported the payment page to the university IT help desk. The report keeps the address that the email linked to: payment-ueh.vn.",
    arrives: { when: [done("page.fee", "save-address")] },
  },
  {
    id: "file.fee-record",
    app: "files",
    folder: "evidence",
    title: "Receipt: confirmation fee payment",
    body: "The downloaded receipt of the card payment made on the payment page: the amount, the time and the recipient shown by your bank.",
    arrives: { when: [done("bank.statement", "save-fee-record")] },
  },
  {
    id: "file.transfer-record",
    app: "files",
    folder: "evidence",
    title: "Statement: unauthorized transfers",
    body: "The downloaded statement of the transfers that left your account without your approval: the amounts, the times and the recipient shown by your bank.",
    arrives: { when: [done("bank.statement", "save-transfer-record")] },
  },
  {
    id: "mail.login-alert",
    app: "mail",
    folder: "university",
    title: "New sign-in to your student account",
    from: "Account Security <no-reply@ueh.edu.vn>",
    body: "A sign-in to your student account from a device we do not know was recorded. If this was not you, change your password.",
    arrives: { afterAction: { itemId: "page.fee", actionId: "sign-in", minutes: MISSION_01_CONFIG.loginAlertAfterMinutes } },
    thesisInterruption: { urgent: true, appHint: "email" },
  },
  // The bank's one-time code for the card payment on the page. The text says what the code approves
  // and that nobody should ask for it: the same words a real bank uses, and the lesson of this step.
  {
    id: "msg.bank-code",
    app: "messages",
    title: "Bank alerts",
    from: "Bank",
    body: `${MISSION_01_CODE_TEXT}`,
    arrives: { when: [done("page.fee", "pay-card")] },
    thesisInterruption: { urgent: true, appHint: "bank" },
  },
  ...([1, 2, 3] as const).map(
    (index): DeviceItemDef => ({
      id: `msg.bank-alert-${index}`,
      app: "messages",
      title: "Bank alerts",
      from: "Bank",
      body: transferAlert(MISSION_01_CONFIG.unauthorizedTransfers[index - 1].amountVnd),
      arrives: { when: [{ kind: "eventStatus", eventId: `m01.transfer-${index}`, status: "resolved" }] },
      thesisInterruption: { urgent: true, appHint: "bank" },
    }),
  ),

  // --- Ordinary life of Alex: normal notices that keep the world believable ------------------------
  {
    id: "msg.minh",
    app: "messages",
    title: "Minh",
    from: "Minh (thesis group)",
    body: "Did you finish the methods part? Send it to me when you can.",
  },
  {
    id: "mail.supervisor",
    app: "mail",
    folder: "university",
    title: "Draft feedback: please check the comments on chapter 3",
    from: "Supervisor <supervisor@ueh.edu.vn>",
    body: "Hello Alex,\n\nI added comments on chapter 3. Please review them when you finish the draft.\n\nBest regards",
  },
  {
    id: "mail.library",
    app: "mail",
    folder: "university",
    title: "Opening hours during the exam period",
    from: "University Library <library@ueh.edu.vn>",
    body: "The library opens one hour earlier and closes one hour later during the exam period.",
  },
  {
    id: "mail.print-shop",
    app: "mail",
    folder: "other",
    title: "Your print order is ready for pickup",
    from: "Print Shop <orders@inkhoaluan.vn>",
    body: "Your order is ready. The shop is open until 21:00.",
  },
  {
    id: "file.draft",
    app: "files",
    folder: "thesis",
    title: "thesis-draft.docx",
    body: "Your thesis draft. Edit it on the laptop, in the Thesis tab.",
  },

  // --- Appointments --------------------------------------------------------------------------------
  {
    id: "cal.draft-deadline",
    app: "calendar",
    title: "Internal deadline: finish the draft",
    body: "Finish the full draft before your supervisor reviews it. If it is not ready, you will have to work through the night.",
    startsAtMinute: MISSION_01_CONFIG.draftDeadlineMinute,
    endsAtMinute: MISSION_01_CONFIG.draftDeadlineMinute,
  },
  {
    id: "cal.interview",
    app: "calendar",
    title: "Interview with a study participant",
    detail: "District 5",
    body: "The appointment is confirmed for 11:30.",
    startsAtMinute: minutesFromStart(3, 11, 30),
    endsAtMinute: minutesFromStart(3, 12, 30),
  },
  {
    id: "cal.final-deadline",
    app: "calendar",
    title: "Final submission deadline",
    body: "Submit the final version of the thesis by 17:00.",
    startsAtMinute: minutesFromStart(5, 17, 0),
    endsAtMinute: minutesFromStart(5, 17, 0),
  },
];

/**
 * An unauthorized transfer. It happens `afterMinutes` after the code was entered, at exactly that
 * minute, unless the bank report finished at or before it. It takes at most the cash that is there,
 * and each transfer happens once (an event fires once).
 */
const transfer = (index: 1 | 2 | 3): GameEventDef => {
  const { afterMinutes, amountVnd } = MISSION_01_CONFIG.unauthorizedTransfers[index - 1];
  return {
    id: `m01.transfer-${index}`,
    title: "Unauthorized transfer",
    body: "A transfer left your account without your approval.",
    channel: "notification",
    autoResolve: true,
    optional: false,
    thesisInterruption: { urgent: true, appHint: "bank" },
    trigger: {
      afterAction: { itemId: "page.fee", actionId: "enter-code", minutes: afterMinutes },
      cancelledBy: [{ itemId: "contact.bank", actionId: "report-fraud" }],
    },
    onFire: [
      { kind: "recordTransaction", label: `ledger.unauthorized-${index}`, amount: -amountVnd, counterparty: "Unknown recipient", limitToCash: true, category: "loss" },
      { kind: "adjustResource", resource: "digitalSecurity", delta: SEC.transfer },
      { kind: "deliverItem", itemId: `msg.bank-alert-${index}` },
    ],
    responses: [],
  };
};

export const MISSION_01_EVENTS: GameEventDef[] = [
  transfer(1),
  transfer(2),
  transfer(3),
  {
    id: "m01.takeover",
    title: "Account takeover",
    body: "Someone used your student login from another device.",
    channel: "notification",
    autoResolve: true,
    optional: false,
    thesisInterruption: { urgent: true, appHint: "email" },
    trigger: {
      afterAction: { itemId: "page.fee", actionId: "sign-in", minutes: MISSION_01_CONFIG.takeoverAfterMinutes },
      // Changing the passwords in time stops it. Giving the code is a different path (the transfers).
      cancelledBy: [
        { itemId: "settings.security", actionId: "change-passwords" },
        { itemId: "page.fee", actionId: "enter-code" },
      ],
    },
    onFire: [
      { kind: "setPersistent", flag: "accountCompromised", value: true },
      { kind: "setPersistent", flag: "accountEverCompromised", value: true },
      { kind: "adjustResource", resource: "digitalSecurity", delta: SEC.takeover },
    ],
    responses: [],
  },
  {
    id: "m01.late-access-check",
    title: "Submission access is still unverified",
    body: "You never confirmed that your thesis submission account is active. The final deadline is today at 17:00.",
    channel: "notification",
    optional: false,
    thesisInterruption: { urgent: true, appHint: "email" },
    trigger: { atMinute: MISSION_01_CONFIG.lateAccessCheckMinute, when: [flag("schoolAccessVerified", false)] },
    responses: [
      {
        id: "verify-now",
        label: "Ask the Training Office to confirm my account now",
        kind: "respond",
        timeCostMinutes: MISSION_01_CONFIG.lateAccessCheckMinutes,
        effects: [
          { kind: "setPersistent", flag: "schoolAccessVerified", value: true },
          { kind: "adjustResource", resource: "evidence", delta: 1 },
        ],
      },
      { id: "later", label: "Not now", kind: "postpone" },
    ],
  },
];

/**
 * The compromise of the account reaches the submission: if it was never recovered, Friday morning the
 * student account still cannot sign in to the submission system. Recovering costs time then.
 */
export const MISSION_01_LATE_RECOVERY_EVENT: GameEventDef = {
  id: "m01.access-locked",
  title: "Your student account is still locked",
  body: "Your student account was taken over and never recovered, so you cannot sign in to the submission system. The final deadline is today at 17:00.",
  channel: "notification",
  optional: false,
  thesisInterruption: { urgent: true, appHint: "email" },
  trigger: { atMinute: MISSION_01_CONFIG.lateAccessCheckMinute, when: [flag("accountCompromised")] },
  responses: [
    {
      id: "recover-now",
      label: "Recover the student account now",
      kind: "respond",
      timeCostMinutes: MISSION_01_CONFIG.lateRecoveryMinutes,
      effects: [{ kind: "setPersistent", flag: "accountCompromised", value: false }],
    },
    { id: "later", label: "Not now", kind: "postpone" },
  ],
};

// --- Task steps (guidance in the task tracker and list; they never change state) -----------------
const draftStep = (id: string, taskId: string, label: string): MissionStepDef => ({
  id,
  label,
  target: "laptop",
  app: "thesis",
  doneWhen: [{ kind: "thesisTaskDone", taskId }],
});
const DRAFT_STEPS: MissionStepDef[] = [
  draftStep("intro", "draft.intro-review", "Edit the introduction and literature review"),
  draftStep("findings", "draft.findings", "Revise the findings section"),
  draftStep("final", "draft.final", "Finish the full draft"),
];
const READ_MAIL_STEP: MissionStepDef = {
  id: "read-mail",
  label: "Read the new email about your submission account",
  target: "laptop",
  app: "mail",
  visibleWhen: [{ kind: "itemArrived", itemId: "mail.clearance" }],
  doneWhen: [{ kind: "itemOpened", itemId: "mail.clearance" }],
};
/** Optional: ignoring the question is one of the three ways to play (it comes back on Friday). */
const CONFIRM_ACCESS_STEP: MissionStepDef = {
  id: "confirm-access",
  label: "Confirm that you can reach the submission system",
  visibleWhen: [{ kind: "itemOpened", itemId: "mail.clearance" }],
  doneWhen: [flag("schoolAccessVerified")],
  optional: true,
};
const PASSWORDS_STEP: MissionStepDef = {
  id: "passwords",
  label: "Change your passwords and sign out other devices",
  target: "laptop",
  app: "files",
  doneWhen: [done("settings.security", "change-passwords")],
};
const BANK_STEP: MissionStepDef = {
  id: "call-bank",
  label: "Call your bank on its official line",
  target: "phone",
  app: "contacts",
  doneWhen: [done("contact.bank", "report-fraud")],
};
const SUBMIT_THESIS_STEP: MissionStepDef = {
  id: "submit-thesis",
  label: "Submit the final thesis through the saved portal and keep the receipt",
  target: "laptop",
  app: "files",
  visibleWhen: [
    { kind: "thesisTaskDone", taskId: "draft.intro-review" },
    { kind: "thesisTaskDone", taskId: "draft.findings" },
    { kind: "thesisTaskDone", taskId: "draft.final" },
    flag("schoolAccessVerified"),
    flag("accountCompromised", false),
  ],
  doneWhen: [done("portal.saved", "submit-thesis")],
};

export const MISSION_01_MISSIONS: MissionDef[] = [
  {
    id: "m01.missing-access",
    title: "THE MISSING ACCESS",
    optional: false,
    opensWhen: { atMinute: 0 },
    deadlineAtMinute: MISSION_01_CONFIG.draftDeadlineMinute,
    completeWhen: [{ kind: "thesisTaskDone", taskId: "draft.final" }],
    onFail: [
      { kind: "setPersistent", flag: "overnightWork", value: true },
      { kind: "adjustResource", resource: "timeMinutes", delta: -MISSION_01_CONFIG.overnightWorkMinutes },
      { kind: "adjustResource", resource: "fatigue", delta: MISSION_01_CONFIG.overnightFatigue },
    ],
    paths: [
      {
        id: "breach",
        when: [CREDENTIALS_GIVEN, { kind: "missionStatus", missionId: "m01.security-breach", status: "open" }],
        objective: "Secure your accounts first. Finish the draft by Wednesday, 06:00; submit by Friday, 17:00.",
        steps: [PASSWORDS_STEP, ...DRAFT_STEPS],
      },
      {
        id: "verified",
        when: [flag("schoolAccessVerified")],
        objective: "Portal access is confirmed. Finish the draft by Wednesday, 06:00; submit by Friday, 17:00.",
        steps: [READ_MAIL_STEP, ...DRAFT_STEPS],
      },
      {
        id: "default",
        when: [],
        objective: "Finish the draft by Wednesday, 06:00, and confirm you can sign in to submit by Friday, 17:00.",
        steps: [READ_MAIL_STEP, CONFIRM_ACCESS_STEP, ...DRAFT_STEPS],
      },
    ],
  },
  {
    id: "m01.final-submission",
    title: "FINAL SUBMISSION",
    optional: false,
    opensWhen: { atMinute: 0 },
    deadlineAtMinute: CHAPTER_DURATION_MINUTES,
    completeWhen: [{ kind: "submission", status: "submitted" }],
    onFail: [{ kind: "setPersistent", flag: "submissionDeadlineMissed", value: true }],
    paths: [
      {
        id: "ready",
        when: [
          { kind: "thesisTaskDone", taskId: "draft.final" },
          flag("schoolAccessVerified"),
          flag("accountCompromised", false),
        ],
        objective: "Your final draft and account are ready. Submit through the saved portal by Friday, 17:00.",
        steps: [SUBMIT_THESIS_STEP],
      },
      {
        id: "blocked",
        when: [],
        objective: "Finish the draft, verify submission access and resolve any account lock before Friday, 17:00.",
        steps: [SUBMIT_THESIS_STEP],
      },
    ],
  },
  {
    id: "m01.security-breach",
    title: "SECURITY BREACH",
    optional: false,
    opensWhen: { when: [CREDENTIALS_GIVEN] },
    completeWhen: [
      done("settings.security", "change-passwords"),
      { kind: "anyOf", conditions: [flag("verificationCodeExposed", false), done("contact.bank", "report-fraud")] },
    ],
    onComplete: [{ kind: "adjustResource", resource: "digitalSecurity", delta: SEC.breachResolved }],
    paths: [
      {
        id: "code",
        when: [CODE_GIVEN],
        objective: "Report the transfers to your bank on its official line, then secure your accounts.",
        steps: [BANK_STEP, PASSWORDS_STEP],
      },
      {
        id: "credentials",
        when: [],
        objective: "Change your passwords and sign out other devices.",
        steps: [PASSWORDS_STEP],
      },
    ],
  },
];
