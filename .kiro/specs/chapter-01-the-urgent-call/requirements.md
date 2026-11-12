# Requirements Document

## Introduction

This spec delivers one complete, playable Chapter 1 of SCAMMAZE: "The Urgent Call". The player
starts from the main menu, loads the chapter, sees a chapter title card, and spawns on a small
part of the existing street scene in first person. It is morning, before breakfast, and an urgent
text from the fictional "Northgate Bank" is already on the player's in-game smartphone. A caller
who claims to work for Northgate Bank security phones the player, applies time pressure, asks for
a one-time code and later asks the player to move money to a "protected holding account". The
player explores the street and the phone, collects evidence, verifies claims through independent
channels and makes a decision. One of three authored endings follows, then a debrief built only
from scenario data and recorded events. Progress is saved locally and can be continued, restarted
and replayed.

Scope decisions (owner, final for this task):

- Chapter 1 is "The Urgent Call" (bank-security impersonation). This matches the existing menu,
  `chapterRegistry.ts` and `IntroPrologueModal.tsx`. "The Missing Parcel" (in
  `docs/product/PRODUCT_POSITIONING.md` section 11) is a later chapter. This deviation from the
  positioning document is recorded in `docs/PROJECT_PROGRESS.md`.
- The setting is morning, consistent with the existing text "The notification arrives before
  breakfast."
- All dialogue is authored and deterministic. No AI, no backend, no network calls during gameplay.
- The brief's "SAFE" ending is named `verified` in code and "Checked through a trusted channel" in
  the UI, because repository rules forbid calling anything "safe".
- Target play time is 8 to 15 minutes. This is a content design target, not a measured result.
- Deferred: multiplayer, more chapters, live AI, backend, touch movement controls.

## Glossary

- **App_Shell**: `apps/game/src/app/App.tsx`, which switches between menu, chapter loading and
  chapter screens.
- **Chapter_Registry**: `apps/game/src/game/chapters/chapterRegistry.ts`, the list of chapter
  definitions including `gameplayAvailable`.
- **Chapter_Page**: the React screen that hosts Chapter 1 gameplay: canvas, HUD and overlays.
- **Chapter_Canvas**: the React Three Fiber canvas for Chapter 1 that renders the street, the
  first-person player and the interactable props.
- **Play_Area**: the bounded part of the street scene where the player can move, taken from the
  existing `/testmove` spawn and bounds.
- **Interactable**: a world object the player can use with the E key, defined by ID, position,
  radius, label and the core action it produces.
- **Interaction_System**: the code that finds the Interactable the player is looking at, shows the
  prompt and turns an E key press into a core action.
- **Chapter_Core**: the pure TypeScript, deterministic game core: state, actions, reducer,
  selectors. It imports no React, Three.js, Rapier, Zustand or Dexie.
- **Chapter_State**: the full narrative state held by the Chapter_Core.
- **Core_Action**: a typed action accepted by the Chapter_Core. The set is START_CHAPTER,
  INTERACT_OBJECT, INSPECT_EVIDENCE, OPEN_PHONE, CLOSE_PHONE, RING_CALL, ANSWER_CALL, END_CALL,
  TALK_TO_NPC, SELECT_DIALOGUE_OPTION, VERIFY_CLAIM, MAKE_DECISION, COMPLETE_OBJECTIVE and
  FINISH_CHAPTER.
- **Action_Result**: the value returned for every dispatched Core_Action: the next Chapter_State,
  whether the action was accepted and, when rejected, a reason string.
- **Event_Log**: the ordered list of accepted Core_Actions with derived details, kept in
  Chapter_State.
- **Chapter_Store**: a small framework-free store that holds the Chapter_State, dispatches
  Core_Actions and notifies subscribers.
- **Scenario_Data**: typed TypeScript data modules for Chapter 1: objectives, interactables,
  evidence, claims, dialogue graphs, decisions, endings and debrief text.
- **Scenario_Validator**: a pure function that checks Scenario_Data for broken references and
  unreachable endings.
- **Objective_Manager**: the part of the Chapter_Core that activates and completes objectives from
  accepted Core_Actions.
- **Phone_UI**: the in-game smartphone overlay built with React, HTML and CSS: home, incoming call,
  active call, messages, call history and the fictional Northgate Bank app.
- **Call**: one phone conversation; Chapter 1 has the first scam call, at most one callback from
  the same caller, and the player's call to the official Northgate line.
- **Call_Trigger**: UI-layer logic that decides when to dispatch RING_CALL (first interaction,
  exploration timer, re-ring after a declined call, callback).
- **Dialogue_Graph**: authored data for one conversation: persona, nodes, lines, options,
  conditions, effects and end nodes.
- **Dialogue_Engine**: the pure functions that evaluate a Dialogue_Graph against Chapter_State.
- **Evidence_Item**: one piece of evidence with ID, title, description, source, location,
  discovery condition, related claims with stances, warning signs and educational relevance.
- **Evidence_Registry**: the set of Evidence_Items in Scenario_Data plus the functions that
  discover and look them up.
- **Evidence_Journal**: the overlay that lists discovered Evidence_Items and claim statuses.
- **Claim**: a statement made by the caller that the player can check, for example "the caller
  works for Northgate Bank".
- **Stance**: how an Evidence_Item relates to a Claim: `supports`, `contradicts`, `inconclusive`
  or `needs-verification`.
- **Decision**: the consequential choice of the chapter: `follow-request`,
  `verify-independently` or `stop-and-wait`.
- **Consequence_Flag**: a boolean fact set by player choices, for example `code_shared` or
  `money_moved`. All consequences are simulated and fictional.
- **Outcome**: one of `verified`, `risky` or `uncertain`, chosen by a pure function of
  Chapter_State.
- **Debrief_Screen**: the outcome-specific review shown after the ending transition.
- **Save_System**: `apps/game/src/game/saves/` code that reads, validates, migrates and writes
  local saves.
- **Checkpoint**: a saved point in the chapter, written when an objective changes while no Call is
  ringing or active.
- **Overlay**: any UI layer that takes input away from movement: title card, phone, journal,
  dialogue, decision panel, pause menu, ending transition, debrief.
- **Reserved_Address**: a domain ending in `.test`, `.example` or `.invalid`, `example.com`, or an
  IP in `192.0.2.0/24`, `198.51.100.0/24` or `203.0.113.0/24`.
- **Fictional_Phone_Number**: a phone number that starts with `+000`. Country code 0 is not
  assigned to any country, so the number cannot be dialled.

## Requirements

### Requirement 1: Chapter entry and flow

**User Story:** As a player, I want to go from the main menu into a playable Chapter 1, so that
New Game leads to real gameplay instead of a placeholder.

#### Acceptance Criteria

1. THE Chapter_Registry SHALL set `gameplayAvailable` to `true` for `chapter-1`.
2. WHEN the chapter loading flow completes for a chapter whose `gameplayAvailable` is `true`, THE
   App_Shell SHALL render the Chapter_Page for that chapter.
3. WHEN the chapter loading flow completes for a chapter whose `gameplayAvailable` is `false`, THE
   App_Shell SHALL render the existing ChapterPlaceholder.
4. WHEN the Chapter_Page mounts, THE Chapter_Page SHALL show the chapter title card with the
   chapter number, the title "The Urgent Call" and the subtitle from the Chapter_Registry.
5. WHILE the Chapter_Canvas has not reported scene readiness, THE Chapter_Page SHALL keep the
   title card's begin button disabled and show the text "Preparing the street".
6. WHEN the player activates the title card's begin button, THE Chapter_Page SHALL dispatch
   START_CHAPTER and close the title card.
7. WHEN the player chooses to return to the menu from the Chapter_Page, THE App_Shell SHALL show
   the main menu and refresh the Continue availability.

### Requirement 2: Chapter play area

**User Story:** As a player, I want to walk around a small part of the street in first person, so
that the scam reaches me inside a world and not in a quiz.

#### Acceptance Criteria

1. THE Chapter_Canvas SHALL render the existing street environment, sky dome, environment
   lighting and first-person player.
2. THE Chapter_Canvas SHALL spawn the player at position `[188.6, -92.70, -88.89]` with yaw π for
   a new chapter.
3. THE Chapter_Canvas SHALL limit player movement to the bounds `minX 180`, `maxX 198.5`,
   `minZ -92`, `maxZ 52`, `groundY -92.70`.
4. WHEN the street environment reports `onReady` after shader compilation, THE Chapter_Canvas
   SHALL report scene readiness to the Chapter_Page.
5. THE Chapter_Canvas SHALL render at least five Interactables inside the Play_Area bounds.
6. WHEN the player punches, THE Chapter_Core SHALL keep the Chapter_State unchanged.

### Requirement 3: Interactions

**User Story:** As a player, I want to see what I can use and use it with one key, so that
exploring the street is clear and reliable.

#### Acceptance Criteria

1. WHILE no Overlay is open, THE Interaction_System SHALL select as focused the nearest
   Interactable whose bounding sphere is hit by the camera view ray within 3.0 metres.
2. IF no Interactable's bounding sphere is hit within 3.0 metres, THEN THE Interaction_System
   SHALL report no focused Interactable.
3. WHILE an Interactable is focused, THE Chapter_Page SHALL show a text prompt "Press E to
   <action label> <object label>".
4. WHEN the player presses E while an Interactable is focused, THE Interaction_System SHALL
   dispatch the Core_Action defined for that Interactable exactly once per key press.
5. WHEN the player presses E while no Interactable is focused, THE Interaction_System SHALL
   dispatch no Core_Action.
6. WHEN an INTERACT_OBJECT action is accepted, THE Chapter_Page SHALL show the object's authored
   inspection text in a dismissible panel.
7. THE Interactable set SHALL include a wallet with the bank card, a mailbox with a bank letter, a
   bank notice poster in the shop window, the shopkeeper at the shop counter and a community
   notice board.

### Requirement 4: Input, pointer lock and overlays

**User Story:** As a player, I want movement to stop while I read the phone or a panel and resume
cleanly afterwards, so that I never walk around by accident or get stuck without a cursor.

#### Acceptance Criteria

1. WHEN an Overlay opens, THE Chapter_Page SHALL release pointer lock and disable player movement,
   look, punch and interact input.
2. WHILE player input is disabled, THE player controls SHALL clear all held movement keys and
   ignore key and mouse input for movement, look, punch and interact.
3. WHILE player input is disabled, THE player controls SHALL keep the pointer unlocked on mouse
   down.
4. WHEN the last open Overlay closes, THE Chapter_Page SHALL re-enable player input and show the
   text prompt "Click to resume" until pointer lock is active again.
5. WHEN the player clicks the game view while the "Click to resume" prompt is shown, THE
   Chapter_Page SHALL request pointer lock.
6. WHEN the player presses Escape while an Overlay other than the title card, ending transition or
   debrief is open, THE Chapter_Page SHALL close the top-most Overlay.
7. WHEN the player presses Escape while no Overlay is open, THE Chapter_Page SHALL open the pause
   menu.
8. WHEN the player presses P while no Overlay other than the phone is open, THE Chapter_Page SHALL
   toggle the Phone_UI.
9. WHEN the player presses J while no Overlay other than the journal is open, THE Chapter_Page
   SHALL toggle the Evidence_Journal.
10. THE Chapter_Page SHALL show on-screen buttons for the phone and the journal that work with
    mouse and keyboard.

### Requirement 5: Deterministic chapter core

**User Story:** As a developer, I want all narrative rules in one pure, deterministic core, so
that outcomes are testable and the world and UI cannot corrupt the story state.

#### Acceptance Criteria

1. THE Chapter_State SHALL contain chapter ID, chapter status, active and completed objective IDs,
   phone status, call status, current conversation and node, conversation history, NPC
   conversation state, discovered evidence IDs, claim statuses, Decision, Consequence_Flags,
   pressure level from 0 to 3, Outcome and Event_Log.
2. WHEN a Core_Action is dispatched, THE Chapter_Core SHALL return an Action_Result.
3. IF a Core_Action is not valid for the current Chapter_State, THEN THE Chapter_Core SHALL return
   the unchanged Chapter_State, `accepted: false` and a non-empty reason.
4. IF a dispatched value is not a known Core_Action shape, THEN THE Chapter_Core SHALL reject the
   value with the reason "Unknown action."
5. THE Chapter_Core SHALL compute the next Chapter_State only from the current Chapter_State, the
   Core_Action and Scenario_Data.
6. WHEN a Core_Action is accepted, THE Chapter_Core SHALL append one entry to the Event_Log.
7. THE Chapter_Core SHALL import no React, Three.js, Rapier, Zustand or Dexie module.
8. THE Chapter_Store SHALL notify subscribers only when a dispatched Core_Action is accepted.
9. WHILE the Outcome is set, THE Chapter_Core SHALL reject every Core_Action except FINISH_CHAPTER.

### Requirement 6: Objectives

**User Story:** As a player, I want a clear current objective that follows what I actually did,
so that I always know what to do next.

#### Acceptance Criteria

1. WHEN START_CHAPTER is accepted, THE Objective_Manager SHALL activate the objective "Look around
   your street."
2. WHEN the first INTERACT_OBJECT action is accepted, THE Objective_Manager SHALL complete the
   objective "Look around your street."
3. WHEN RING_CALL is accepted, THE Objective_Manager SHALL activate the objective "Your phone is
   ringing. Answer it or decline it."
4. WHEN ANSWER_CALL is accepted for the first scam Call, THE Objective_Manager SHALL complete the
   ringing objective.
5. WHEN the first scam Call ends after being answered, THE Objective_Manager SHALL activate the
   objectives "Check what the caller told you." and "Decide what to do about the caller's
   request."
6. WHEN the player has discovered at least two Evidence_Items that relate to a Claim, THE
   Objective_Manager SHALL complete the objective "Check what the caller told you."
7. WHEN MAKE_DECISION is accepted, THE Objective_Manager SHALL complete the decision objective and
   activate the objective "Review what happened."
8. IF a COMPLETE_OBJECTIVE action names an objective whose completion condition is not met, THEN
   THE Objective_Manager SHALL reject the action with the reason "Objective condition not met."
9. THE Objective_Manager SHALL keep activation and completion unchanged by OPEN_PHONE,
   CLOSE_PHONE and opening or closing the Evidence_Journal.
10. WHEN an objective is activated or completed, THE Chapter_Page SHALL show an objective toast
    and announce the objective text through an `aria-live="polite"` region.

### Requirement 7: Smartphone

**User Story:** As a player, I want a believable in-game smartphone, so that I can read messages,
see who called and check my bank app like on a real phone.

#### Acceptance Criteria

1. WHEN OPEN_PHONE is accepted, THE Phone_UI SHALL open on the home screen with the apps Messages,
   Calls and Northgate Bank.
2. WHEN START_CHAPTER is accepted, THE Phone_UI SHALL show one unread message in Messages: the
   urgent Northgate text from the prologue.
3. THE Phone_UI SHALL render every domain and phone number as plain text and never as a link.
4. WHEN the player opens a message, a call history entry or the Northgate Bank app screen linked to
   an Evidence_Item, THE Phone_UI SHALL dispatch INSPECT_EVIDENCE for that Evidence_Item.
5. THE Phone_UI SHALL list Calls in the call history with caller name as shown, Fictional_Phone_Number,
   and status answered, declined or missed.
6. THE Phone_UI SHALL be fully usable with mouse and with keyboard (Tab, Shift+Tab, Enter, Space,
   Escape).
7. WHILE the viewport is narrower than 640 CSS pixels, THE Phone_UI SHALL fill the viewport width.
8. WHILE the viewport is at least 640 CSS pixels wide, THE Phone_UI SHALL render as a phone frame
   at most 380 CSS pixels wide.
9. THE Phone_UI SHALL use the brand tokens Graphite #171521, Navy #1D1B2B, Purple #7654D6,
   Lavender #B9A5F5, Ivory #F7F5FF, Mist #A9A4C4, Amber #F2B24B and Teal #4FD1B5.

### Requirement 8: Incoming call and re-ring

**User Story:** As a player, I want the scam call to reach me in every play-through, so that I
cannot miss the chapter's main event and get stuck.

#### Acceptance Criteria

1. WHEN the first INTERACT_OBJECT action is accepted and the first scam Call has not rung, THE
   Call_Trigger SHALL dispatch RING_CALL for the first scam Call within 4 seconds.
2. WHEN 60 seconds of unpaused gameplay have passed after START_CHAPTER and the first scam Call has
   not rung, THE Call_Trigger SHALL dispatch RING_CALL for the first scam Call.
3. WHEN RING_CALL is accepted, THE Phone_UI SHALL open the incoming call screen showing the caller
   name "Northgate Bank Security", the Fictional_Phone_Number `+000 555 0142`, an Accept button
   and a Decline button.
4. WHEN the player declines the ringing first scam Call, THE Call_Trigger SHALL dispatch RING_CALL
   for the first scam Call again after 20 seconds of unpaused gameplay.
5. WHEN the first scam Call has ended after being answered, no Decision exists and 90 seconds of
   unpaused gameplay have passed, THE Call_Trigger SHALL dispatch RING_CALL for the callback Call.
6. IF RING_CALL is dispatched for the callback Call after the callback Call has already rung, THEN
   THE Chapter_Core SHALL reject the action.
7. WHILE a Call is ringing, THE Chapter_Page SHALL show a visible text caption "Incoming call" in
   addition to any animation.
8. IF ANSWER_CALL is dispatched while no Call is ringing, THEN THE Chapter_Core SHALL reject the
   action with the reason "No call is ringing."

### Requirement 9: Dialogue engine

**User Story:** As a content author, I want a deterministic dialogue engine driven by data, so
that conversations branch on evidence and flags and always end.

#### Acceptance Criteria

1. THE Dialogue_Graph SHALL define a persona, a start node, nodes with speaker and line, options
   with conditions and effects, and end nodes.
2. WHEN a conversation starts, THE Dialogue_Engine SHALL set the current node to the
   Dialogue_Graph's start node.
3. THE Dialogue_Engine SHALL list as available only the options whose conditions hold for the
   current Chapter_State.
4. IF a node that is not an end node has no available option, THEN THE Dialogue_Engine SHALL offer
   the fallback option "End the conversation" that ends the conversation.
5. WHEN SELECT_DIALOGUE_OPTION names an available option, THE Dialogue_Engine SHALL apply the
   option's effects in authored order and move to the option's next node.
6. IF SELECT_DIALOGUE_OPTION names an option that is not available at the current node, THEN THE
   Chapter_Core SHALL reject the action with the reason "Option not available."
7. WHEN SELECT_DIALOGUE_OPTION is accepted, THE Dialogue_Engine SHALL append the node ID and option
   ID to the conversation history.
8. THE Scenario_Validator SHALL report an error for every option or start reference to a node ID
   that does not exist in the same Dialogue_Graph.
9. THE Scenario_Validator SHALL report an error for every node from which no end node is reachable.
10. THE Dialogue_Engine SHALL look up every displayed line through an approved line ID, so that a
    future wording adapter can only replace text for approved line IDs.

### Requirement 10: Chapter 1 conversations

**User Story:** As a player, I want the caller and the people on my street to react to what I
know, so that investigating changes the conversation.

#### Acceptance Criteria

1. THE first scam Call Dialogue_Graph SHALL contain at least three distinct paths from the start
   node to end nodes: sharing the code, challenging the caller, and ending the call to verify.
2. WHERE the player has discovered the bank card or the bank letter before the first scam Call,
   THE first scam Call Dialogue_Graph SHALL offer the option to point out that the caller's number
   differs from the official number.
3. WHEN the caller's dialogue reaches the code request node, THE Chapter_Core SHALL deliver the
   one-time-code message to Messages and make its Evidence_Item discoverable.
4. WHEN the player selects the option that reads the code to the caller, THE Chapter_Core SHALL
   set the Consequence_Flag `code_shared`.
5. WHEN the player selects the option that moves money as the caller instructs, THE Chapter_Core
   SHALL set the Consequence_Flag `money_moved` and record the Decision `follow-request`.
6. WHEN the caller's dialogue reaches a pressure node, THE Chapter_Core SHALL increase the pressure
   level by 1 up to a maximum of 3.
7. WHEN TALK_TO_NPC is accepted for the shopkeeper, THE Chapter_Core SHALL start the shopkeeper
   Dialogue_Graph at the start node that matches whether the first scam Call has ended.
8. WHEN VERIFY_CLAIM with method `official-line` is accepted, THE Chapter_Core SHALL start the
   official Northgate line Dialogue_Graph as a Call.
9. THE Scenario_Data SHALL contain no step-by-step instructions, real account details, real codes
   or real payment methods that could be used for fraud.

### Requirement 11: Evidence and journal

**User Story:** As a player, I want to collect and review evidence from the street and my phone,
so that I can compare what the caller said with what I can check.

#### Acceptance Criteria

1. THE Evidence_Registry SHALL contain at least four Evidence_Items from at least two sources, with
   at least one physical-world item and at least one device item.
2. THE Evidence_Item SHALL define ID, title, description, source, location, discovery condition,
   related Claims with Stance, warning signs and educational relevance.
3. WHEN an action meets an Evidence_Item's discovery condition, THE Evidence_Registry SHALL add the
   Evidence_Item ID to the discovered evidence once.
4. IF INSPECT_EVIDENCE names an Evidence_Item whose discovery condition is not met, THEN THE
   Chapter_Core SHALL reject the action with the reason "Evidence not available yet."
5. IF INSPECT_EVIDENCE names an Evidence_Item that is already discovered, THEN THE Chapter_Core
   SHALL reject the action with the reason "Evidence already recorded." and keep the Chapter_State
   unchanged.
6. WHEN an Evidence_Item is discovered, THE Chapter_Page SHALL show a short text notice with the
   Evidence_Item title.
7. THE Evidence_Journal SHALL list only discovered Evidence_Items, in discovery order.
8. THE Evidence_Journal SHALL show for each discovered Evidence_Item its title, description,
   source, location and Stance toward each related Claim as text.
9. THE Evidence_Journal SHALL describe a `contradicts` Stance as "Points against this claim" and
   not as proof.
10. THE Evidence_Registry SHALL contain a contradiction chain in which the caller's number differs
    from the official number on the bank card and the bank letter, and the official Northgate line
    reached through that official number contradicts the caller's identity Claim.

### Requirement 12: Claims and verification

**User Story:** As a player, I want to check the caller's claims through channels I already trust,
so that I learn to verify instead of guessing.

#### Acceptance Criteria

1. THE Scenario_Data SHALL define the Claims: the caller works for Northgate Bank; the account is
   suspended; the bank needs the one-time code to stop a transfer; moving money to a protected
   holding account protects it.
2. WHEN START_CHAPTER is accepted, THE Chapter_Core SHALL set every Claim status to `unverified`.
3. WHEN VERIFY_CLAIM with method `official-line` is dispatched and neither the bank card nor the
   bank letter is discovered, THE Chapter_Core SHALL reject the action with the reason "You need
   the bank's official number first."
4. WHEN the official Northgate line conversation reaches its confirmation node, THE Chapter_Core
   SHALL discover the official confirmation Evidence_Item and set the caller identity Claim status
   to `contradicted`.
5. WHEN VERIFY_CLAIM with method `bank-app` is accepted, THE Chapter_Core SHALL discover the bank
   app Evidence_Item and set the account suspended Claim status to `inconclusive`.
6. THE Chapter_Core SHALL change a Claim status to `contradicted` only through a verification step
   that uses an independent channel.

### Requirement 13: Decisions, consequences and outcomes

**User Story:** As a player, I want my decision to change how the chapter ends, so that the
consequences of following or checking a request are clear.

#### Acceptance Criteria

1. WHILE the first scam Call has ended and no Decision exists, THE Chapter_Page SHALL offer a
   decision panel from the phone and the journal.
2. THE decision panel SHALL offer "Call the number back and do what the caller asks",
   "Call Northgate on the official number" and "Block the number and leave it for now".
3. WHERE neither the bank card nor the bank letter is discovered, THE decision panel SHALL show the
   option "Call Northgate on the official number" as unavailable with the hint "You need the bank's
   official number. Where might you find it?"
4. IF MAKE_DECISION `verify-independently` is dispatched before the official confirmation
   Evidence_Item is discovered, THEN THE Chapter_Core SHALL reject the action.
5. IF MAKE_DECISION is dispatched while a Decision already exists, THEN THE Chapter_Core SHALL
   reject the action with the reason "A decision has already been made."
6. WHEN MAKE_DECISION is accepted, THE Chapter_Core SHALL set the Outcome by the outcome
   function.
7. THE outcome function SHALL return `risky` when a Decision exists and `code_shared` or
   `money_moved` is set.
8. WHEN MAKE_DECISION `follow-request` is accepted from the decision panel, THE Chapter_Core SHALL
   set the Consequence_Flag `money_moved`.
9. THE outcome function SHALL return `verified` when neither `code_shared` nor `money_moved` is
   set, the Decision is `verify-independently` and the caller identity Claim is `contradicted`.
10. THE outcome function SHALL return `uncertain` when neither `code_shared` nor `money_moved` is
    set and the Decision is `stop-and-wait`.
11. THE Chapter_Page SHALL label every simulated consequence with the text "Simulation: nothing
    real happened."
12. THE Scenario_Data SHALL describe the `uncertain` Outcome as a partial result with an
    explanation and not as a failure.

### Requirement 14: Ending transition and debrief

**User Story:** As a player, I want a debrief that explains what happened in my play-through, so
that I learn the pattern and can try again.

#### Acceptance Criteria

1. WHEN the Outcome is set, THE Chapter_Page SHALL show the ending transition with the Outcome
   title and its authored consequence text.
2. WHEN the player continues from the ending transition, THE Chapter_Page SHALL dispatch
   FINISH_CHAPTER and show the Debrief_Screen.
3. THE Debrief_Screen SHALL show the Outcome, the decisions made, the Evidence_Items found, the
   warning signs noticed, the clues missed, the scam mechanism, safer alternatives, a replay button
   and a return to menu button.
4. THE Debrief_Screen SHALL build every listed decision, Evidence_Item, warning sign and missed
   clue only from Scenario_Data and the Event_Log.
5. THE Debrief_Screen SHALL list as clues missed exactly the Evidence_Items with a debrief hint that
   were not discovered.
6. THE Scenario_Data debrief text SHALL describe what the scammer did and what the player can do
   next time, without blaming the player.

### Requirement 15: Save, continue, restart and replay

**User Story:** As a player, I want my progress kept on this device, so that I can continue after
a reload or start over when I want.

#### Acceptance Criteria

1. WHEN an objective is activated or completed while no Call is ringing or active, THE Save_System
   SHALL write a Checkpoint to local storage.
2. WHEN a Call ends after an objective changed during that Call, THE Save_System SHALL write a
   Checkpoint.
3. THE Checkpoint SHALL contain format version 2, chapter ID, scene ID, ISO 8601 save time,
   checkpoint ID, the accepted Core_Actions up to the Checkpoint and the player position clamped to
   the Play_Area bounds.
4. THE Checkpoint SHALL contain no personal data and no free text entered by the player.
5. WHEN a Checkpoint is restored, THE Save_System SHALL rebuild the Chapter_State by replaying the
   saved Core_Actions from the initial Chapter_State.
6. IF any saved Core_Action is rejected during replay, THEN THE Save_System SHALL report the save as
   invalid and THE App_Shell SHALL keep Continue unavailable.
7. IF a saved player position has a non-finite coordinate, THEN THE Save_System SHALL report the
   save as invalid.
8. FOR ALL Chapter_States produced by accepted Core_Action sequences, writing a Checkpoint then
   restoring it SHALL produce an equal Chapter_State (round-trip property).
9. WHEN a format version 1 save exists and no format version 2 save exists, THE Save_System SHALL
   migrate the version 1 save to a version 2 Checkpoint at the chapter start.
10. IF a save has an unknown format version, THEN THE Save_System SHALL report the save as invalid.
11. WHILE a valid Checkpoint exists, THE main menu SHALL enable Continue.
12. WHEN the player continues, THE Chapter_Page SHALL restore the Chapter_State and player position
    from the Checkpoint and skip the title card's chapter intro text.
13. WHEN the player confirms Restart chapter or Replay, THE Save_System SHALL delete the chapter
    progress and THE Chapter_Page SHALL start a new chapter from the initial Chapter_State.
14. IF local storage is unavailable, THEN THE Save_System SHALL continue gameplay without saving
    and THE Chapter_Page SHALL show the notice "Progress cannot be saved on this device."

### Requirement 16: Content safety and audience

**User Story:** As the project owner, I want the chapter content to follow the safety and audience
rules, so that it teaches without harm for players in Vietnam and worldwide.

#### Acceptance Criteria

1. THE Scenario_Data SHALL use only the fictional bank name "Northgate Bank" and fictional people.
2. THE Scenario_Data SHALL use only Reserved_Addresses for domains and IP addresses.
3. THE Scenario_Data SHALL use only Fictional_Phone_Numbers for phone numbers.
4. THE Scenario_Data SHALL contain no currency symbol, currency code or country-specific payment
   method in user-facing text.
5. THE Scenario_Data and Chapter_Page user-facing text SHALL not call any URL, message, caller or
   website "safe".
6. THE Chapter_Page SHALL use no emoji as icons and SHALL use `lucide-react` icons or CSS shapes.
7. THE Scenario_Data SHALL write all user-facing text in plain English as complete sentences
   without string concatenation of sentence fragments.

### Requirement 17: Presentation and accessibility

**User Story:** As a player, I want restrained, readable visuals and full keyboard support, so
that the chapter is comfortable and accessible.

#### Acceptance Criteria

1. WHILE the user's system requests reduced motion, THE Chapter_Page SHALL replace slide, shake
   and fade animations with instant changes.
2. WHEN an Overlay opens, THE Chapter_Page SHALL move keyboard focus to the Overlay's first
   interactive element or heading.
3. WHEN an Overlay closes, THE Chapter_Page SHALL return keyboard focus to the element that opened
   the Overlay or to the game view.
4. THE Chapter_Page SHALL give every icon-only button an accessible name.
5. THE Chapter_Page SHALL mark decorative icons with `aria-hidden="true"`.
6. THE Chapter_Page SHALL show Evidence_Item stance, Call status and Outcome with text labels in
   addition to color.
7. WHILE the Chapter_Page is shown, THE App_Shell SHALL fade out the menu music and keep the street
   ambient audio.
8. WHEN the App_Shell returns to the main menu, THE App_Shell SHALL restore the menu music
   behavior that existed before this feature.

### Requirement 18: Testing and quality gates

**User Story:** As a developer, I want automated tests for the chapter, so that all three endings
stay reachable and the core cannot reach an invalid state.

#### Acceptance Criteria

1. THE test suite SHALL include unit tests for state transitions, invalid actions, objectives,
   evidence discovery, dialogue branches, decisions, outcomes and save validation.
2. THE test suite SHALL include scripted end-to-end runs through the Chapter_Core that reach the
   `verified`, `risky` and `uncertain` Outcomes.
3. FOR ALL random Core_Action sequences generated from a fixed seed, THE Chapter_Core SHALL return
   an Action_Result without throwing and every resulting Chapter_State SHALL satisfy the state
   invariants.
4. FOR ALL Chapter_States reachable by random Core_Action sequences, a sequence of accepted
   Core_Actions to an Outcome SHALL exist (no soft-lock property).
5. FOR ALL Core_Action sequences, dispatching the same sequence twice from the initial
   Chapter_State SHALL produce equal Chapter_States (determinism property).
6. THE test suite SHALL include integration tests for interaction to core, phone to dialogue,
   evidence to decision, consequence to debrief and save to restore.
7. WHEN the work is complete, THE commands `pnpm test`, `pnpm typecheck` and `pnpm build` SHALL
   pass, and the results SHALL be reported as observed.

### Requirement 19: Documentation

**User Story:** As a team member, I want the documentation to match the implementation, so that
the next person knows what exists and what was deferred.

#### Acceptance Criteria

1. WHEN the feature is complete, THE `docs/PROJECT_PROGRESS.md` file SHALL contain a task history
   entry with the nine items required by AGENTS.md section 6.
2. THE `docs/PROJECT_PROGRESS.md` entry SHALL record the deviation that Chapter 1 is "The Urgent
   Call" instead of "The Missing Parcel" from the product positioning document.
3. WHEN the feature is complete, THE `docs/architecture/OVERVIEW.md` file SHALL describe the
   Chapter_Core, the Chapter_Store, the Save_System version 2 and the Chapter_Page with correct
   status labels.
4. WHEN the feature is complete, THE file `docs/gameplay/CHAPTER_01_THE_URGENT_CALL.md` SHALL
   describe the story, Interactables, Evidence_Items, Claims, Dialogue_Graphs, Decisions, Outcomes
   and debrief content.
