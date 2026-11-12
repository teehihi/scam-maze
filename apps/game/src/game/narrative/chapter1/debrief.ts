// Chapter 1 "The Urgent Call": debrief text.
// Describes what the scammer did and what the player can do next time, without blaming the
// player (Requirement 14.6). The `uncertain` summary is a partial result, not a failure
// (Requirement 13.12).
// Pure TypeScript data. See design.md, "Debrief builder", and Requirements 14.3, 14.6.
//
// `decisionNotes` has one entry for every debrief tag used in Scenario_Data: the dialogue option
// and end-node tags, and the decision tags in `decisions.ts`.

import type { DebriefContent } from "../types";

export const CHAPTER_1_DEBRIEF: DebriefContent = {
  mechanism:
    "This was an impersonation scam. A text created a short deadline and sent you to a look-alike web address. Then a caller pretended to be from Northgate Bank security. The caller used a few personal details to sound real, asked for the one-time code the bank had just sent, and then asked you to move your savings to a \"protected holding account\". The account belonged to the caller. Each step added pressure so that there was no time to check.",
  saferAlternatives: [
    "End the call and contact the bank yourself on the number on your card, on a bank letter or in the bank's app.",
    "Never read a one-time code to anyone. A real bank does not ask for it.",
    "Do not move money because a caller asks you to protect it. A real bank does not ask this.",
    "Do not use links or numbers from an unexpected message. Type the bank's official website yourself or open the app you already have.",
    "Take your time and talk to someone you trust. Pressure to act quickly is a warning sign.",
    "Report the call to your bank and block the number.",
  ],
  outcomeSummaries: {
    verified:
      "You checked the caller's story through a channel you already trusted. Northgate confirmed that they did not call you, so the request was a scam and nothing was lost.",
    investigator:
      "You checked the caller's story through a channel you already trusted, kept the evidence together and reported the call. Northgate confirmed that they did not call you, so the request was a scam and nothing was lost. Reports like yours help the bank warn other customers.",
    risky:
      "The caller's pressure worked this time. That happens to many careful people, because the scam is built to feel urgent and real. The steps below show where you could stop and check next time.",
    uncertain:
      "This is a partial result, not a failure. You stopped the caller's request, which ended the immediate risk. You did not confirm with Northgate, so you did not learn whether the alert was real. Next time, call the number on your card to find out.",
  },
  decisionNotes: {
    "asked-for-proof":
      "You asked the caller to prove they were from the bank. The caller only used a few personal details, and those can come from leaked data.",
    "challenged-number":
      "You noticed that the caller's number was not the one on your card. The caller had an excuse ready, which is common in this scam.",
    "asked-why-code":
      "You asked why the caller needed your code. The caller called it a normal security check and pushed you to hurry.",
    "shared-code":
      "You read the one-time code to the caller. The message with the code said never to share it, but the caller made the request feel urgent and normal.",
    "said-stop":
      "You told the caller that something did not feel right. The caller then used guilt to keep you on the line.",
    "moved-money":
      "You moved the money as the caller asked. The \"protected holding account\" belonged to the caller.",
    "hung-up":
      "You ended the call. This stopped the caller's pressure and gave you time to think.",
    "hung-up-to-verify":
      "You ended the call so you could check with Northgate yourself. This is a strong step, because you chose the channel instead of the caller.",
    "hung-up-on-callback":
      "When the caller called back, you ended the call again. Calling back to push harder is part of the same pattern.",
    "talked-to-sam":
      "You talked to Sam at the corner shop. Talking to someone you trust gives you time and often shows that the story is a known pattern.",
    "reported-to-bank":
      "You called Northgate on the official number and told them about the call.",
    "told-bank-about-code":
      "You told Northgate that you had shared the code. Telling the bank quickly lets them lock the account and limit the harm.",
    "blocked-number": "You blocked the caller's number after speaking to Northgate.",
    "asked-for-details":
      "You asked the caller for details about the alert. The answers stayed vague or changed, which is common when a caller is following a script.",
    "asked-for-time":
      "You asked when the alert started. A caller who is not looking at your real account often cannot give a clear answer.",
    "cited-bank-app":
      "You pointed out that the bank's app shows no alert. The app is a channel you already trust, so it is a good place to check.",
    "cited-otp-warning":
      "You pointed out that the code message says never to share the code. Repeating the bank's own rule is a clear way to push back.",
    "challenged-link":
      "You asked about the web address in the text. A look-alike address that you did not choose is a warning sign.",
    "noticed-isolation":
      "You noticed that the caller asked you to keep the call secret. A real bank does not ask you to hide a call from people you trust.",
    "challenged-story":
      "You noticed that the caller's story changed. Details that shift from one minute to the next are a warning sign.",
    "told-caller-bank-said-no":
      "You told the caller that Northgate said it did not call you. A caller who is telling the truth would welcome the check, not argue with it.",
    "reported-details":
      "You gave Northgate the details of the call, including the numbers and what was asked. Full details help the bank warn other customers.",
    "reported-basic":
      "You reported the call to Northgate. Next time, you can add the numbers and the exact requests so the bank has more to work with.",
    "hung-up-on-followup":
      "You ended the follow-up call. A second call from a new number that offers to fix the problem is part of the same pattern.",
    "chose-follow-request":
      "You decided to call the number back and do what the caller asked. The caller's story was built to make this feel like the right thing to do.",
    "chose-verify-independently":
      "You decided to report the call and block the number after Northgate confirmed they had not called you.",
    "chose-stop-and-wait":
      "You decided to block the number and leave it for now. This stopped the request, but you did not confirm with Northgate.",
  },
};
