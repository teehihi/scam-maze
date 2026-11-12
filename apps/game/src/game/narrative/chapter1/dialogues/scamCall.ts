// Chapter 1 "The Urgent Call": the first scam call (`dlg.scam-call`, call `call.scam-1`).
// The caller pretends to be Northgate Bank security. Nodes with `pressure: true` add 1 pressure
// when entered (capped at 3 by the dialogue engine).
// Pure TypeScript data. See design.md, "Dialogue graphs", and Requirements 9.1, 9.10, 10.1-10.6, 10.9.
//
// Paths from `scam.open` to an end node (Requirement 10.1):
// - share the code and move money:  open → code-request → move-money → end.money-moved
// - ask for proof, then challenge:  open → knows-details → challenged → end.hung-up / end.verify
// - verify independently:           open → end.verify (or via knows-details, deflect, challenged)
// - refuse:                         knows-details / code-request / guilt → end.hung-up
// - ask for details first:          open → details → identity / time / app-check → ... → end
//
// Tones (voice delivery): professional, reassuring, defensive, impatient, pressuring. Every caller
// node has a tone and a speaker. At most four options are available at once at every node.
//
// Debrief tags used here: asked-for-proof, challenged-number, asked-why-code, shared-code,
// said-stop, moved-money, hung-up, hung-up-to-verify.
//
// No real codes, account details or payment steps appear in this file (Requirement 10.9).
// The caller lines are fictional and defensive: they show a pressure pattern and give no
// instruction that works outside the game.

import type { DialogueGraph, DialogueNode } from "../../types";

const lines: Record<string, string> = {
  // Caller lines
  "line.scam.open":
    "Hello, this is Alex from Northgate Bank security. We just detected a large transfer leaving your account. Are you the account holder?",
  "line.scam.knows-details":
    "I understand you want to be careful. I can see your full name and the last four digits of your card on my screen. Would a stranger know that?",
  "line.scam.challenged":
    "That number is for general questions. I am calling from the security team's direct line. If you hang up now, I cannot stop the transfer.",
  "line.scam.code-request":
    "To stop the transfer, I am sending a one-time code to your phone right now. Please read it to me so I can cancel the payment.",
  "line.scam.deflect":
    "It is a normal security check. The code proves you are the real account holder. Please hurry, the transfer completes in a few minutes.",
  "line.scam.move-money":
    "Thank you. Your account is still at risk. To protect your savings, you need to move them to a protected holding account today. I will stay on the line with you.",
  "line.scam.guilt":
    "If you stop now and the transfer goes through, I cannot help you. I am only trying to protect your money. Please trust me.",
  "line.scam.details":
    "A large payment is waiting to leave your account. I cannot say more on an open line. I can help you stop it, but we have very little time.",
  "line.scam.identity":
    "My staff number is 0000, and I work in the fraud team. I can give you that number again if you need it. Now, shall we stop the payment?",
  "line.scam.time":
    "The payment will go through in about ten minutes. After that, it cannot be reversed. Please do not make this harder than it needs to be.",
  "line.scam.time-insist":
    "I understand, but we only have a few minutes left. Every minute counts. Please stay with me, and we can fix this together.",
  "line.scam.app-check":
    "The banking app is slow today, and it often hides new payments. That is why I am calling you. Please do not rely on it right now.",
  "line.scam.app-excuse":
    "You are looking at old information. The app has not updated yet. I am looking at the live system. Please listen to me, not the app.",
  "line.scam.sms-link":
    "You also received a text message with a link. Open it and confirm your details there. That is the quickest way to stop the payment.",
  "line.scam.link-defend":
    "The message is part of our security process. It looks different because it comes from a special system. Please just use the link.",
  "line.scam.code-excuse":
    "That warning is a general notice. It does not apply to security staff. I am the one who asked the system to send it, so it is fine to read it to me.",
  "line.scam.account-details":
    "I will give you the holding account details as soon as you agree. First I need you to say that you will go ahead. There is no time to waste.",
  "line.scam.stay-on-line":
    "Please do not hang up, and do not tell anyone about this call. Other people may be part of the problem. Stay with me until it is done.",
  // Player option lines
  "line.scam.opt.yes-what": "Yes, that is me. What is happening?",
  "line.scam.opt.ask-proof": "How do I know you are from the bank?",
  "line.scam.opt.verify": "I will call the bank on the official number.",
  "line.scam.opt.okay-what": "Okay, what do you need?",
  "line.scam.opt.challenge": "Your number is not the one on my card.",
  "line.scam.opt.hang-up": "I am hanging up.",
  "line.scam.opt.read-code": "Read the code to the caller.",
  "line.scam.opt.why-code": "Why do you need my code?",
  "line.scam.opt.call-myself": "I will call the bank myself.",
  "line.scam.opt.call-card": "I will call the number on my card.",
  "line.scam.opt.fine-what": "Fine, what do you need?",
  "line.scam.opt.move-money": "Move the money as instructed.",
  "line.scam.opt.stop": "Stop. This does not feel right.",
  "line.scam.opt.ask-details": "What exactly is the problem?",
  "line.scam.opt.identity": "Who are you? Give me your name and role.",
  "line.scam.opt.time": "When will this happen?",
  "line.scam.opt.app": "My banking app shows nothing unusual.",
  "line.scam.opt.what-do": "What do you want me to do?",
  "line.scam.opt.not-enough": "A staff number is not enough for me.",
  "line.scam.opt.go-on": "Go on.",
  "line.scam.opt.number-mismatch": "This number does not match my card or letter.",
  "line.scam.opt.check-first": "I will check first.",
  "line.scam.opt.please-wait": "Please wait, I need a moment.",
  "line.scam.opt.end-call": "I am ending this call.",
  "line.scam.opt.cite-app": "The app shows no such payment.",
  "line.scam.opt.call-bank": "I will call the bank on the number I trust.",
  "line.scam.opt.link": "There is a link in the text. Is it official?",
  "line.scam.opt.not-official": "That link does not look like an official address.",
  "line.scam.opt.otp-warning": "The text says never to share this code.",
  "line.scam.opt.which-account": "Which account would I use?",
  "line.scam.opt.call-back": "Let me call you back on a number I find myself.",
  "line.scam.opt.ask-friend": "I want to ask someone I trust.",
  "line.scam.opt.need-time": "I need more time to think.",
  // End lines
  "line.scam.end.hung-up": "You end the call.",
  "line.scam.end.verify": "You end the call so you can check with Northgate yourself.",
  "line.scam.end.money-moved": "You do what the caller asks. The caller thanks you and ends the call.",
};

const nodes: Record<string, DialogueNode> = {
  "scam.open": {
    id: "scam.open",
    speaker: "caller",
    speakerId: "spk.alex",
    tone: "professional",
    waitForVoice: true,
    lineId: "line.scam.open",
    options: [
      { id: "opt.scam.open.yes-what", lineId: "line.scam.opt.yes-what", next: "scam.code-request" },
      {
        id: "opt.scam.open.ask-proof",
        lineId: "line.scam.opt.ask-proof",
        next: "scam.knows-details",
        debriefTag: "asked-for-proof",
      },
      {
        id: "opt.scam.open.verify",
        lineId: "line.scam.opt.verify",
        effects: [{ kind: "setFlag", flag: "scam1_hung_up_to_verify" }],
        next: "scam.end.verify",
      },
      {
        id: "opt.scam.open.ask-details",
        lineId: "line.scam.opt.ask-details",
        next: "scam.details",
      },
    ],
  },
  "scam.knows-details": {
    id: "scam.knows-details",
    speaker: "caller",
    speakerId: "spk.alex",
    tone: "reassuring",
    lineId: "line.scam.knows-details",
    onEnter: [{ kind: "discoverEvidence", evidenceId: "ev.partial-info" }],
    options: [
      {
        id: "opt.scam.knows.okay-what",
        lineId: "line.scam.opt.okay-what",
        next: "scam.code-request",
      },
      {
        id: "opt.scam.knows.challenge",
        lineId: "line.scam.opt.challenge",
        conditions: [{ kind: "hasAnyEvidence", evidenceIds: ["ev.bank-card", "ev.bank-letter"] }],
        effects: [{ kind: "setFlag", flag: "number_challenged" }],
        next: "scam.challenged",
        debriefTag: "challenged-number",
      },
      {
        id: "opt.scam.knows.verify",
        lineId: "line.scam.opt.verify",
        effects: [{ kind: "setFlag", flag: "scam1_hung_up_to_verify" }],
        next: "scam.end.verify",
      },
      { id: "opt.scam.knows.hang-up", lineId: "line.scam.opt.hang-up", next: "scam.end.hung-up" },
    ],
  },
  "scam.challenged": {
    id: "scam.challenged",
    speaker: "caller",
    speakerId: "spk.alex",
    tone: "defensive",
    lineId: "line.scam.challenged",
    pressure: true,
    options: [
      {
        id: "opt.scam.challenged.call-card",
        lineId: "line.scam.opt.call-card",
        effects: [{ kind: "setFlag", flag: "scam1_hung_up_to_verify" }],
        next: "scam.end.verify",
      },
      {
        id: "opt.scam.challenged.hang-up",
        lineId: "line.scam.opt.hang-up",
        next: "scam.end.hung-up",
      },
      {
        id: "opt.scam.challenged.fine-what",
        lineId: "line.scam.opt.fine-what",
        next: "scam.code-request",
      },
    ],
  },
  "scam.code-request": {
    id: "scam.code-request",
    speaker: "caller",
    speakerId: "spk.alex",
    tone: "pressuring",
    lineId: "line.scam.code-request",
    pressure: true,
    onEnter: [
      { kind: "setFlag", flag: "otp_sent" },
      { kind: "deliverMessage", messageId: "msg.otp-sms" },
    ],
    options: [
      {
        id: "opt.scam.code.read-code",
        lineId: "line.scam.opt.read-code",
        effects: [{ kind: "setFlag", flag: "code_shared" }],
        next: "scam.move-money",
        debriefTag: "shared-code",
      },
      {
        id: "opt.scam.code.why-code",
        lineId: "line.scam.opt.why-code",
        next: "scam.deflect",
        debriefTag: "asked-why-code",
      },
      { id: "opt.scam.code.hang-up", lineId: "line.scam.opt.hang-up", next: "scam.end.hung-up" },
      {
        id: "opt.scam.code.link",
        lineId: "line.scam.opt.link",
        conditions: [{ kind: "hasEvidence", evidenceId: "ev.sms-alert" }],
        next: "scam.sms-link",
      },
    ],
  },
  "scam.deflect": {
    id: "scam.deflect",
    speaker: "caller",
    speakerId: "spk.alex",
    tone: "impatient",
    lineId: "line.scam.deflect",
    pressure: true,
    onEnter: [{ kind: "setFlag", flag: "heard_deadline" }],
    options: [
      {
        id: "opt.scam.deflect.read-code",
        lineId: "line.scam.opt.read-code",
        effects: [{ kind: "setFlag", flag: "code_shared" }],
        next: "scam.move-money",
        debriefTag: "shared-code",
      },
      {
        id: "opt.scam.deflect.call-myself",
        lineId: "line.scam.opt.call-myself",
        effects: [{ kind: "setFlag", flag: "scam1_hung_up_to_verify" }],
        next: "scam.end.verify",
      },
      {
        id: "opt.scam.deflect.otp-warning",
        lineId: "line.scam.opt.otp-warning",
        conditions: [{ kind: "hasEvidence", evidenceId: "ev.otp-sms" }],
        next: "scam.code-excuse",
      },
    ],
  },
  "scam.move-money": {
    id: "scam.move-money",
    speaker: "caller",
    speakerId: "spk.alex",
    tone: "pressuring",
    lineId: "line.scam.move-money",
    pressure: true,
    options: [
      {
        id: "opt.scam.move.move-money",
        lineId: "line.scam.opt.move-money",
        effects: [
          { kind: "setFlag", flag: "money_moved" },
          { kind: "recordDecision", decision: "follow-request" },
        ],
        next: "scam.end.money-moved",
      },
      {
        id: "opt.scam.move.stop",
        lineId: "line.scam.opt.stop",
        next: "scam.guilt",
        debriefTag: "said-stop",
      },
      {
        id: "opt.scam.move.which-account",
        lineId: "line.scam.opt.which-account",
        next: "scam.account-details",
      },
      {
        id: "opt.scam.move.call-back",
        lineId: "line.scam.opt.call-back",
        next: "scam.stay-on-line",
      },
    ],
  },
  "scam.guilt": {
    id: "scam.guilt",
    speaker: "caller",
    speakerId: "spk.alex",
    tone: "pressuring",
    lineId: "line.scam.guilt",
    pressure: true,
    options: [
      {
        id: "opt.scam.guilt.move-money",
        lineId: "line.scam.opt.move-money",
        effects: [
          { kind: "setFlag", flag: "money_moved" },
          { kind: "recordDecision", decision: "follow-request" },
        ],
        next: "scam.end.money-moved",
      },
      { id: "opt.scam.guilt.hang-up", lineId: "line.scam.opt.hang-up", next: "scam.end.hung-up" },
      {
        id: "opt.scam.guilt.ask-friend",
        lineId: "line.scam.opt.ask-friend",
        next: "scam.stay-on-line",
      },
    ],
  },
  // Nodes added by the voice narrative feature (append-only)
  "scam.details": {
    id: "scam.details",
    speaker: "caller",
    speakerId: "spk.alex",
    tone: "professional",
    lineId: "line.scam.details",
    onEnter: [
      { kind: "setFlag", flag: "asked_details" },
      { kind: "setFlag", flag: "heard_deadline" },
    ],
    options: [
      { id: "opt.scam.details.identity", lineId: "line.scam.opt.identity", next: "scam.identity" },
      { id: "opt.scam.details.time", lineId: "line.scam.opt.time", next: "scam.time" },
      { id: "opt.scam.details.app", lineId: "line.scam.opt.app", next: "scam.app-check" },
      { id: "opt.scam.details.what-do", lineId: "line.scam.opt.what-do", next: "scam.code-request" },
    ],
  },
  "scam.identity": {
    id: "scam.identity",
    speaker: "caller",
    speakerId: "spk.alex",
    tone: "reassuring",
    lineId: "line.scam.identity",
    options: [
      {
        id: "opt.scam.identity.not-enough",
        lineId: "line.scam.opt.not-enough",
        effects: [{ kind: "setFlag", flag: "scam1_hung_up_to_verify" }],
        next: "scam.end.verify",
      },
      { id: "opt.scam.identity.go-on", lineId: "line.scam.opt.go-on", next: "scam.code-request" },
      {
        id: "opt.scam.identity.number",
        lineId: "line.scam.opt.number-mismatch",
        conditions: [{ kind: "hasAnyEvidence", evidenceIds: ["ev.bank-card", "ev.bank-letter"] }],
        effects: [{ kind: "setFlag", flag: "number_challenged" }],
        next: "scam.challenged",
        debriefTag: "challenged-number",
      },
    ],
  },
  "scam.time": {
    id: "scam.time",
    speaker: "caller",
    speakerId: "spk.alex",
    tone: "impatient",
    lineId: "line.scam.time",
    onEnter: [{ kind: "setFlag", flag: "asked_time" }],
    options: [
      {
        id: "opt.scam.time.check-first",
        lineId: "line.scam.opt.check-first",
        effects: [{ kind: "setFlag", flag: "scam1_hung_up_to_verify" }],
        next: "scam.end.verify",
      },
      {
        id: "opt.scam.time.please-wait",
        lineId: "line.scam.opt.please-wait",
        next: "scam.time-insist",
      },
    ],
  },
  "scam.time-insist": {
    id: "scam.time-insist",
    speaker: "caller",
    speakerId: "spk.alex",
    tone: "pressuring",
    lineId: "line.scam.time-insist",
    pressure: true,
    onEnter: [{ kind: "setFlag", flag: "heard_deadline" }],
    options: [
      {
        id: "opt.scam.time-insist.verify",
        lineId: "line.scam.opt.verify",
        effects: [{ kind: "setFlag", flag: "scam1_hung_up_to_verify" }],
        next: "scam.end.verify",
      },
      {
        id: "opt.scam.time-insist.okay-what",
        lineId: "line.scam.opt.okay-what",
        next: "scam.code-request",
      },
      {
        id: "opt.scam.time-insist.end-call",
        lineId: "line.scam.opt.end-call",
        next: "scam.end.hung-up",
      },
    ],
  },
  "scam.app-check": {
    id: "scam.app-check",
    speaker: "caller",
    speakerId: "spk.alex",
    tone: "defensive",
    lineId: "line.scam.app-check",
    options: [
      {
        id: "opt.scam.app-check.cite-app",
        lineId: "line.scam.opt.cite-app",
        conditions: [{ kind: "hasEvidence", evidenceId: "ev.bank-app" }],
        next: "scam.app-excuse",
      },
      {
        id: "opt.scam.app-check.fine-what",
        lineId: "line.scam.opt.fine-what",
        next: "scam.code-request",
      },
      {
        id: "opt.scam.app-check.call-bank",
        lineId: "line.scam.opt.call-bank",
        effects: [{ kind: "setFlag", flag: "scam1_hung_up_to_verify" }],
        next: "scam.end.verify",
      },
    ],
  },
  "scam.app-excuse": {
    id: "scam.app-excuse",
    speaker: "caller",
    speakerId: "spk.alex",
    tone: "defensive",
    lineId: "line.scam.app-excuse",
    pressure: true,
    options: [
      {
        id: "opt.scam.app-excuse.hang-up",
        lineId: "line.scam.opt.hang-up",
        next: "scam.end.hung-up",
      },
      {
        id: "opt.scam.app-excuse.verify",
        lineId: "line.scam.opt.verify",
        effects: [{ kind: "setFlag", flag: "scam1_hung_up_to_verify" }],
        next: "scam.end.verify",
      },
      {
        id: "opt.scam.app-excuse.go-on",
        lineId: "line.scam.opt.go-on",
        next: "scam.code-request",
      },
    ],
  },
  "scam.sms-link": {
    id: "scam.sms-link",
    speaker: "caller",
    speakerId: "spk.alex",
    tone: "reassuring",
    lineId: "line.scam.sms-link",
    options: [
      {
        id: "opt.scam.sms-link.not-official",
        lineId: "line.scam.opt.not-official",
        conditions: [{ kind: "hasEvidence", evidenceId: "ev.sms-alert" }],
        next: "scam.link-defend",
      },
      {
        id: "opt.scam.sms-link.read-code",
        lineId: "line.scam.opt.read-code",
        effects: [{ kind: "setFlag", flag: "code_shared" }],
        next: "scam.move-money",
        debriefTag: "shared-code",
      },
      {
        id: "opt.scam.sms-link.call-bank",
        lineId: "line.scam.opt.call-bank",
        effects: [{ kind: "setFlag", flag: "scam1_hung_up_to_verify" }],
        next: "scam.end.verify",
      },
    ],
  },
  "scam.link-defend": {
    id: "scam.link-defend",
    speaker: "caller",
    speakerId: "spk.alex",
    tone: "defensive",
    lineId: "line.scam.link-defend",
    pressure: true,
    onEnter: [{ kind: "setFlag", flag: "link_questioned" }],
    options: [
      {
        id: "opt.scam.link-defend.hang-up",
        lineId: "line.scam.opt.hang-up",
        next: "scam.end.hung-up",
      },
      {
        id: "opt.scam.link-defend.verify",
        lineId: "line.scam.opt.verify",
        effects: [{ kind: "setFlag", flag: "scam1_hung_up_to_verify" }],
        next: "scam.end.verify",
      },
    ],
  },
  "scam.code-excuse": {
    id: "scam.code-excuse",
    speaker: "caller",
    speakerId: "spk.alex",
    tone: "defensive",
    lineId: "line.scam.code-excuse",
    pressure: true,
    options: [
      {
        id: "opt.scam.code-excuse.hang-up",
        lineId: "line.scam.opt.hang-up",
        next: "scam.end.hung-up",
      },
      {
        id: "opt.scam.code-excuse.verify",
        lineId: "line.scam.opt.verify",
        effects: [{ kind: "setFlag", flag: "scam1_hung_up_to_verify" }],
        next: "scam.end.verify",
      },
      {
        id: "opt.scam.code-excuse.read-code",
        lineId: "line.scam.opt.read-code",
        effects: [{ kind: "setFlag", flag: "code_shared" }],
        next: "scam.move-money",
        debriefTag: "shared-code",
      },
    ],
  },
  "scam.account-details": {
    id: "scam.account-details",
    speaker: "caller",
    speakerId: "spk.alex",
    tone: "pressuring",
    lineId: "line.scam.account-details",
    pressure: true,
    options: [
      {
        id: "opt.scam.account-details.move-money",
        lineId: "line.scam.opt.move-money",
        effects: [
          { kind: "setFlag", flag: "money_moved" },
          { kind: "recordDecision", decision: "follow-request" },
        ],
        next: "scam.end.money-moved",
      },
      {
        id: "opt.scam.account-details.need-time",
        lineId: "line.scam.opt.need-time",
        next: "scam.guilt",
      },
      {
        id: "opt.scam.account-details.hang-up",
        lineId: "line.scam.opt.hang-up",
        next: "scam.end.hung-up",
      },
    ],
  },
  "scam.stay-on-line": {
    id: "scam.stay-on-line",
    speaker: "caller",
    speakerId: "spk.alex",
    tone: "pressuring",
    lineId: "line.scam.stay-on-line",
    pressure: true,
    onEnter: [{ kind: "setFlag", flag: "secrecy_heard" }],
    options: [
      {
        id: "opt.scam.stay-on-line.end-call",
        lineId: "line.scam.opt.end-call",
        next: "scam.end.hung-up",
      },
      {
        id: "opt.scam.stay-on-line.call-bank",
        lineId: "line.scam.opt.call-bank",
        effects: [{ kind: "setFlag", flag: "scam1_hung_up_to_verify" }],
        next: "scam.end.verify",
      },
      {
        id: "opt.scam.stay-on-line.go-on",
        lineId: "line.scam.opt.go-on",
        next: "scam.move-money",
      },
    ],
  },
  // End nodes
  "scam.end.hung-up": {
    id: "scam.end.hung-up",
    speaker: "system",
    lineId: "line.scam.end.hung-up",
    options: [],
    end: { kind: "hung-up", debriefTag: "hung-up" },
  },
  "scam.end.verify": {
    id: "scam.end.verify",
    speaker: "system",
    lineId: "line.scam.end.verify",
    options: [],
    end: { kind: "hung-up", debriefTag: "hung-up-to-verify" },
  },
  "scam.end.money-moved": {
    id: "scam.end.money-moved",
    speaker: "system",
    lineId: "line.scam.end.money-moved",
    options: [],
    end: { kind: "completed", debriefTag: "moved-money" },
  },
};

export const SCAM_CALL_DIALOGUE: DialogueGraph = {
  id: "dlg.scam-call",
  persona: {
    speakerId: "spk.alex",
    name: "Alex",
    role: "Says he is from Northgate Bank security",
    honesty: "scammer",
  },
  channel: "phone",
  independentChannel: false,
  startNodeId: "scam.open",
  lines,
  nodes,
};
