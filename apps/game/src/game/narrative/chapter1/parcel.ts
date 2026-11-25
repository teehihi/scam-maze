// Mission 02 "THE LAST INTERVIEW" of "LAST SUBMISSION: 72 GIỜ CUỐI" (Wednesday, 08:00).
// Pure TypeScript data. This file holds **Slice A** only: the parcel thread, before the trip.
//
// Why the slice starts here: the design (docs/gameplay/PARCEL_THE_LAST_INTERVIEW.md) puts the
// paper slip first, because a document the player can hold is the only teacher a mission of this
// kind needs. The slips, the counter, the ride and the interview arrive in later slices; what ships
// here is the message that starts the day, the page it opens, and the app that can settle it.
//
// What it deliberately does not do:
//   - no new evidence id: the entry ids of the chapter are owned by the parked story's total
//     records (`chapter1/evidence.ts`), so a new id would mean editing a story nobody plays. The
//     slip's knowledge is carried by text and by the actions below.
//   - no mission shell: a mission whose completion path is not written yet would fail at its
//     deadline on every playthrough and quietly move the thesis balance. It ships with the
//     interview, not before it.
//   - nothing that says a page, a message or a choice is safe, unsafe, a scam or a mistake.
//
// Rules it does follow (all enforced by the core and covered by the existing suites):
//   - every amount and minute lives in `PARCEL_CONFIG`;
//   - addresses are plain text on reserved domains and are never rendered as links;
//   - numbers are fictional and start with `+000`;
//   - a page action costs its own minutes, and money leaves only through `cashCost`.
import type { DeviceItemDef, GameEventDef, InteractableDef, ScenarioDefinition } from "../types";
import { minutesFromStart } from "../resources";

/**
 * Every number of Mission 02 that the brief does not state. Times are simulated minutes, money is
 * VND. Change them here, not in the data below.
 */
export const PARCEL_CONFIG = {
  /** Wednesday 08:00: the message the day starts with. */
  opensAtMinute: minutesFromStart(3, 8, 0),
  /** The amount the message asks for. */
  redeliveryFeeVnd: 22_000,
  /** Minutes each step of the page takes. */
  minutes: {
    readMessage: 1,
    openPage: 1,
    enterDetails: 2,
    payFee: 3,
    closePage: 1,
    /** Searching the courier app by phone number: the slower route, because the phone is not the code. */
    lookupByPhone: 8,
    /** Reading the code off the paper slip makes the same lookup four minutes shorter. */
    lookupWithSlip: 4,
  },
  /** Digital security lost when the player types the student number and the card into the page. */
  security: { enterDetails: -25 },
} as const;

const M = PARCEL_CONFIG.minutes;

const done = (itemId: string, actionId: string) => ({ kind: "itemActionDone" as const, itemId, actionId });

export const PARCEL_LEDGER_LABELS: Record<string, string> = {
  "ledger.parcel-fee": "Parcel redelivery fee",
};

/**
 * The paper on the desk. It is the chapter's `obj.note` interactable, which is the room engine's own
 * `note` prop: a sheet on the desk that already plays the paper sound and already has an inspect
 * pose. The text is what a courier's tracking slip says, including the code the courier app wants.
 */
export const PARCEL_INTERACTABLES: Partial<Record<keyof ScenarioDefinition["interactables"], InteractableDef>> = {
  "obj.note": {
    id: "obj.note",
    label: "The courier's tracking slip",
    actionLabel: "read",
    inspectionText: [
      "A redelivery slip from the courier, folded twice and left on the desk.",
      "It shows one tracking code: TH24 4471 0925, and one counter: Chợ Lớn, District 5.",
      'Under the code, a printed line reads: "Redelivery at the counter is free. Keep this slip."',
      "The slip does not say that any message about a parcel is wrong. It says what this parcel is and where it can be picked up.",
    ].join(" "),
    produces: { type: "INTERACT_OBJECT" },
    reveals: [],
  },
};

// The hover prompt of the desk sheet stays the room engine's own (`label.note` / `actionLabel` in
// `i18n/locales/*/worlds/roomv2.ts`): the chapter's prompt table is a fixed record shared with the
// parked story, so an authored M02 prompt needs a per-chapter table. Slice A does not need one —
// what the player reads on the paper is the inspect text above, which IS authored here.

export const PARCEL_DEVICE_ITEMS: DeviceItemDef[] = [
  // --- The message the day starts with -------------------------------------------------------------
  {
    id: "msg.parcel-fee",
    app: "messages",
    title: "Tốc Hành 24",
    from: "Tốc Hành 24",
    detail: "+000 90 4471 2210",
    body:
      "Your parcel TH24 4471 0925 could not be delivered this morning: the address was incomplete. " +
      "A redelivery fee of 22,000 VND is required before the next attempt. " +
      "Confirm the address and pay the fee in the courier's app.",
    arrives: { atMinute: PARCEL_CONFIG.opensAtMinute },
    actions: [
      {
        id: "read",
        label: "Read the message again",
        timeCostMinutes: M.readMessage,
        once: true,
      },
      {
        id: "ignore",
        label: "Leave it for now",
        timeCostMinutes: 0,
        once: true,
      },
    ],
  },

  // --- The page the message leads to ---------------------------------------------------------------
  // It asks for a student number and a card before it asks for the fee: the order is the tell, and
  // the page never points it out. Nothing is loaded from the Internet; the address is plain text.
  {
    id: "page.parcel",
    app: "mail",
    folder: "other",
    title: "Redelivery confirmation",
    from: "Redelivery confirmation",
    detail: "tochhanh24.example",
    // The browser resolves `https://tochhanh24.example/redelivery` to this item; `page.*` items are
    // pages, not mail, so Mail hides this one on purpose (see `isWebPageItem`).
    body:
      "Parcel TH24 4471 0925 is waiting for a redelivery. " +
      "Confirm the recipient and the address, then pay the redelivery fee of 22,000 VND.\n\n" +
      "This page is a simulation. No real card, account or code is used in this game.",
    arrives: { when: [done("app.courier", "open-redelivery-page")] },
    actions: [
      {
        id: "enter-details",
        label: "Enter my student number and card number to confirm the recipient",
        timeCostMinutes: M.enterDetails,
        once: true,
        effects: [
          { kind: "setPersistent", flag: "parcelCredentialsExposed", value: true },
          { kind: "adjustResource", resource: "digitalSecurity", delta: PARCEL_CONFIG.security.enterDetails },
        ],
        transcript: [
          {
            speaker: "alex",
            text: "Parcel TH24 4471 0925. Here is my student number, and the card I use for deliveries.",
          },
          {
            speaker: "other",
            text: "Thank you. The recipient is confirmed. Pay the redelivery fee to schedule the next attempt.",
          },
        ],
      },
      {
        id: "pay-fee",
        label: "Pay the redelivery fee",
        visibleWhen: [done("page.parcel", "enter-details")],
        timeCostMinutes: M.payFee,
        cashCost: PARCEL_CONFIG.redeliveryFeeVnd,
        ledgerLabel: "ledger.parcel-fee",
        counterparty: "Redelivery confirmation",
        once: true,
        effects: [{ kind: "setPersistent", flag: "parcelFeePaid", value: true }],
      },
      {
        id: "close",
        label: "Close the page",
        timeCostMinutes: M.closePage,
      },
    ],
  },

  // The message points at the app, not at a link: an SMS in this game never becomes a link (a
  // deliberate rule in `ChatThread`), and that rule is worth keeping — a redelivery SMS that made
  // its own address clickable would teach the habit this game exists to break.
  //
  // --- The app that could have answered the message ------------------------------------------------
  // Two routes to the same fact, and they cost different amounts: the slip's code is on the desk,
  // the phone number is in the message. Neither route is called right or wrong.
  {
    id: "app.courier",
    app: "files",
    folder: "services",
    title: "Tốc Hành 24 — parcel lookup",
    body: "Look up a parcel by its tracking code or by the phone number the sender used.",
    arrives: { atMinute: PARCEL_CONFIG.opensAtMinute },
    actions: [
      {
        id: "lookup-with-slip",
        label: "Look up TH24 4471 0925",
        timeCostMinutes: M.lookupWithSlip,
        once: true,
        effects: [
          { kind: "setPersistent", flag: "parcelAtCounter", value: true },
          { kind: "adjustResource", resource: "evidence", delta: 1 },
        ],
        transcript: [
          { speaker: "alex", text: "Tracking code TH24 4471 0925." },
          {
            speaker: "other",
            text:
              "Parcel TH24 4471 0925 is at the Chợ Lớn counter, District 5. " +
              "No redelivery fee is recorded for this parcel. The counter is open until 13:30.",
          },
        ],
      },
      // The page itself. Reached from here because an SMS cannot carry a link in this game, and the
      // courier's app is where a parcel question naturally gets answered.
      {
        id: "open-redelivery-page",
        label: "Open the redelivery page",
        timeCostMinutes: M.openPage,
        once: true,
        effects: [{ kind: "deliverItem", itemId: "page.parcel" }],
      },
      {
        id: "lookup-by-phone",
        label: "Look up by the phone number on the message",
        timeCostMinutes: M.lookupByPhone,
        once: true,
        effects: [{ kind: "setPersistent", flag: "parcelAtCounter", value: true }],
        transcript: [
          { speaker: "alex", text: "I am looking up a parcel sent to this number." },
          {
            speaker: "other",
            text:
              "One parcel is registered to this number and is waiting at a counter. " +
              "The sender pays the fee, not the receiver. Ask the counter to check the code on the slip.",
          },
        ],
      },
    ],
  },
];

/**
 * The counter closes at 13:30. Nothing fails and nothing is taken away: the record simply says that
 * the day ended with the parcel still there, which is what a missed counter is.
 */
export const PARCEL_EVENTS: GameEventDef[] = [
  {
    id: "m02.counter-closes",
    title: "The counter is closed",
    body: "The Chợ Lớn counter closed at 13:30. The parcel is still there.",
    channel: "notification",
    optional: true,
    autoResolve: true,
    trigger: {
      atMinute: minutesFromStart(3, 13, 30),
      when: [done("msg.parcel-fee", "read"), { kind: "persistent", flag: "parcelAtCounter", value: false }],
    },
    responses: [],
  },
];
