/**
 * Demo scenario (curated, JSON-like data). All content is simulated.
 * The domains below are examples and must NEVER be visited or opened.
 */

export type Outcome = "safe" | "partial" | "loss";

export interface Choice {
  id: string;
  label: string;
  next: string;
  /** Warning signs revealed after the player makes this choice. */
  flags: string[];
  /** How to verify independently. */
  verify: string;
  /** Extended explanation, shown only when "AI explanation" is on (sample content). */
  aiNote: string;
}

export interface StepNode {
  kind: "step";
  id: string;
  channel: string;
  title: string;
  body: string;
  choices: Choice[];
}

export interface EndNode {
  kind: "end";
  id: string;
  outcome: Outcome;
  title: string;
  body: string;
  checklist: string[];
}

export type ScenarioNode = StepNode | EndNode;

export const START_ID = "sms";

export const scenario: Record<string, ScenarioNode> = {
  sms: {
    kind: "step",
    id: "sms",
    channel: "SMS · unknown number",
    title: "Parcel on hold",
    body:
      "[GHN-Express] Order #VN88213 is on hold due to an incorrect address. Confirm within 30 MINUTES at ghn-xacminh.top/otp or the parcel will be returned.",
    choices: [
      {
        id: "tap",
        label: "Tap the link and confirm right away",
        next: "form",
        flags: [
          "Time pressure: “30 MINUTES”, “or the parcel will be returned”.",
          "The domain ghn-xacminh.top is not ghn.vn (the .top ending is often abused).",
          "The /otp path: a real delivery service never needs an OTP to confirm an address.",
        ],
        verify: "Open the official app or a website address you type yourself, or call the hotline printed on your receipt.",
        aiNote:
          "Scammers create urgency so you act before you have time to think. This is the first step of a multi-step funnel.",
      },
      {
        id: "verify",
        label: "Don't tap the link; open your shopping app and check the order",
        next: "safe-1",
        flags: ["You switched channels: you did not follow a link sent by a stranger."],
        verify: "Look up the order in an app you installed earlier. If there is no such order, that is a clear sign.",
        aiNote:
          "Out-of-band verification is the most effective habit: use a channel you choose, never the one the other side gives you.",
      },
    ],
  },
  form: {
    kind: "step",
    id: "form",
    channel: "Simulated page · ghn-xacminh.top",
    title: "“Verify your identity to keep your order”",
    body:
      "The page asks for your phone number and the 6-digit OTP that was just sent to your phone. A 04:59 countdown is running.",
    choices: [
      {
        id: "otp",
        label: "Enter the OTP you just received",
        next: "loss",
        flags: [
          "An OTP is the key that authorizes YOUR transactions. No legitimate party asks you to read it out or type it in for them.",
          "An artificial countdown to stop you from thinking.",
        ],
        verify: "Read the OTP message itself: it usually states which transaction or bank the code approves.",
        aiNote: "The OTP you received is actually approving a transaction or a login started by the scammer.",
      },
      {
        id: "stop",
        label: "Stop, close the page and enter nothing",
        next: "partial",
        flags: ["You recognized the OTP request as a line you never cross."],
        verify:
          "Change your password if you already entered other details, and report the number or link to your carrier or the authorities.",
        aiNote: "Stopping late is still better than not stopping. Next, check what information you may have exposed.",
      },
    ],
  },
  "safe-1": {
    kind: "end",
    id: "safe-1",
    outcome: "safe",
    title: "You found the way out",
    body: "There is no order on hold in the app. The message was just bait.",
    checklist: [
      "Pause: time pressure is a signal, not a reason to hurry.",
      "Switch channels: open the official app or website yourself.",
      "Never share OTPs, passwords or PINs with anyone.",
    ],
  },
  partial: {
    kind: "end",
    id: "partial",
    outcome: "partial",
    title: "You got out, but touched the trap",
    body: "You opened a suspicious link, so your number may now be marked as “active”. Watch out for follow-up messages.",
    checklist: [
      "Don't tap links, even out of curiosity. Reading the domain is enough.",
      "Never enter anything on a page that asks for an OTP.",
      "Report the message and block the number.",
    ],
  },
  loss: {
    kind: "end",
    id: "loss",
    outcome: "loss",
    title: "You fell into the trap",
    body: "The scammer used the OTP you entered to approve a transaction. In real life, contact your bank immediately to lock your card or account.",
    checklist: [
      "Call the hotline on the back of your card right away to block transactions.",
      "Change the passwords of related accounts and turn on app-based two-factor authentication.",
      "Keep the evidence (messages, links) and report it to the authorities.",
    ],
  },
};
