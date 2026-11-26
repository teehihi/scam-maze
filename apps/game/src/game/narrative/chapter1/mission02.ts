// Mission 02 "THE RIDE": an independent-verification lesson around the District 5 interview.
// Pure scenario data. The 3D street and Bus 06 remain the physical transport layer; these records
// give the player the distributed facts needed to decide how to travel and to confirm the
// appointment through a channel they already had.
//
// Timing model (all deterministic, all in simulated minutes since Tuesday 17:00):
//   - The appointment is on the calendar from the start of the chapter.
//   - The mission opens Wednesday 11:00, the hour before the 11:30 appointment, so the ride
//     decision appears when it matters rather than days early.
//   - Both trips reach the market office inside the 11:30-12:30 window: the tracked bus takes 34
//     minutes, the unregistered ride takes 58 minutes and ends three blocks short (22 minutes on
//     foot, or 14 minutes and 30,000 VND more to be taken around).
//   - At 12:30 an event closes the window. It only marks the interview as missed when it was not
//     completed, so a slow morning has a consequence without taking the choice away.
// No verdict is attached to an offer; the player reads the costs and decides.
import { minutesFromStart, type PersistentFlagId } from "../resources";
import type { Condition, DeviceItemDef, GameEventDef, MissionDef, MissionStepDef } from "../types";

export const MISSION_02_CONFIG = {
  /** Wednesday 11:00: the mission opens, one hour before the appointment. */
  opensAtMinute: minutesFromStart(3, 11, 0),
  /** Wednesday 11:00: travel to District 5 is possible (the same minute the mission opens). */
  travelFromMinute: minutesFromStart(3, 11, 0),
  /** Wednesday 11:30: the appointment starts. */
  interviewStartMinute: minutesFromStart(3, 11, 30),
  /** Wednesday 12:30: the appointment window closes. */
  interviewEndMinute: minutesFromStart(3, 12, 30),
  /** Wednesday 14:00: the mission fails if the morning never resolved. */
  missionDeadlineMinute: minutesFromStart(3, 14, 0),
  /** The fare of the tracked Bus 06 trip, paid at the validator. */
  busFareVnd: 7_000,
  /** The fare the unregistered driver asks for in cash. */
  unofficialFareVnd: 60_000,
  /** The extra money the driver asks for when he stops at the wrong corner. */
  wrongStopExtraVnd: 30_000,
  busRideMinutes: 34,
  unofficialRideMinutes: 58,
  minutes: {
    askDriver: 3,
    saveOffer: 3,
    saveRoute: 2,
    confirmAppointment: 8,
    saveContact: 1,
    walkFromWrongStop: 22,
    payExtraRide: 14,
  },
} as const;

const M = MISSION_02_CONFIG.minutes;
const persistent = (flag: PersistentFlagId, value = true): Condition => ({ kind: "persistent", flag, value });
const done = (itemId: string, actionId: string): Condition => ({ kind: "itemActionDone", itemId, actionId });
const travelAllowed = { kind: "elapsedAtLeast", minutes: MISSION_02_CONFIG.travelFromMinute } as const;

export const MISSION_02_LEDGER_LABELS: Record<string, string> = {
  "ledger.bus06-fare": "Bus 06 fare",
  "ledger.unofficial-ride": "Cash ride paid at the bus stop",
  "ledger.unofficial-extra": "Extra cash asked for at a stop that was not the meeting point",
};

/** The thesis task whose completion makes Minh call (the draft of Mission 01). */
const DRAFT_DONE: Condition = { kind: "thesisTaskDone", taskId: "draft.final" };
const MINH_CALLED = done("contact.minh", "call");
const MINH_DECLINED = done("contact.minh", "decline");

export const MISSION_02_DEVICE_ITEMS: DeviceItemDef[] = [
  // --- The bridge from Mission 01: Minh calls once the draft is done ---------------------------
  // No "mission complete" screen: the draft is saved, the phone rings, and Minh reminds Alex of the
  // last interview. Answering, calling back or declining all leave the same reminder (the call, or
  // his message), so nothing is lost by not picking up.
  {
    id: "contact.minh",
    app: "contacts",
    title: "Minh",
    detail: "+000 200 0101",
    body: "Minh, from the thesis group.",
    arrives: { when: [DRAFT_DONE] },
    incomingCall: true,
    actions: [
      {
        id: "call",
        label: "Talk to Minh",
        timeCostMinutes: 2,
        once: true,
        transcript: [
          {
            speaker: "other",
            voiceId: "m02.minh.setup",
            text: "Chapter 3 finally looks solid! Don't forget our final District 5 interview at 11:30 tomorrow — Cô Ba hates waiting.",
          },
        ],
      },
      {
        id: "ask-section",
        label: "What should I ask Cô Ba?",
        visibleWhen: [MINH_CALLED],
        timeCostMinutes: 1,
        once: true,
        // The same lines as the street conversation, so they share their recordings.
        transcript: [
          { speaker: "alex", voiceId: "m02.minh.minh_m02_coba.alex", text: "What should I ask Cô Ba?" },
          {
            speaker: "other",
            voiceId: "m02.minh.minh_m02_coba",
            text: "Just verify how small shopkeepers spot fake transfer receipts. One clean quote wraps up Section 3.3 completely.",
          },
        ],
      },
      {
        id: "decline",
        label: "Decline the call",
        visibleWhen: [{ kind: "not", condition: MINH_CALLED }],
        once: true,
      },
    ],
  },
  {
    id: "msg.m02-minh-reminder",
    app: "messages",
    title: "Minh",
    from: "Minh (thesis group)",
    body: "Chapter 3 finally looks solid! Don't forget our final District 5 interview at 11:30 tomorrow — Cô Ba hates waiting. Ask her how small shopkeepers spot fake transfer receipts: that is what Section 3.3 still needs.",
    arrives: { when: [MINH_DECLINED] },
  },
  {
    id: "file.m02-section-3-3",
    app: "files",
    folder: "thesis",
    title: "Section 3.3 — data still missing",
    body:
      "Section 3.3 needs first-hand data: how small shopkeepers recognise a fake transfer receipt before they hand over goods. Source: the interview with Cô Ba, Wednesday 11:30, at the Chợ Lớn market (District 5).",
    arrives: { when: [{ kind: "anyOf", conditions: [MINH_CALLED, MINH_DECLINED] }] },
  },

  // --- The appointment and the two ways to reach it ----------------------------------------------
  {
    id: "cal.m02-interview",
    app: "calendar",
    title: "Interview with Cô Ba",
    detail: "District 5 · Chợ Lớn market office",
    body:
      "The last thesis interview: how small shopkeepers check a transfer before handing over goods. The appointment is for 11:30; the meeting point is the market office's main entrance.",
    startsAtMinute: MISSION_02_CONFIG.interviewStartMinute,
    endsAtMinute: MISSION_02_CONFIG.interviewEndMinute,
  },
  {
    id: "map.bus06-stop",
    app: "map",
    title: "Bus 06 stop — Lý Thái Tổ",
    detail: "Route 06 · toward Chợ Lớn",
    body:
      "The stop by the shophouses. The route board shows the fare and the stops; the driver of the parked Super Cub beside the shelter offers a ride of his own.",
    actions: [
      {
        id: "ask-driver",
        label: "Ask the driver beside the shelter about his fare",
        timeCostMinutes: M.askDriver,
        once: true,
        effects: [
          { kind: "deliverItem", itemId: "msg.m02-driver-offer" },
          { kind: "deliverItem", itemId: "contact.driver" },
        ],
      },
      {
        id: "read-board",
        label: "Read the route board and note the fare",
        timeCostMinutes: M.saveRoute,
        once: true,
        effects: [
          { kind: "adjustResource", resource: "evidence", delta: 1 },
          { kind: "deliverItem", itemId: "map.bus06-route" },
        ],
      },
    ],
  },
  {
    id: "map.bus06-route",
    app: "map",
    title: "Bus 06 route and fare",
    detail: "Route 06 · Lý Thái Tổ → Châu Văn Liêm → Chợ Lớn",
    body:
      "The printed route: three stops, a 7,000 VND fare paid at the validator, and an arrival near the District 5 market. The trip is logged by the route.",
    arrives: { when: [done("map.bus06-stop", "read-board")] },
  },
  {
    id: "msg.m02-driver-offer",
    app: "messages",
    title: "Street Driver",
    from: "Street Driver",
    body:
      "District 5? 60,000 cash and I leave now — no waiting for Bus 06. I know the back streets past Nguyễn Tri Phương. I'll stop wherever you say.",
    arrives: { when: [done("map.bus06-stop", "ask-driver")] },
    actions: [
      {
        id: "save-offer",
        label: "Save the offer and the fare he quoted",
        timeCostMinutes: M.saveOffer,
        once: true,
        effects: [
          { kind: "setPersistent", flag: "rideEvidenceSaved", value: true },
          { kind: "adjustResource", resource: "evidence", delta: 1 },
          { kind: "deliverItem", itemId: "file.m02-ride-record" },
        ],
      },
    ],
  },
  {
    id: "file.m02-ride-record",
    app: "files",
    folder: "evidence",
    title: "Ride offer record (saved)",
    body:
      "Saved details of the ride offered at the stop: a cash fare, no trip record, no verified driver identity and no destination confirmation.",
    arrives: { when: [done("msg.m02-driver-offer", "save-offer")] },
  },
  {
    id: "contact.driver",
    app: "contacts",
    title: "Street Driver",
    detail: "+000 200 0600",
    body: "The number the driver gave at the stop. It is not linked to any trip record.",
    arrives: { when: [done("map.bus06-stop", "ask-driver")] },
    actions: [
      {
        id: "save-number",
        label: "Save the number in my contacts",
        timeCostMinutes: M.saveContact,
        once: true,
        effects: [{ kind: "setPersistent", flag: "driverContactShared", value: true }],
      },
    ],
  },
  {
    id: "contact.coba",
    app: "contacts",
    title: "Cô Ba — thesis interview",
    detail: "+000 200 0505",
    body: "The number written in the interview notes. It was in the phone before any ride was offered.",
    actions: [
      {
        id: "confirm",
        label: "Call and confirm the appointment and the meeting point",
        timeCostMinutes: M.confirmAppointment,
        once: true,
        transcript: [
          {
            speaker: "alex",
            voiceId: "m02.coba.confirm.0",
            text: "Hello, this is Alex. I am calling the number in my interview notes about the 11:30 appointment.",
          },
          {
            speaker: "other",
            voiceId: "m02.coba.confirm.1",
            text: "Yes, I am expecting you at the market office. Come to the main entrance on the market side, not the alley. Call me if the traffic holds you up.",
          },
        ],
        effects: [
          { kind: "setPersistent", flag: "rideVerifiedIndependently", value: true },
          { kind: "adjustResource", resource: "evidence", delta: 1 },
          { kind: "adjustResource", resource: "supportNetwork", delta: 2 },
        ],
      },
    ],
  },

  // --- The two trips ------------------------------------------------------------------------------
  // The ride is two steps because the street runs it: the validator records the fare when the player
  // taps it on the bus, and stepping off only records arrival. The interview is complete only after
  // the player physically talks to Cô Ba and asks a question. The world's own clock carries the
  // 34 minutes while the bus drives, so neither step charges that time again.
  // Without the 3D street (a browser that cannot start it) both steps stay on the phone.
  {
    id: "travel.bus06",
    app: "map",
    title: "Take Bus 06",
    detail: "Lý Thái Tổ → Chợ Lớn · 34 minutes",
    body: "Board at the stop and pay the fare at the validator. The route ends near the District 5 market.",
    actions: [
      {
        id: "pay-fare",
        label: "Pay the Bus 06 fare at the validator",
        requires: [travelAllowed],
        cashCost: MISSION_02_CONFIG.busFareVnd,
        ledgerLabel: "ledger.bus06-fare",
        counterparty: "Bus 06",
        once: true,
      },
      {
        id: "arrive",
        label: "Step off at Chợ Lớn and go up to the market office",
        requires: [travelAllowed, done("travel.bus06", "pay-fare")],
        // Phone-only fallback simulates the same physical trip; the street bridge can replace this
        // action with its arrival event when the player is actually on Bus 06. Stepping off only
        // records arrival: the interview itself happens face to face with Cô Ba.
        timeCostMinutes: MISSION_02_CONFIG.busRideMinutes,
        once: true,
        moveTo: "district5",
        effects: [{ kind: "setPersistent", flag: "interviewArrived", value: true }],
      },
    ],
  },
  {
    id: "interview.coba",
    app: "files",
    folder: "interview",
    title: "Cô Ba — Chợ Lớn interview",
    body:
      "The market office is at the main entrance. Cô Ba is waiting there for the thesis interview; arriving at the district is not the same as completing the interview.",
    arrives: { when: [persistent("interviewArrived")] },
    actions: [
      {
        id: "start",
        label: "Meet Cô Ba at the market office entrance",
        requires: [
          { kind: "atLocation", placeId: "district5" },
          persistent("interviewArrived"),
          persistent("interviewStarted", false),
          persistent("interviewCompleted", false),
          persistent("interviewMissed", false),
          persistent("interviewRescheduled", false),
        ],
        timeCostMinutes: 1,
        once: true,
        effects: [{ kind: "setPersistent", flag: "interviewStarted", value: true }],
      },
      {
        id: "reschedule",
        label: "Ask Cô Ba to reschedule after arriving late",
        visibleWhen: [persistent("interviewMissed"), { kind: "not", condition: persistent("interviewRescheduled") }],
        requires: [
          { kind: "atLocation", placeId: "district5" },
          persistent("interviewArrived"),
          persistent("interviewMissed"),
          persistent("interviewStarted", false),
          persistent("interviewCompleted", false),
        ],
        timeCostMinutes: 2,
        once: true,
        effects: [
          { kind: "setPersistent", flag: "interviewRescheduled", value: true },
          { kind: "setPersistent", flag: "interviewMissed", value: false },
        ],
      },
      {
        id: "decline-reschedule",
        label: "Leave without rescheduling the interview",
        visibleWhen: [persistent("interviewMissed"), { kind: "not", condition: persistent("interviewRescheduled") }],
        requires: [
          { kind: "atLocation", placeId: "district5" },
          persistent("interviewArrived"),
          persistent("interviewMissed"),
          persistent("interviewStarted", false),
          persistent("interviewCompleted", false),
        ],
        timeCostMinutes: 1,
        once: true,
      },
      {
        id: "start-rescheduled",
        label: "Begin the rescheduled interview at the market office",
        requires: [
          { kind: "atLocation", placeId: "district5" },
          persistent("interviewArrived"),
          persistent("interviewRescheduled"),
          persistent("interviewStarted", false),
          persistent("interviewCompleted", false),
        ],
        timeCostMinutes: 1,
        once: true,
        effects: [{ kind: "setPersistent", flag: "interviewStarted", value: true }],
      },
      {
        id: "reschedule-and-start",
        label: "Accept the late interview and begin now",
        requires: [
          { kind: "atLocation", placeId: "district5" },
          persistent("interviewArrived"),
          persistent("interviewMissed"),
          persistent("interviewStarted", false),
          persistent("interviewCompleted", false),
        ],
        timeCostMinutes: 2,
        once: true,
        effects: [
          { kind: "setPersistent", flag: "interviewRescheduled", value: true },
          { kind: "setPersistent", flag: "interviewMissed", value: false },
          { kind: "setPersistent", flag: "interviewStarted", value: true },
        ],
      },
      {
        id: "ask-transfer",
        label: "Ask how shopkeepers verify a transfer receipt",
        requires: [persistent("interviewStarted"), persistent("interviewCompleted", false)],
        timeCostMinutes: 8,
        once: true,
        transcript: [
          {
            speaker: "alex",
            voiceId: "m02.coba.interview.transfer_check.alex",
            text: "How do you check a transfer receipt?",
          },
          {
            speaker: "other",
            voiceId: "m02.coba.interview.transfer_check",
            text: "We check the amount in our own bank app, match the sender name, and wait for the balance to update. A screenshot is not payment.",
          },
        ],
        effects: [
          { kind: "setPersistent", flag: "interviewEvidenceSaved", value: true },
          { kind: "setPersistent", flag: "interviewCompleted", value: true },
          { kind: "adjustResource", resource: "evidence", delta: 1 },
        ],
      },
      {
        id: "ask-process",
        label: "Ask for the shop's step-by-step check",
        requires: [persistent("interviewStarted"), persistent("interviewCompleted", false)],
        timeCostMinutes: 8,
        once: true,
        transcript: [
          {
            speaker: "alex",
            voiceId: "m02.coba.interview.process.alex",
            text: "What is your full checking process?",
          },
          {
            speaker: "other",
            voiceId: "m02.coba.interview.process",
            text: "First we pause the handover. Then we check our account, confirm the amount, and only release the goods after the credit appears.",
          },
        ],
        effects: [
          { kind: "setPersistent", flag: "interviewEvidenceSaved", value: true },
          { kind: "setPersistent", flag: "interviewCompleted", value: true },
          { kind: "adjustResource", resource: "evidence", delta: 1 },
        ],
      },
      {
        id: "ask-exception",
        label: "Ask what happens when a receipt looks wrong",
        requires: [persistent("interviewStarted"), persistent("interviewCompleted", false)],
        timeCostMinutes: 8,
        once: true,
        transcript: [
          {
            speaker: "alex",
            voiceId: "m02.coba.interview.exception.alex",
            text: "What if the receipt looks wrong?",
          },
          {
            speaker: "other",
            voiceId: "m02.coba.interview.exception",
            text: "We do not argue over it. We stop the sale, ask the customer to check with their bank, and call our own bank if the transfer is still unclear.",
          },
        ],
        effects: [
          { kind: "setPersistent", flag: "interviewEvidenceSaved", value: true },
          { kind: "setPersistent", flag: "interviewCompleted", value: true },
          { kind: "adjustResource", resource: "evidence", delta: 1 },
        ],
      },
    ],
  },
  {
    id: "ride.off-platform",
    app: "map",
    title: "Cash ride from the stop",
    detail: "60,000 VND · paid to the driver",
    body:
      "The driver is beside the shelter with his Super Cub. The fare is paid in cash, and no trip record is created.",
    arrives: { when: [persistent("driverContactShared")] },
    actions: [
      {
        id: "take-ride",
        label: "Pay 60,000 VND and ride with him",
        visibleWhen: [
          { kind: "not", condition: persistent("interviewMissed") },
          { kind: "not", condition: persistent("ridePaidOffPlatform") },
        ],
        requires: [travelAllowed],
        timeCostMinutes: MISSION_02_CONFIG.unofficialRideMinutes,
        cashCost: MISSION_02_CONFIG.unofficialFareVnd,
        ledgerLabel: "ledger.unofficial-ride",
        counterparty: "Street Driver",
        once: true,
        moveTo: "district5",
        effects: [
          { kind: "setPersistent", flag: "ridePaidOffPlatform", value: true },
          { kind: "setPersistent", flag: "rideLostTime", value: true },
          { kind: "deliverItem", itemId: "ride.wrong-stop" },
        ],
      },
    ],
  },
  {
    id: "ride.wrong-stop",
    app: "map",
    title: "Stopped on Nguyễn Trãi",
    detail: "Three blocks from the market office",
    body:
      "The driver stopped at the corner of Nguyễn Trãi, not at the market office. He says the alley is too narrow for the bike and asks 30,000 more to go around.",
    arrives: { when: [done("ride.off-platform", "take-ride")] },
    actions: [
      {
        id: "walk",
        label: "Walk the last three blocks to the main entrance",
        timeCostMinutes: M.walkFromWrongStop,
        once: true,
        effects: [{ kind: "setPersistent", flag: "interviewArrived", value: true }],
      },
      {
        id: "pay-extra",
        label: "Pay 30,000 VND more to be taken around the block",
        timeCostMinutes: M.payExtraRide,
        cashCost: MISSION_02_CONFIG.wrongStopExtraVnd,
        ledgerLabel: "ledger.unofficial-extra",
        counterparty: "Street Driver",
        once: true,
        effects: [{ kind: "setPersistent", flag: "interviewArrived", value: true }],
      },
    ],
  },
];

export const MISSION_02_EVENTS: GameEventDef[] = [
  {
    id: "m02.interview-window-closed",
    title: "The interview window has closed",
    body: "It is 12:30. Cô Ba's appointment was for 11:30 and the market office is closed to interviews for the day.",
    channel: "notification",
    autoResolve: true,
    optional: false,
    trigger: {
      atMinute: MISSION_02_CONFIG.interviewEndMinute,
      when: [persistent("interviewCompleted", false)],
    },
    // Missing the appointment records a recoverable failure state. The mission stays open so
    // arriving at the office can produce an explicit reschedule conversation instead of silently
    // completing the mission at the window boundary.
    onFire: [{ kind: "setPersistent", flag: "interviewMissed", value: true }],
    responses: [],
  },
  {
    id: "m02.driver-reminder",
    title: "The driver is still by the stop",
    body: "He has seen you look at the route board. He says he leaves in five minutes and the price is still 60,000.",
    channel: "message",
    optional: true,
    trigger: {
      atMinute: minutesFromStart(3, 10, 50),
      when: [persistent("driverContactShared"), persistent("ridePaidOffPlatform", false)],
    },
    responses: [
      { id: "ignore", label: "Leave the message unanswered", kind: "ignore" },
      { id: "later", label: "Answer later", kind: "postpone" },
    ],
  },
  {
    id: "m02.minh-warning",
    title: "Minh asks how you are getting to District 5",
    body: "Minh heard the usual driver is working the stop again today. He asks which way you are going.",
    channel: "message",
    optional: true,
    trigger: {
      atMinute: minutesFromStart(3, 10, 30),
      when: [persistent("driverContactShared")],
    },
    responses: [
      {
        id: "bus",
        label: "Tell him I am taking Bus 06",
        kind: "respond",
        timeCostMinutes: 2,
        effects: [
          { kind: "setPersistent", flag: "minhWarnedAboutRide", value: true },
          { kind: "adjustResource", resource: "supportNetwork", delta: 2 },
        ],
      },
      {
        id: "cash-ride",
        label: "Tell him I found a cheaper ride",
        kind: "respond",
        timeCostMinutes: 2,
        effects: [{ kind: "setPersistent", flag: "minhWarnedAboutRide", value: true }],
      },
      { id: "ignore", label: "Not now", kind: "ignore" },
    ],
  },
];

// --- Task steps (guidance only; they read state and never change it) -----------------------------
const step = (def: MissionStepDef): MissionStepDef => def;

const READ_OFFER = step({
  id: "read-offer",
  label: "Read the offer from the driver at the stop",
  target: "phone",
  app: "messages",
  visibleWhen: [{ kind: "itemArrived", itemId: "msg.m02-driver-offer" }],
  doneWhen: [{ kind: "itemOpened", itemId: "msg.m02-driver-offer" }],
  optional: true,
});
const CHECK_ROUTE = step({
  id: "check-route",
  label: "Check the Bus 06 fare and where it stops",
  target: "phone",
  app: "map",
  doneWhen: [done("map.bus06-stop", "read-board")],
  optional: true,
});
const CONFIRM = step({
  id: "confirm",
  label: "Confirm the appointment through the number in your notes",
  target: "phone",
  app: "contacts",
  doneWhen: [persistent("rideVerifiedIndependently")],
});
const ARRIVE = step({
  id: "arrive",
  label: "Meet Cô Ba and complete the interview at the market office",
  target: "phone",
  app: "files",
  doneWhen: [persistent("interviewCompleted")],
});

export const MISSION_02_MISSIONS: MissionDef[] = [
  {
    id: "m02.the-ride",
    title: "THE RIDE",
    optional: false,
    opensWhen: { atMinute: MISSION_02_CONFIG.opensAtMinute },
    deadlineAtMinute: MISSION_02_CONFIG.missionDeadlineMinute,
    // Missing the original appointment is recoverable. Only the face-to-face interview completes
    // the mission; the 14:00 deadline remains the terminal failure branch.
    completeWhen: [persistent("interviewCompleted")],
    onFail: [{ kind: "setPersistent", flag: "interviewMissed", value: true }],
    paths: [
      {
        id: "verified",
        when: [persistent("rideVerifiedIndependently")],
        objective:
          "The appointment and the meeting point are confirmed. Reach the market office by 12:30; the interview is not in the alley.",
        steps: [CHECK_ROUTE, CONFIRM, ARRIVE],
      },
      {
        id: "off-platform",
        when: [persistent("ridePaidOffPlatform")],
        objective:
          "The ride ended away from the meeting point. Get to the main entrance before the window closes and keep the fare record.",
        steps: [READ_OFFER, ARRIVE],
      },
      {
        id: "default",
        when: [],
        objective:
          "Reach Cô Ba's appointment in District 5 by 12:30. Compare the Bus 06 fare with the ride offered at the stop, and confirm the meeting point through the number in your notes.",
        steps: [READ_OFFER, CHECK_ROUTE, CONFIRM, ARRIVE],
      },
    ],
  },
];
