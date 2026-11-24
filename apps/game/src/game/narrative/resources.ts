// Chapter resources and persistent state for "LAST SUBMISSION: 72 GIỜ CUỐI".
// Pure TypeScript: no React, Three.js, R3F, Drei, Rapier, Zustand or Dexie imports.
//
// Source: the canonical design brief, section 3 "Resources and state". Values the brief states
// (72 hours, 60% thesis, 2,500,000 VND) are fixed here. Values the brief does not state (the start
// levels of Digital Security, Support Network and Evidence, and every limit) are marked
// CONFIGURABLE: they are placeholders that a scenario can override with `ScenarioDefinition.initial`.

/** The six resources of the chapter. Every decision can change one or more of them. */
export const RESOURCE_IDS = [
  /** Simulated time left until the deadline, in minutes. */
  "timeMinutes",
  /** Thesis progress, percent. */
  "thesisProgress",
  /** Cash, VND. May go below zero (debt). */
  "cash",
  /** Safety of email, bank, social accounts and devices. */
  "digitalSecurity",
  /** Relationships with Minh, the supervisor, the support office, friends and acquaintances. */
  "supportNetwork",
  /** Verified information that has value for a specific situation (not a screenshot count). */
  "evidence",
  /** Tiredness, 0 to 100. Slows thesis work. Rules and numbers: `fatigue.ts`. */
  "fatigue",
] as const;
export type ResourceId = (typeof RESOURCE_IDS)[number];
export type ChapterResources = Record<ResourceId, number>;

/**
 * Event-level state that stays after a mission ends (brief, section 3, last paragraph, and
 * section 6 "Persistent Consequence"). Booleans only; a mission reads them to adapt.
 */
export const PERSISTENT_FLAG_IDS = [
  /** An account (email, bank or other) was compromised. */
  "accountCompromised",
  /** A backup of the thesis data exists and can be used. */
  "backupSecured",
  /** Alex has a safe place to stay. */
  "safeHousing",
  /** Identity or residence documents were exposed. */
  "identityDocumentsExposed",
  /** A housing deposit was lost. */
  "housingDepositLost",
  /** Minh still trusts Alex (relationship flag). */
  "minhTrustsAlex",
  /** Alex confirmed with the Training Office that the submission account is active and no fee exists. */
  "schoolAccessVerified",
  /** Alex compared the suspicious fee against the saved portal's official services information. */
  "schoolFeeClaimContradicted",
  /** Alex entered his student login on a page that was not the school's. */
  "loginCredentialsExposed",
  /** Alex gave a verification code to that page. */
  "verificationCodeExposed",
  /** An account was compromised at some point, even if access was recovered later. */
  "accountEverCompromised",
  /** The draft missed its internal deadline and Alex works through the night. */
  "overnightWork",
  /** Money was sent to an online job or investment page. Read by Mission 03 (money and housing) and Mission 05. */
  "lostMoneyToScam",
  /** Alex paid at least one deposit to the online job platform. */
  "easyMoneyDeposited",
  /** Money is locked on the investment platform and cannot be withdrawn. */
  "investmentFundsLocked",
  /** Alex borrowed money to keep paying the online job platform. Read by Mission 03. */
  "debtFromScam",
  /** Alex saved the records of a platform (deposits, fee messages, the page address). */
  "scamEvidenceSaved",
  /** Alex lost money or has funds locked, so a recovery offer in Mission 05 can refer to that loss. */
  "recoveryOfferEligible",
  /** Alex reported to the bank on its official line, which blocked later transfers. */
  "bankReported",
  /** Alex started the online job tasks. */
  "easyMoneyJoined",
  /** Alex stopped the online job and closed the account. */
  "easyMoneyStopped",
  /** Alex invested on the investment platform. */
  "goldenPlatformJoined",
  /** Alex paid at least one fee that the investment platform asked for before a withdrawal. */
  "goldenFeesPaid",
  /** The full draft was finished (on time or late). */
  "draftFinished",
  /** The final submission mission reached Friday 17:00 without a submitted receipt. */
  "submissionDeadlineMissed",
  /** Alex included the interview finding about checking through a previously known channel in the thesis revision. */
  "researchSavedChannelIncluded",
  /** The introduction's claims and sources were checked (Mission 01 thesis desk). */
  "draftSourcesChecked",
  /** The findings section was reconciled against its source data (Mission 01 thesis desk). */
  "findingsReconciled",
  /** The final draft received a complete review (Mission 01 thesis desk). */
  "finalDraftReviewed",
  /** Alex asked the supervisor for feedback on the draft (Mission 01 thesis desk). */
  "supervisorFeedbackRequested",
  /** Alex checked the District 5 appointment through a previously known channel. */
  "rideVerifiedIndependently",
  /** Alex paid the unofficial driver outside a tracked ride service. */
  "ridePaidOffPlatform",
  /** The unofficial ride consumed enough time to affect the appointment. */
  "rideLostTime",
  /** Alex completed the District 5 thesis interview. */
  "interviewCompleted",
  /** The District 5 interview window passed without an interview. */
  "interviewMissed",
  /** Alex saved the ride offer and route details as evidence. */
  "rideEvidenceSaved",
  /** Alex shared the unofficial driver's contact with Minh. */
  "driverContactShared",
  /** Alex warned Minh about the unofficial ride. */
  "minhWarnedAboutRide",
] as const;
export type PersistentFlagId = (typeof PERSISTENT_FLAG_IDS)[number];
export type PersistentFlags = Record<PersistentFlagId, boolean>;

export interface ChapterInitialState {
  resources: ChapterResources;
  persistent: PersistentFlags;
}

/** 72 simulated hours, as minutes. */
export const CHAPTER_DURATION_MINUTES = 72 * 60;
/** Mission 01 starts on Tuesday at 17:00, exactly 72 hours before the Friday 17:00 deadline. */
export const CHAPTER_START = { isoWeekday: 2, hour: 17, minute: 0 } as const;
export const CHAPTER_DEADLINE = { isoWeekday: 5, hour: 17, minute: 0 } as const;

/** The protagonist, from the brief. Display names live in the locale files. */
export const CHAPTER_PROTAGONIST = {
  name: "Alex",
  age: 23,
  city: "Ho Chi Minh City",
  role: "international-final-year-student",
} as const;

/**
 * Start state of a new game. Stated by the brief: time, thesis progress, cash.
 * CONFIGURABLE (not stated by the brief): digitalSecurity, supportNetwork, evidence and the flags.
 * The flags start as "nothing has happened yet", and Minh trusts Alex because no event has
 * changed that (brief, mission 04 and 05 describe losing his trust through actions).
 */
export const CHAPTER_1_INITIAL_STATE: ChapterInitialState = {
  resources: {
    timeMinutes: CHAPTER_DURATION_MINUTES,
    thesisProgress: 60,
    cash: 2_500_000,
    digitalSecurity: 100,
    supportNetwork: 50,
    evidence: 0,
    fatigue: 20,
  },
  persistent: {
    accountCompromised: false,
    backupSecured: false,
    safeHousing: false,
    identityDocumentsExposed: false,
    housingDepositLost: false,
    minhTrustsAlex: true,
    schoolAccessVerified: false,
    schoolFeeClaimContradicted: false,
    loginCredentialsExposed: false,
    verificationCodeExposed: false,
    accountEverCompromised: false,
    overnightWork: false,
    lostMoneyToScam: false,
    easyMoneyDeposited: false,
    investmentFundsLocked: false,
    debtFromScam: false,
    scamEvidenceSaved: false,
    recoveryOfferEligible: false,
    bankReported: false,
    easyMoneyJoined: false,
    easyMoneyStopped: false,
    goldenPlatformJoined: false,
    goldenFeesPaid: false,
    draftFinished: false,
    submissionDeadlineMissed: false,
    researchSavedChannelIncluded: false,
    draftSourcesChecked: false,
    findingsReconciled: false,
    finalDraftReviewed: false,
    supervisorFeedbackRequested: false,
    rideVerifiedIndependently: false,
    ridePaidOffPlatform: false,
    rideLostTime: false,
    interviewCompleted: false,
    interviewMissed: false,
    rideEvidenceSaved: false,
    driverContactShared: false,
    minhWarnedAboutRide: false,
  },
};

/** Inclusive limits. `null` means no limit on that side (cash can go into debt). CONFIGURABLE. */
export const RESOURCE_LIMITS: Record<ResourceId, { min: number | null; max: number | null }> = {
  timeMinutes: { min: 0, max: CHAPTER_DURATION_MINUTES },
  thesisProgress: { min: 0, max: 100 },
  cash: { min: null, max: null },
  digitalSecurity: { min: 0, max: 100 },
  supportNetwork: { min: 0, max: 100 },
  evidence: { min: 0, max: null },
  fatigue: { min: 0, max: 100 },
};

export function isResourceId(value: unknown): value is ResourceId {
  return typeof value === "string" && (RESOURCE_IDS as readonly string[]).includes(value);
}

export function isPersistentFlagId(value: unknown): value is PersistentFlagId {
  return typeof value === "string" && (PERSISTENT_FLAG_IDS as readonly string[]).includes(value);
}

/** Clamps a resource value to its limits. Always returns a whole number. */
export function clampResource(id: ResourceId, value: number): number {
  const { min, max } = RESOURCE_LIMITS[id];
  let next = Math.round(value);
  if (min !== null && next < min) next = min;
  if (max !== null && next > max) next = max;
  return next;
}

/** Fresh copies, so a state never shares objects with the config. */
export function cloneInitialState(initial: ChapterInitialState): ChapterInitialState {
  return { resources: { ...initial.resources }, persistent: { ...initial.persistent } };
}

/**
 * Minutes since the chapter started for a day and time, for scheduling events and deadlines.
 * `minutesFromStart(2, 17, 0)` is 0 (Tuesday 17:00) and `minutesFromStart(5, 17, 0)` is 4320.
 */
export function minutesFromStart(isoWeekday: number, hour: number, minute = 0): number {
  const startOfDay = CHAPTER_START.hour * 60 + CHAPTER_START.minute;
  return (isoWeekday - CHAPTER_START.isoWeekday) * 1440 + hour * 60 + minute - startOfDay;
}

export interface SimulatedClock {
  /** ISO weekday: 1 Monday ... 7 Sunday. */
  isoWeekday: number;
  hour: number;
  minute: number;
  /** Whole hours left, rounded up. */
  hoursRemaining: number;
}

/** The simulated wall clock for a value of `timeMinutes`. Pure and total for any finite input. */
export function simulatedClock(timeMinutes: number): SimulatedClock {
  const remaining = clampResource("timeMinutes", timeMinutes);
  const elapsed = CHAPTER_DURATION_MINUTES - remaining;
  const startOfDay = CHAPTER_START.hour * 60 + CHAPTER_START.minute;
  const total = startOfDay + elapsed;
  const dayOffset = Math.floor(total / 1440);
  const minuteOfDay = total % 1440;
  return {
    isoWeekday: ((CHAPTER_START.isoWeekday - 1 + dayOffset) % 7) + 1,
    hour: Math.floor(minuteOfDay / 60),
    minute: minuteOfDay % 60,
    hoursRemaining: Math.ceil(remaining / 60),
  };
}
