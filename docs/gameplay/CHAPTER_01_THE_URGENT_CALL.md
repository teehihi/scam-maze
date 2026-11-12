# Chapter 1: The Urgent Call

> **Status:** scenario content and deterministic chapter core `IMPLEMENTED`; prop positions
> `IMPLEMENTED` but not calibrated in a browser; touch movement `PLANNED` (deferred); play time
> target not measured.
>
> **Source of truth:** this document describes the data in
> `apps/game/src/game/narrative/chapter1/` and the call timing in
> `apps/game/src/features/chapter1/useCallTriggers.ts`. If the code and this document differ, the
> code is correct and this document must be updated.
>
> **Spec:** `.kiro/specs/chapter-01-the-urgent-call/` (requirements, design, tasks).

## 1. Premise

It is morning, before breakfast. The player stands on their street with a coffee. An urgent text
from the fictional **Northgate Bank** is already on the in-game phone:

> Northgate Bank: Account ending 9284 is suspended due to unusual overseas activity. Confirm your
> identity within 15 minutes at northgate-secure-verify.invalid to avoid a permanent freeze.

Soon a call arrives from "Northgate Bank Security" on `+000 555 0142`. The caller, "Alex from
Northgate Bank security", says a large transfer is leaving the account. He knows the player's name
and the last four digits of the account. He asks for the one-time code the bank has just sent, and
then asks the player to move their savings to a "protected holding account". The account belongs
to the caller.

The player can explore the street, inspect the phone, talk to Sam at the corner shop, check the
caller's story through a channel they already trust, and then decide what to do. The chapter
teaches a pattern that is not tied to one country: bank impersonation, urgency, one-time code
requests and requests to move money.

Scenario id `chapter-1`, title "The Urgent Call", subtitle "The notification arrives before
breakfast." (`scenario.ts`).

## 2. Canonical chapter decision

- Chapter 1 is **"The Urgent Call"** (bank-security impersonation). This matches the main menu,
  `chapterRegistry.ts` and `IntroPrologueModal.tsx`.
- **"The Missing Parcel"** is listed as Chapter 1 in
  [`docs/product/PRODUCT_POSITIONING.md`](../product/PRODUCT_POSITIONING.md), section 11. It is
  deferred to a later chapter.
- This is a deviation from the positioning document. It is recorded in
  [`docs/PROJECT_PROGRESS.md`](../PROJECT_PROGRESS.md) and in the spec requirements
  (`.kiro/specs/chapter-01-the-urgent-call/requirements.md`).
- The brief's "SAFE" ending is named `verified` in code and "Checked through a trusted channel" in
  the UI, because the repository rules forbid calling anything "safe".

## 3. Play area and interactables

The chapter uses a small part of the existing street scene in first person.

- **Spawn:** `[188.6, -92.70, -88.89]`, yaw π (facing +Z).
- **Bounds:** x 180 to 198.5, z -92 to 52, ground y -92.70 (`STREET_PLAY_BOUNDS`).
- **Controls:** WASD or arrow keys to move, mouse to look, **E** to interact, **P** to open the
  phone, **J** to open the journal, **Esc** to close the top panel or pause.

All five props sit in a strip about 30 m long in front of the spawn. Positions come from
`apps/game/src/features/chapter1/world/propLayout.ts`. Each prop has a focus sphere radius of
0.6 m. West-side props face +X; east-side props face -X.

| Id | What it is | Side | Focus centre `[x, y, z]` | Prompt | Reveals |
|---|---|---|---|---|---|
| `obj.wallet` | Your wallet on the café table | West | `[184.5, -91.9, -82]` | Press E to check your wallet on the café table | `ev.bank-card` |
| `obj.mailbox` | Your mailbox | East | `[197.6, -91.6, -78]` | Press E to open your mailbox | `ev.bank-letter` |
| `obj.shop-poster` | The Northgate notice in the shop window | West | `[180.4, -91.2, -72]` | Press E to read the Northgate notice in the shop window | `ev.shop-poster` |
| `obj.shopkeeper` | Sam at the shop counter | West | `[181.6, -91.3, -68]` | Press E to talk to Sam at the shop counter | Starts `dlg.shopkeeper` |
| `obj.notice-board` | The community notice board | East | `[197.8, -91.4, -64]` | Press E to read the community notice board | `ev.community-alert` |

The shopkeeper's focus centre is at about 1.4 m above the ground (the design value was 0.8 m) so
the sphere covers both the counter and Sam's upper body.

**Calibration status:** these positions were placed from the play-area bounds only, without
checking them in a browser. See [Known limitations](#14-known-limitations).

## 4. Phone content

Numbers and domains are plain text. The phone UI never renders them as links.

| Item | Content |
|---|---|
| `msg.sms-alert` | The urgent text (section 1). Delivered at the start. |
| `msg.otp-sms` | "Here is your one-time code to approve a sign-in on a new device. It expires in 5 minutes. Never share this code with anyone, including bank staff." Delivered when the caller asks for the code. The code itself is never written out. |
| Contacts | "Northgate Bank Security" `+000 555 0142` (the caller); "Northgate Bank customer support" `+000 555 0100` (official). |
| Bank app | "Your account": account ending 9284 is active, no alerts. "Recent activity": no pending transfers. "Help and contact": official number and `northgate.example`; the bank never asks for a one-time code or asks you to move money. |

Key values (`phone.ts`):

| Constant | Value |
|---|---|
| `SCAM_CALLER_NUMBER` | `+000 555 0142` |
| `OFFICIAL_BANK_NUMBER` | `+000 555 0100` |
| `OFFICIAL_BANK_WEBSITE` | `northgate.example` |
| `LOOK_ALIKE_DOMAIN` | `northgate-secure-verify.invalid` |

Calls (`CHAPTER_1_CALLS`):

| Id | Direction | Shown as | Number | Dialogue |
|---|---|---|---|---|
| `call.scam-1` | Incoming | Northgate Bank Security | `+000 555 0142` | `dlg.scam-call` |
| `call.callback` | Incoming | Northgate Bank Security | `+000 555 0142` | `dlg.callback` |
| `call.official` | Outgoing | Northgate Bank customer support | `+000 555 0100` | `dlg.official-line` |

## 5. Claims

The caller makes four claims (`claims.ts`). Every claim starts as `unverified`.

| Id | Claim | Can change to |
|---|---|---|
| `claim.caller-identity` | The caller works for Northgate Bank. | `contradicted` by the official line |
| `claim.account-suspended` | Your account is suspended. | `inconclusive` after the bank app; `contradicted` by the official line (the stronger result is kept) |
| `claim.code-needed` | The bank needs your one-time code to stop a transfer. | `contradicted` by the official line |
| `claim.protected-account` | Moving your money to a protected holding account protects it. | Stays `unverified`; the poster and the alert point against it, but no channel sets its status |

Only the official line (`dlg.official-line`, the only graph with `independentChannel: true`) can
set a claim to `contradicted`. Evidence stances alone never settle a claim. The bank app is not an
independent channel, so it can only make the suspension claim `inconclusive`.

## 6. Evidence

Eleven evidence items (`evidence.ts`). "Stance" is the item's relation to a claim. Stances are
shown to the player as hints; they do not change claim statuses.

| Id | Title | Source | How it is found | Claim: stance | Warning signs |
|---|---|---|---|---|---|
| `ev.sms-alert` | Urgent text message | Device (Phone · Messages) | Inspect it on the phone; available from the start | account-suspended: needs verification | Urgency, look-alike link |
| `ev.otp-sms` | One-time code message | Device (Phone · Messages) | Inspect it on the phone after the caller asks for the code (`otp_sent`) | code-needed: contradicts | Request for a one-time code |
| `ev.caller-number` | Caller's number | Device (Phone · Calls) | Inspect the call history after the first call rang (`scam1_rang`) | caller-identity: needs verification | Number you do not know |
| `ev.bank-card` | Number on your bank card | Physical (café table, wallet) | Interact with `obj.wallet` | caller-identity: needs verification | None |
| `ev.bank-letter` | Letter from Northgate Bank | Physical (mailbox) | Interact with `obj.mailbox` | caller-identity: needs verification; account-suspended: needs verification | None |
| `ev.bank-app` | Northgate Bank app | Device (Phone · Northgate Bank) | Open the bank app (phone open, no call in progress) | account-suspended: contradicts | None |
| `ev.shop-poster` | Northgate notice in the shop window | Physical (corner shop window) | Interact with `obj.shop-poster` | code-needed: contradicts; protected-account: contradicts | Request for a one-time code, request to move money |
| `ev.community-alert` | Neighbourhood alert | Physical (notice board) | Interact with `obj.notice-board` | protected-account: contradicts | Request to move money |
| `ev.partial-info` | What the caller knew | Dialogue (scam call) | Reach node `scam.knows-details` (ask the caller for proof) | caller-identity: inconclusive | Knowing a few personal details |
| `ev.sam-testimony` | Sam's story | NPC (corner shop) | Reach node `sam.after-call.story` (talk to Sam after the call) | caller-identity: inconclusive | Emotional pressure |
| `ev.official-confirmation` | Northgate official line | Verification (Phone · official call) | Reach node `official.confirm` on the official call | caller-identity, account-suspended, code-needed: contradicts | None |

The seven warning signs are `ws.urgency`, `ws.look-alike-link`, `ws.code-request`,
`ws.unknown-number`, `ws.move-money`, `ws.partial-details` and `ws.emotional-pressure`. The debrief
lists a warning sign as noticed when the player found an evidence item that carries it.

## 7. Contradiction chain

The main chain compares the caller's number with a number the player already trusts:

1. The first call rings from `+000 555 0142` (`ev.caller-number`, in the call history).
2. The wallet card (`ev.bank-card`) and the bank letter (`ev.bank-letter`) both show the official
   number `+000 555 0100`.
3. When the player has both `ev.caller-number` and `ev.bank-card`, the journal unlocks the note
   `note.number-mismatch`: "The numbers are different. That is a warning sign, but caller ID can be
   faked, so a matching number would not prove anything either." The note's requirement is tied to
   the card; the letter carries the same number.
4. With the card or the letter, the player can challenge the caller ("Your number is not the one
   on my card.") and can call the official line.
5. The official line confirms there was no call from the bank. Only this step contradicts the
   caller's identity.

Supporting chains:

- **Suspension:** the text says the account is suspended; the bank app shows it as active
  (`inconclusive`); the official line confirms it is active (`contradicted`).
- **Code:** the caller asks for the code; the code message itself, the shop notice and the official
  line all say the bank never asks for it.
- **Protected account:** the caller asks to move money; the shop notice and the neighbourhood
  alert say the bank never asks this and that neighbours got the same request.

## 8. Dialogue graphs

Files are in `apps/game/src/game/narrative/chapter1/dialogues/`. Nodes marked "pressure" add 1 to
the pressure level when entered (capped at 3).

### `dlg.scam-call` (first call, `call.scam-1`)

Persona: Alex, "Says he is from Northgate Bank security", honesty `scammer`, channel phone.

| Node | Caller says (short) | Player options → next |
|---|---|---|
| `scam.open` | A large transfer is leaving your account. Are you the account holder? | "Yes, that is me…" → `code-request`; "How do I know you are from the bank?" → `knows-details`; "I will call the bank on the official number." → `end.verify` |
| `scam.knows-details` (finds `ev.partial-info`) | I can see your full name and the last four digits of your card. | "Okay, what do you need?" → `code-request`; "Your number is not the one on my card." (needs card or letter) → `challenged`; call the official number → `end.verify`; hang up → `end.hung-up` |
| `scam.challenged` (pressure) | That number is for general questions; this is the security team's direct line. | Call the number on my card → `end.verify`; hang up → `end.hung-up`; "Fine, what do you need?" → `code-request` |
| `scam.code-request` (pressure; sends `msg.otp-sms`) | Read me the one-time code so I can cancel the payment. | Read the code (`code_shared`) → `move-money`; "Why do you need my code?" → `deflect`; hang up → `end.hung-up` |
| `scam.deflect` (pressure) | It is a normal security check. Please hurry. | Read the code → `move-money`; "I will call the bank myself." → `end.verify` |
| `scam.move-money` (pressure) | Move your savings to a protected holding account today. | Move the money (`money_moved`, decision `follow-request`) → `end.money-moved`; "Stop. This does not feel right." → `guilt` |
| `scam.guilt` (pressure) | If you stop now, I cannot help you. Please trust me. | Move the money → `end.money-moved`; hang up → `end.hung-up` |

End nodes: `scam.end.hung-up` (tag `hung-up`), `scam.end.verify` (tag `hung-up-to-verify`),
`scam.end.money-moved` (tag `moved-money`). The player can also hang up at any time with the phone
controls.

### `dlg.callback` (second call, `call.callback`)

Same persona. Rings at most once (section 9). Opens with pressure: "Why did you hang up? … The
transfer completes in two minutes."

- If the code was not sent yet: "What do you need from me?" → code request (sends the code
  message) → read the code → move-money request.
- If the code was sent but not read: read the code → move-money request.
- If the code was already read: "What do I need to do now?" → move-money request.
- From any node: "I am hanging up." → end (tag `hung-up-on-callback`).
- Moving the money sets `money_moved`, records `follow-request` and ends the call (tag
  `moved-money`).

### `dlg.shopkeeper` (Sam, face to face)

Persona: Sam, owner of the corner shop, honesty `trusted`. The start node depends on whether the
first call has ended.

- **Before the call:** Sam greets the player. The player can ask about the Northgate notice in the
  window; Sam says it is about people who pretend to be the bank and is worth a read.
- **After the call:** Sam asks whether someone called about the bank. If the player says yes, Sam
  tells his story (finds `ev.sam-testimony`): a caller knew his name and he almost read out his
  code. Then his advice: "Call the number on your card, not the one that called you."
- Every path ends with "See you later, Sam." (tag `talked-to-sam`).

### `dlg.official-line` (`call.official`, outgoing)

Persona: Northgate customer support, honesty `trusted`, the only independent channel.

1. Greeting and hold → agent.
2. The player reports the call (tag `reported-to-bank`).
3. `official.confirm` (finds `ev.official-confirmation`; contradicts caller identity, suspension
   and code claims): "We have no record of a call to you today. Your account is active. We never
   ask for one-time codes or ask you to move money."
4. If the code was shared, the only option is to tell the bank (tag `told-bank-about-code`). The
   bank locks the simulated account and sends a new card (`account_locked`).
5. "Thank you. I will block that number." → end (tag `blocked-number`).

## 9. Call triggers and timing

The chapter core has no clock. `useCallTriggers.ts` keeps one in the UI layer. Timers only count
while the chapter is playing, no panel (phone, journal, pause menu and so on) is open and the
browser tab is visible.

| Constant | Value | Rule |
|---|---|---|
| `FIRST_INTERACTION_RING_DELAY_MS` | 3 000 ms | The first call rings 3 s after the first interaction (any prop or Sam). |
| `EXPLORATION_FALLBACK_MS` | 60 000 ms | If the player has not interacted, the first call rings after 60 s of exploration. |
| `RE_RING_DELAY_MS` | 20 000 ms | If the player declines the first call, it rings again 20 s later. This repeats until the player answers; each decline starts a new 20 s wait. |
| `CALLBACK_DELAY_MS` | 90 000 ms | If the first call ends and no decision is made, the callback rings 90 s later. It rings at most once. |
| `CALL_TRIGGER_TICK_MS` | 250 ms | Clock tick interval. |
| `MAX_TICK_DELTA_MS` | 1 000 ms | Largest time added by one tick, so a throttled timer cannot jump ahead. |

A ring that is due waits while another call or conversation is in progress. The callback does not
ring after a decision is made.

## 10. Decisions

The decision panel opens from the **Decide** button in the journal or the phone. It is offered
only after the first call has ended and while no decision exists. Every choice asks for
confirmation (`decisions.ts`).

| Id | Label | Requires | Effect |
|---|---|---|---|
| `follow-request` | Call the number back and do what the caller asks | First call ended | Sets `money_moved` |
| `verify-independently` | Report the call and block the number | `ev.official-confirmation` | None beyond the decision |
| `stop-and-wait` | Block the number and leave it for now | First call ended | None beyond the decision |

`verify-independently` has a pre-step: **"Call Northgate on the official number"**. It needs the
card or the letter; without them the hint reads "You need the bank's official number. Where might
you find it?". The pre-step starts the outgoing official call.

`follow-request` can also be recorded inside a call, when the player moves the money in
`dlg.scam-call` or `dlg.callback`.

## 11. Outcomes, consequences and debrief

### Outcome rules (`outcome.ts`)

Checked in order, once a decision exists:

1. `code_shared` or `money_moved` → **`risky`**, whatever the decision.
2. `verify-independently` with the caller identity claim `contradicted` → **`verified`**.
3. `stop-and-wait` → **`uncertain`**.

Once an outcome is set, the core only accepts `FINISH_CHAPTER`.

### Endings and consequence variants (`endings.ts`)

The first variant whose conditions all hold is shown. Every ending shows the label
"Simulation: nothing real happened."

| Outcome | UI title | Variant | When | Text (short) |
|---|---|---|---|---|
| `verified` | Checked through a trusted channel | `verified.reported` | Always | Northgate confirmed they did not call; you blocked and reported the number; the simulated account stays active. |
| `risky` | Followed the caller's request | `risky.money-moved` | `money_moved` | The simulated savings balance reads zero; the "protected holding account" belonged to the caller. |
| `risky` | | `risky.code-shared-locked` | `code_shared` and `account_locked` | The caller signed in with your code; Northgate locked the account after you called, but it was compromised. |
| `risky` | | `risky.code-shared` | Fallback | The caller signed in with your code; Northgate did not know because nobody told them. |
| `uncertain` | Stopped, but did not confirm | `uncertain.stopped` | Always | You ended the immediate risk but did not check with Northgate. Next time, confirm through the number on your card. |

### Debrief (`debrief.ts`)

The debrief is built only from scenario data and the event log. It never blames the player.

- **Outcome summary:** one per outcome. `verified` explains that the trusted channel showed the
  call was a scam. `risky` says the pressure worked "this time", that this happens to many careful
  people, and points to where the player could stop next time. `uncertain` is described as "a
  partial result, not a failure".
- **What the scammer did (mechanism):** an impersonation scam. A text set a short deadline and a
  look-alike address; a caller pretended to be bank security, used a few personal details, asked
  for the one-time code and then asked the player to move savings to an account that belonged to
  the caller.
- **Your decisions:** one note per debrief tag, in event-log order. There are notes for all 16 tags:
  the 13 tags used in the four dialogue graphs and the three decision tags `chose-follow-request`,
  `chose-verify-independently` and `chose-stop-and-wait`. Hanging up with the phone control also
  records `hung-up` (first call) or `hung-up-on-callback` (callback).
- **Evidence found** and **warning signs noticed**, from the discovered evidence.
- **Clues missed:** the `debriefHint` of every evidence item the player did not find.
- **Safer alternatives (six):** contact the bank yourself on the number on your card, letter or
  app; never read a one-time code to anyone; do not move money because a caller asks; do not use
  links or numbers from an unexpected message; take your time and talk to someone you trust; report
  the call and block the number.

## 12. Walkthroughs

These match the scripted runs in `apps/game/src/game/narrative/chapter1/playthroughs.test.ts`.

### Verified: "Checked through a trusted channel"

1. Check the wallet on the café table (finds `ev.bank-card`). The first call rings 3 s later.
2. Answer. Choose "How do I know you are from the bank?" (finds `ev.partial-info`).
3. Choose "Your number is not the one on my card.", then "I will call the number on my card." The
   call ends.
4. Open the phone. Inspect the call history (finds `ev.caller-number`; the number-mismatch note
   unlocks). Open the bank app (finds `ev.bank-app`; suspension becomes `inconclusive`). Close the
   phone.
5. Open the decision panel and choose "Call Northgate on the official number". Wait for an agent,
   report the call, then "Thank you. I will block that number." Three claims become
   `contradicted`.
6. Choose "Report the call and block the number" and confirm. Outcome `verified`, variant
   `verified.reported`.

### Risky: "Followed the caller's request"

Path A (money moved):

1. Do not interact. The first call rings after 60 s of exploration.
2. Answer. Choose "Yes, that is me. What is happening?". The code message arrives.
3. Read the code to the caller, then "Move the money as instructed."
4. The decision `follow-request` is recorded inside the call. Outcome `risky`, variant
   `risky.money-moved`.

Path B (code shared, then reported):

1. Open the mailbox (finds `ev.bank-letter`). The first call rings 3 s later.
2. Answer, choose "Yes, that is me…", read the code, then "Stop. This does not feel right." and
   "I am hanging up."
3. Call Northgate on the official number from the decision panel. Report the call, then say "I read
   a code from a text message to the caller." The bank locks the simulated account.
4. Choose "Report the call and block the number". The shared code still makes the outcome `risky`,
   variant `risky.code-shared-locked`.

### Uncertain: "Stopped, but did not confirm"

1. Wait 60 s for the first call. Decline it.
2. It rings again 20 s later. Answer and hang up straight away.
3. Open the phone and inspect the call history (finds `ev.caller-number`).
4. Choose "Block the number and leave it for now" and confirm. Outcome `uncertain`, variant
   `uncertain.stopped`. If the player waits 90 s without deciding, the callback rings first.

## 13. Content safety rules

These rules apply to every change to this chapter (see `.kiro/steering/` and `AGENTS.md`).

- **Fictional bank only.** "Northgate Bank" is invented. No real bank, brand or payment service
  appears.
- **Non-routable numbers.** All phone numbers use the `+000` prefix, which no country uses.
- **Reserved domains only.** The official website is `northgate.example`; the look-alike address
  is `northgate-secure-verify.invalid`. Neither is ever rendered as a link, fetched or loaded.
- **Never "safe".** No text says that a number, message, call or site is safe. The best ending is
  `verified` / "Checked through a trusted channel".
- **No usable fraud steps.** No real one-time code, account number or payment instruction appears.
  The code message never shows a code.
- **Every consequence is labelled as a simulation.** The balance and account are simulated.
- **No victim blaming and no fear as the main motivator.** The debrief describes what the scammer
  did and what the player can do next time.
- **Worldwide pattern.** No country-specific currency, phone format, payment method or reporting
  channel.
- **Works without AI and offline.** All lines are authored data; the core is deterministic.

## 14. Known limitations

- **Prop positions are not calibrated in a browser.** The values in `propLayout.ts` were placed
  from the play-area bounds only. Before release, check each prop with `pnpm dev:game` against
  the real street geometry (not inside a wall, not floating, not hidden) and record the final
  values.
- **Touch movement is not supported.** The chapter needs a keyboard and mouse. Touch movement
  controls are deferred.
- **Play time is not measured.** The target of 8 to 15 minutes is a content design target only.
- **`claim.protected-account` never changes status.** The poster and the alert point against it,
  but the official line does not set it, so it stays `unverified` in every run.
