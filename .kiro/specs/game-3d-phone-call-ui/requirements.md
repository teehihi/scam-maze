# Requirements Document

## Introduction

This feature changes how phone calls are presented in Chapter 1 ("The Urgent Call") of the
SCAMMAZE game app (`apps/game`). Today a ringing or active call renders inside the flat 2D phone
panel (`features/chapter1/phone/PhoneOverlay.tsx`): `ChapterOnePage.tsx` builds a `callSlot`
with `IncomingCallScreen` or `CallScreen`, and `CallScreen` embeds the shared `DialoguePanel`,
so the player's response options are rendered inside the phone screen.

After this feature:

1. A ringing or active call is presented on a 3D phone model loaded from a local `.glb` file
   through the existing React Three Fiber and Drei pipeline.
2. The phone screen shows only phone-owned content: the call label, caller name, phone number,
   call status, call avatar icon, the caller's dialogue line, and the call buttons (Accept and
   Decline while ringing, Hang up while active).
3. The player's response options are rendered outside the phone, in a game overlay near the
   bottom of the viewport.
4. The game still works when the 3D phone cannot render (no WebGL, model load failure): a 2D
   phone screen is shown instead, and the options stay outside the phone.

The change is presentation only. The deterministic narrative core (`apps/game/src/game/narrative/`)
keeps owning call state, dialogue state, evidence, decisions and outcomes. The existing actions
(`ANSWER_CALL`, `SELECT_DIALOGUE_OPTION`, `END_CALL`) and selectors (`selectDialogueView`, call
state) are reused without new state stores.

Context and constraints (recorded so the spec is self-contained):

- Work happens on branch `feat/game-3d-phone-call-ui`, created from `feat/game-i18n-en-vi`
  (commit `0610f65`), which holds Chapter 1 and the en/vi localization and is not merged to
  `main` yet. The pull request for this feature depends on that branch.
- Two candidate models were added by the owner in `apps/game/public/assets/3d/props/phone/`:
  `iphone-17-pro.glb` (about 25.7 MB, creator not stated) and `phone-17-pro-max.glb` (about
  25.3 MB, creator "Ranguel"). License per owner statement of 2026-11-12: free to use (see
  `SOURCE.md` in that folder). Neither is used by code yet. The design phase picks one model
  after inspecting its node, mesh and material names for screen geometry and visible branding.
- Both models depict a real branded product. The audience rule requires fictional brands only,
  so real brand names and logos must not be visible in the game.
- Out of scope: the non-call phone apps (home, Messages, Call history, Bank app, Decide button)
  keep the current 2D `PhoneOverlay` presentation; the face-to-face dialogue with Sam keeps the
  current `DialoguePanel` presentation; no new chapters, calls, dialogue content or AI features.
- Steering rules apply: no emoji as icons (use `lucide-react`), fictional numbers (`+000 ...`)
  and reserved domains as plain text, never call a number, message or URL "safe", all
  user-facing text through i18next keys in `en` and `vi`, no string concatenation, core playable
  offline without AI.

Open decisions for the owner:

1. Only the call presentation (ringing and active) moves to 3D; other phone apps keep the 2D
   `PhoneOverlay`.
2. Numeric targets (5 MB model, 200–600 ms entry, 30 fps floor, 4 CSS px alignment) are
   proposed, not measured.
3. Requirement 9.12: the chapter should stay playable if the phone model download fails (may
   need an "optional asset" flag in the chapter loader).
4. The two unoptimized ~25 MB candidate files stay in `apps/game/public/` and will be copied
   into `dist` by Vite; the owner decides whether to move them out of `public/`.

## Glossary

- **Game_App**: The React application in `apps/game`.
- **Chapter_Page**: `features/chapter1/ChapterOnePage.tsx`, which owns the overlay stack, wires
  the narrative store to the UI and renders the chapter canvas.
- **Chapter loader**: The code that downloads the assets listed for a chapter in
  `apps/game/src/game/chapters/chapterRegistry.ts` and shows the chapter loading screen before
  the Chapter_Page is entered.
- **Narrative_Core**: The deterministic code in `apps/game/src/game/narrative/` (reducer,
  selectors, dialogue engine). It must not import React, Three.js or i18n modules.
- **Call**: One phone call defined in the Chapter 1 scenario data, with a display name and a
  Fictional_Phone_Number.
- **Call_Status**: The Narrative_Core call status: `ringing` or `active` while a Call is busy.
- **Call_Presentation**: The UI shown while a Call is `ringing` or `active`. It consists of the
  Phone_Model_View or the Fallback_Phone_Screen, plus the Choice_Overlay.
- **Phone_Model**: The selected 3D phone `.glb` asset after optimization.
- **Phone_Model_View**: The React Three Fiber component that renders the Phone_Model during a
  Call.
- **Phone_Screen_UI**: The HTML content shown on the phone screen during a Call. It contains only
  Phone_Owned_Content.
- **Phone_Owned_Content**: The call label, caller name, Fictional_Phone_Number, Call_Status
  text, call avatar icon, the Caller_Line, and the call buttons (Accept and Decline while
  ringing; Hang up while active).
- **Caller_Line**: The current dialogue line and speaker label from `selectDialogueView` when the
  speaker is the caller.
- **Dialogue_Option**: One player response option in the current dialogue node, from
  `selectDialogueView(state).options`.
- **Choice_Overlay**: The HUD overlay outside the phone that lists the Dialogue_Options of the
  active Call.
- **Fallback_Phone_Screen**: A 2D HTML phone screen that shows the Phone_Screen_UI when the
  Phone_Model_View cannot render.
- **Screen_Anchor**: The position, rotation and size on the Phone_Model where the Phone_Screen_UI
  is placed, taken from screen geometry in the model or from a documented fixed transform.
- **Fictional_Phone_Number**: A phone number in the reserved `+000` format used by the scenario
  data, shown as plain text and never as a link.
- **Player_Controller**: `FirstPersonPlayer` in the chapter canvas, with its `enabled` prop.
- **Reduced_Motion**: The state where the user's `prefers-reduced-motion: reduce` media query
  matches, read through `usePrefersReducedMotion`.
- **Asset_Credits**: The credits list in `apps/game/src/config/credits.ts`.
- **Locale_Dictionaries**: The i18next translation files in
  `apps/game/src/i18n/locales/{en,vi}/**`. English (`en`) is the source and fallback; the `vi`
  files are typed against the English ones.
- **Translation_Key**: The identifier of one user-facing text in the Locale_Dictionaries (for
  example `dialogue.optionsLabel` in the `chapter1` namespace), resolved through i18next for the
  selected locale.
- **Interpolation_Variables**: Named placeholders inside a translated string (for example
  `{{name}}`) that i18next fills with runtime values, so a sentence is never built by
  concatenation.
- **Dimming layer**: A semi-transparent layer drawn over the 3D world, behind the phone and the
  Choice_Overlay, that darkens the scene while the Call_Presentation is open.
- **Developer**: The person or AI coding agent who implements, tests, commits and documents this
  feature.

## Requirements

### Requirement 1: 3D phone presentation for calls

**User Story:** As a player, I want an incoming or active call to appear on a 3D phone in front of me, so that the call feels like part of the game world instead of a flat panel.

#### Acceptance Criteria

1. WHEN the Call_Status of the current Call becomes `ringing`, or the Chapter_Page mounts while the current Call is `ringing` or `active`, THE Chapter_Page SHALL show the Call_Presentation with the Phone_Model_View within one rendered frame, unless Requirement 8 requires the Fallback_Phone_Screen.
2. WHILE a Call is `ringing` or `active` and the Phone_Model_View is rendered, THE Chapter_Page SHALL render the Phone_Screen_UI on the Phone_Model_View, SHALL render no Phone_Owned_Content inside the 2D `PhoneOverlay` frame, and SHALL show exactly one copy of the Phone_Owned_Content in the document.
3. WHILE a Call is `ringing` or `active`, THE Phone_Model_View SHALL keep the whole visible phone screen area inside the viewport at the framed position for viewport widths from 320 to 2560 CSS pixels and viewport heights from 480 to 1600 CSS pixels, in both portrait and landscape orientation.
4. WHEN the viewport is resized while a Call is `ringing` or `active`, THE Phone_Model_View SHALL reframe the phone within 1 rendered frame after the resize event so that criterion 3 holds again for the new viewport size.
5. WHILE a Call is `ringing` or `active`, THE Phone_Model_View SHALL render the Caller_Line, the caller display name, the Fictional_Phone_Number, the Call_Status text and the call button labels at a computed on-screen size of at least 14 CSS pixels at the framed position, for every viewport size listed in criterion 3.
6. THE Phone_Model_View SHALL render inside the chapter's existing React Three Fiber canvas, SHALL add no second WebGL canvas, SHALL reuse the chapter's existing lights without adding a new light source or environment map, and SHALL add no second post-processing pipeline.
7. WHEN no Call is `ringing` or `active`, THE Chapter_Page SHALL remove the Phone_Model_View and the Phone_Screen_UI from the render tree within one rendered frame after the Call_Status leaves `ringing` and `active`.

### Requirement 2: Phone screen shows only phone-owned content

**User Story:** As a player, I want the phone screen to show only what a real phone shows during a call, so that I can tell what the caller says apart from what I can answer.

#### Acceptance Criteria

1. WHILE a Call is `ringing`, THE Phone_Screen_UI SHALL show exactly these items: the incoming-call label, the caller display name, the Fictional_Phone_Number, the call avatar icon, an Accept button and a Decline button. It SHALL show no Caller_Line, no Call_Status text and no Hang up button.
2. WHILE a Call is `active` and a dialogue node is linked to the Call, THE Phone_Screen_UI SHALL show exactly these items: the caller display name, the Fictional_Phone_Number, the Call_Status text, the call avatar icon, the Caller_Line (speaker label and line text) and a Hang up button. It SHALL show no Accept button and no Decline button.
3. WHILE a Call is `ringing` or `active`, THE Phone_Screen_UI SHALL contain zero Dialogue_Option controls and zero other elements with the button role apart from the call buttons listed in criteria 1 and 2.
4. IF the current line from `selectDialogueView` has a speaker other than the caller, THEN THE Phone_Screen_UI SHALL leave that line out of the phone screen and SHALL show no line text other than a Caller_Line.
5. THE Phone_Screen_UI SHALL render the Fictional_Phone_Number as plain text with `dir="ltr"`, on one line without wrapping. The number SHALL have no link element, no `tel:` reference and no keyboard focus stop.
6. THE Phone_Screen_UI SHALL take the caller display name and the Fictional_Phone_Number from the Call definition in the display scenario returned by `useDisplayScenario`. It SHALL take the Caller_Line from `selectDialogueView`, with the `vi` narrative overlay text shown when the selected locale is `vi` and English shown when overlay text is missing.
7. THE Phone_Screen_UI SHALL take every chrome text from Translation_Keys in the `chapter1` namespace that exist in both `en` and `vi`. Chrome text means the incoming-call label, the Call_Status text, the connecting text, and the Accept, Decline and Hang up button text. No chrome text SHALL be hard-coded in a component.
8. THE Phone_Screen_UI SHALL use `lucide-react` icons for the call avatar and the call buttons, with `aria-hidden="true"` on every icon that sits next to visible text. It SHALL contain no emoji characters.
9. WHEN the Caller_Line text changes to a different line, THE Phone_Screen_UI SHALL announce the new Caller_Line once through a polite live region (`aria-live="polite"`, `aria-atomic="true"`). It SHALL make no new announcement when the component re-renders and the line is unchanged.
10. WHILE a Call is `active` and no dialogue node is linked to the Call, THE Phone_Screen_UI SHALL show the text from `phone.call.connecting` inside a polite live region in place of the Caller_Line, and SHALL keep showing the caller display name, the Fictional_Phone_Number, the Call_Status text, the call avatar icon and the Hang up button.
11. THE Phone_Screen_UI SHALL show no verified, trusted or "safe" badge, label or icon for the caller or the Fictional_Phone_Number.

### Requirement 3: Player choices outside the phone

**User Story:** As a player, I want my answer options shown as a game overlay outside the phone, so that choosing a response feels like a game decision and the phone screen stays readable.

#### Acceptance Criteria

1. WHILE a Call is `active` and the current dialogue node has at least one Dialogue_Option, THE Choice_Overlay SHALL list every Dialogue_Option from `selectDialogueView(state).options` exactly once, in the same order, with no extra and no missing entries. The rule is the same whether the Phone_Model_View or the Fallback_Phone_Screen is shown.
2. THE Choice_Overlay SHALL render outside the Phone_Screen_UI element tree, so that no Choice_Overlay element is a descendant of a Phone_Screen_UI element. Its on-screen bounding rectangle SHALL have a zero-area intersection with the bounding rectangle of the phone screen area, which is the Phone_Screen_UI on the Phone_Model_View or the Fallback_Phone_Screen.
3. WHILE the viewport is at least 640 CSS pixels wide, THE Choice_Overlay SHALL place its top edge at or below 50% of the viewport height and its bottom edge at or above the bottom edge of the viewport. Its bounding rectangle SHALL have a zero-area intersection with the phone screen area.
4. WHILE the viewport is narrower than 640 CSS pixels, THE Choice_Overlay SHALL place its top edge at or below the bottom edge of the phone screen area. It SHALL limit its height to the space between that edge and the bottom of the viewport. When the listed Dialogue_Options need more height than that space, it SHALL scroll vertically so that every Dialogue_Option can be reached by scrolling.
5. WHILE the viewport is from 320 to 2560 CSS pixels wide, THE Choice_Overlay SHALL wrap each Dialogue_Option's text onto as many lines as it needs. It SHALL show the complete text with no ellipsis, no clipped characters and no horizontal scroll bar on the Choice_Overlay or the page.
6. WHERE a Dialogue_Option has its fallback flag set (`fallback: true` from the Narrative_Core), THE Choice_Overlay SHALL show the text of the `dialogue.fallbackOption` Translation_Key in the selected locale instead of the option's own text.
7. WHILE a Call is `active` and the current dialogue node has zero Dialogue_Options, THE Choice_Overlay SHALL show the text of the existing `dialogue.noOptions` Translation_Key and zero Dialogue_Option controls. The Hang up button on the Phone_Screen_UI SHALL stay enabled.
8. WHILE the Choice_Overlay is shown, THE Choice_Overlay SHALL show a visible label above the list that names it as the player's responses. The label text SHALL come from one Translation_Key, the existing `dialogue.optionsLabel` or a new key in the `chapter1` namespace, defined in both `en` and `vi`.
9. THE Choice_Overlay SHALL style options only with the existing Chapter 1 theme tokens in `features/chapter1/theme.ts`. The hover, keyboard focus and pressed states SHALL each differ from the default state in at least one visible property: background, border or outline. The keyboard focus state SHALL show a visible focus indicator at least 2 CSS pixels thick that appears on keyboard focus only.
10. WHILE a Call is `ringing`, or no Call is `ringing` or `active`, THE Choice_Overlay SHALL be absent from the render tree.

### Requirement 4: Choice selection reuses the dialogue logic

**User Story:** As a player, I want a click or key press on a choice to move the call forward the same way it does today, so that the story and outcomes stay the same.

#### Acceptance Criteria

1. WHEN the player activates an enabled Dialogue_Option in the Choice_Overlay by pointer click, Enter or Space, THE Chapter_Page SHALL dispatch exactly one `SELECT_DIALOGUE_OPTION` action with that Dialogue_Option ID through the existing `handleSelectOption` handler.
2. WHEN the player presses a number key N from 1 to 9 without Alt, Ctrl or Meta, and the key press is not a repeat, while the Choice_Overlay is shown, the Chapter_Page is not paused, and focus is not in an input, textarea, select or content-editable element, THE Choice_Overlay SHALL select the Dialogue_Option at position N (1-based) in the order given by `selectDialogueView`, with the same dispatch as criterion 1.
3. IF the player presses a number key N from 1 to 9 and the current dialogue node has fewer than N Dialogue_Options, THEN THE Choice_Overlay SHALL dispatch no action and SHALL leave the Narrative_Core state and keyboard focus unchanged.
4. WHEN the player presses Arrow Down, Arrow Up, Home or End on a focused Dialogue_Option, THE Choice_Overlay SHALL move focus to the next, previous, first or last Dialogue_Option, with Arrow Down on the last Dialogue_Option moving focus to the first one and Arrow Up on the first Dialogue_Option moving focus to the last one, and SHALL dispatch no action.
5. WHEN a dialogue node with at least one Dialogue_Option is shown (a change of dialogue graph ID or node ID in `selectDialogueView`) while the Chapter_Page is not paused, THE Choice_Overlay SHALL move keyboard focus to the first Dialogue_Option before the next user input is processed.
6. FOR ALL dialogue graphs of Chapter 1 calls and all option sequences, selecting Dialogue_Options through the Choice_Overlay SHALL produce the same Narrative_Core state as dispatching the same `SELECT_DIALOGUE_OPTION` actions directly (presentation does not change game state).
7. WHILE the Chapter_Page is paused, THE Choice_Overlay SHALL render every Dialogue_Option with the `disabled` attribute, SHALL ignore number keys 1 to 9, and SHALL dispatch no `SELECT_DIALOGUE_OPTION` action.
8. THE Choice_Overlay SHALL read Dialogue_Options only from `selectDialogueView` and SHALL hold no dialogue state of its own, so that after every Narrative_Core state change the rendered Dialogue_Option IDs, order and text equal those in `selectDialogueView(state).options`.
9. IF a Dialogue_Option ID that is not in the current `selectDialogueView(state).options` reaches `handleSelectOption`, for example from a second click after the node has changed, THEN THE Chapter_Page SHALL leave the Narrative_Core state unchanged, the same way the existing `SELECT_DIALOGUE_OPTION` handling does today.

### Requirement 5: Call buttons and hang up

**User Story:** As a player, I want Accept, Decline and Hang up to work on the 3D phone, so that I can answer or end a call at any time.

#### Acceptance Criteria

1. WHEN the player activates the Accept button on the Phone_Screen_UI while the Call_Status is `ringing` (by mouse click, touch tap, or Enter or Space while the button has keyboard focus), THE Chapter_Page SHALL dispatch exactly one `ANSWER_CALL` action through the same handler the current `IncomingCallScreen` uses.
2. WHEN the player activates the Decline button on the Phone_Screen_UI while the Call_Status is `ringing` (by mouse click, touch tap, or Enter or Space while the button has keyboard focus), THE Chapter_Page SHALL dispatch exactly one `END_CALL` action through the same handler the current `IncomingCallScreen` uses.
3. WHEN the player activates the Hang up button on the Phone_Screen_UI while the Call_Status is `active` (by mouse click, touch tap, or Enter or Space while the button has keyboard focus), THE Chapter_Page SHALL dispatch exactly one `END_CALL` action through the same handler the current `CallScreen` uses. This applies on every dialogue node of the Call, including nodes that show Dialogue_Options and the state with no linked dialogue node.
4. WHEN the Call_Status changes from `ringing` or `active` to any other value, THE Chapter_Page SHALL remove the Phone_Model_View, the Phone_Screen_UI, the Fallback_Phone_Screen and the Choice_Overlay from the render tree no later than the next rendered frame.
5. THE Phone_Screen_UI SHALL render each call button as a native button element whose accessible name comes from a Translation_Key in the `chapter1` namespace in both `en` and `vi`. Each button SHALL be reachable with Tab and Shift+Tab and SHALL show a visible keyboard focus indicator.
6. WHILE the Chapter_Page is paused, THE Phone_Screen_UI SHALL render the Accept, Decline and Hang up buttons with the `disabled` attribute, and a click, tap, Enter or Space on them SHALL dispatch zero Narrative_Core actions.
7. IF the player activates the same call button more than once before the Call_Status changes (for example, a double click), THEN THE Chapter_Page SHALL dispatch at most one `ANSWER_CALL` or `END_CALL` action for that Call_Status. The Narrative_Core state SHALL equal the state that results from a single dispatch.
8. WHERE the Fallback_Phone_Screen is shown instead of the Phone_Model_View, THE Fallback_Phone_Screen SHALL provide the Accept, Decline and Hang up buttons with the same behavior as criteria 1 to 7.

### Requirement 6: Camera focus, transitions and player control

**User Story:** As a player, I want the view to focus on the phone when a call starts and to give me back control when it ends, so that I always know what is happening.

#### Acceptance Criteria

1. WHILE a Call is `ringing` or `active`, THE Chapter_Page SHALL pass `enabled={false}` to the Player_Controller, so that keyboard and mouse input does not move or rotate the player camera.
2. WHEN the Call_Presentation opens while `document.pointerLockElement` is set, THE Chapter_Page SHALL release pointer lock within the same rendered frame, and SHALL leave `document.pointerLockElement` empty while the Call_Presentation is open.
3. WHEN the Call_Presentation opens and Reduced_Motion is off, THE Phone_Model_View SHALL animate the phone from outside the viewport to its framed position (the position where the whole phone screen is inside the viewport, as in Requirement 1.3) over a duration from 200 to 600 milliseconds.
4. WHILE Reduced_Motion is on, THE Phone_Model_View SHALL show the phone at its framed position from the first rendered frame of the Call_Presentation, with no entry animation and no ringing vibration.
5. WHILE a Call is `ringing` and Reduced_Motion is off, THE Phone_Model_View SHALL play a ringing vibration that moves the phone by no more than 2% of the phone screen height from its framed position, and SHALL stop the vibration within one rendered frame after the Call_Status becomes `active` or the Call ends.
6. WHILE the Call_Presentation is open, THE Chapter_Page SHALL render a dimming layer over the 3D world behind the phone and the Choice_Overlay, so that the Phone_Screen_UI text and the Choice_Overlay text each have a contrast ratio of at least 4.5:1 against their backgrounds.
7. WHEN a Call ends and the Chapter_Page overlay stack holds no overlay other than the one it held before the Call opened, THE Chapter_Page SHALL restore the player camera to the position and orientation it had when the Call_Presentation opened, within 0.01 world units for position and 0.01 radians for each rotation axis.
8. WHEN a Call ends, the Chapter_Page is not paused, and the overlay stack is empty, THE Chapter_Page SHALL pass `enabled={true}` to the Player_Controller and show the existing `ResumePrompt`, without locking the pointer until the player clicks the game view.
9. WHEN a Call ends and the 2D `PhoneOverlay` was the top overlay before the Call opened, THE Chapter_Page SHALL show the 2D `PhoneOverlay` with the same overlay stack (same overlays in the same order) it had before the Call, and SHALL keep passing `enabled={false}` to the Player_Controller.
10. IF a Call ends while the Chapter_Page is paused, THEN THE Chapter_Page SHALL remove the Call_Presentation, keep the pause menu open with `enabled={false}` on the Player_Controller, and apply criteria 7 to 9 when the player resumes.

### Requirement 7: Accessibility of the call presentation

**User Story:** As a player who uses a keyboard or a screen reader, I want the 3D call to be as usable as the current 2D call screen, so that the change does not exclude me.

#### Acceptance Criteria

1. WHILE the Call_Presentation is open, THE Chapter_Page SHALL expose the Call_Presentation, with either the Phone_Model_View or the Fallback_Phone_Screen, as exactly one element with `role="dialog"` and `aria-modal="true"`. That element SHALL get its accessible name from a Translation_Key in the `chapter1` namespace in both `en` and `vi`.
2. WHILE the Call_Presentation is open, THE Chapter_Page SHALL keep Tab and Shift+Tab focus inside the Call_Presentation dialog. The focus order SHALL be the enabled Phone_Screen_UI call buttons first, then the Choice_Overlay Dialogue_Options in list order. Tab on the last focusable element SHALL move focus to the first one, and Shift+Tab on the first SHALL move focus to the last.
3. WHEN the Call_Presentation opens while the Call is `ringing`, THE Chapter_Page SHALL move keyboard focus to the Accept button before the next user input is processed.
4. WHEN the Call_Status changes from `ringing` to `active`, or the Call_Presentation opens while the Call is already `active`, THE Chapter_Page SHALL move keyboard focus to the first Dialogue_Option. If the current dialogue node has zero Dialogue_Options, or no dialogue node is linked to the Call, focus SHALL move to the Hang up button.
5. WHILE a Call is `ringing` or `active`, THE Chapter_Page SHALL keep the current Escape behavior: pressing Escape closes no overlay, does not end the Call, does not open the pause menu, and leaves the Call_Status and the overlay stack unchanged.
6. WHEN a Call ends, THE Chapter_Page SHALL move keyboard focus within one rendered frame to the element that matches the overlay restored under Requirement 6.8 or 6.9. That element is the 2D `PhoneOverlay` dialog when the 2D `PhoneOverlay` was open before the Call, or the game view otherwise. Focus SHALL never be left on a removed element or on the document body.
7. THE Phone_Screen_UI, the Fallback_Phone_Screen and the Choice_Overlay SHALL show all text with a contrast ratio of at least 4.5:1 against the background directly behind it, in every state: default, hover, keyboard focus, pressed and disabled. Disabled controls SHALL also expose `disabled` or `aria-disabled="true"`.
8. THE Phone_Screen_UI call buttons and the Choice_Overlay Dialogue_Options SHALL show a visible keyboard focus indicator with a contrast ratio of at least 3:1 against the adjacent background.
9. THE Phone_Model_View SHALL mark the 3D canvas element and its non-HTML content with `aria-hidden="true"`, and SHALL give the canvas no accessible name. Screen readers SHALL then reach only the HTML Phone_Screen_UI and Choice_Overlay inside the Call_Presentation dialog.
10. THE Choice_Overlay SHALL expose the Dialogue_Options as one ordered list (`ol`) with one list item per Dialogue_Option. Each list item SHALL contain exactly one button whose accessible name equals the visible Dialogue_Option text. The list's accessible name SHALL be the visible Choice_Overlay label from Requirement 3.8.

### Requirement 8: Fallback when the 3D phone cannot render

**User Story:** As a player on a device without WebGL or with a failed model download, I want to still answer and finish the call, so that I can complete the chapter.

#### Acceptance Criteria

1. IF WebGL is unavailable when the Call_Status of the current Call becomes `ringing`, THEN THE Chapter_Page SHALL show the Fallback_Phone_Screen with the Phone_Screen_UI within 500 milliseconds of the Call_Status change, SHALL render the Choice_Overlay outside the Fallback_Phone_Screen element tree and screen area, and SHALL not render the Phone_Model_View.
2. IF the Phone_Model fails to load, THEN THE Chapter_Page SHALL show the Fallback_Phone_Screen within 1 second of the load error, and SHALL keep the Call_Status, the current dialogue node and the already selected Dialogue_Options the same as they were before the load error.
3. WHILE a Call is `ringing` or `active` and the Phone_Model is still loading, THE Chapter_Page SHALL show the Fallback_Phone_Screen, with working Accept, Decline, Hang up and Dialogue_Option controls, within 500 milliseconds of the Call_Status becoming `ringing`.
4. THE Fallback_Phone_Screen SHALL render the same Phone_Owned_Content, Translation_Keys and handlers as the Phone_Screen_UI on the Phone_Model_View, and SHALL meet the same acceptance criteria as Requirement 2, Requirement 5 (call buttons, keyboard activation, disabled while paused) and Requirement 7 (modal dialog, focus trap, initial focus, 4.5:1 text contrast).
5. IF the Phone_Model fails to load, THEN THE Game_App SHALL log exactly one console warning that contains the Phone_Model asset path, and SHALL show no error dialog, toast or other element that blocks the Call buttons or the Choice_Overlay.
6. WHEN the Phone_Model finishes loading while the Fallback_Phone_Screen is shown during a Call, THE Chapter_Page SHALL replace the Fallback_Phone_Screen with the Phone_Model_View without changing the Call_Status, the current dialogue node or the selected Dialogue_Options, and SHALL keep keyboard focus on the control that matches the focused control before the switch (same call button or same Dialogue_Option position).
7. IF the WebGL context is lost while a Call is `ringing` or `active`, THEN THE Chapter_Page SHALL show the Fallback_Phone_Screen within 1 second of the context loss, SHALL keep the Call_Status, the current dialogue node and the selected Dialogue_Options unchanged, and SHALL keep the Choice_Overlay outside the Fallback_Phone_Screen.
8. IF the Phone_Model failed to load earlier in the same page session, THEN THE Chapter_Page SHALL show the Fallback_Phone_Screen for every later Call in that session within 500 milliseconds of the Call_Status becoming `ringing`, and SHALL log no additional console warning for that asset.

### Requirement 9: Phone model asset, branding and performance

**User Story:** As the project owner, I want the phone model to be light, credited and free of real brand marks, so that the game loads on the web and follows the fictional-brands rule.

#### Acceptance Criteria

1. THE Game_App SHALL use exactly one of the two candidate phone models (`iphone-17-pro.glb` or `phone-17-pro-max.glb`). The design document SHALL record the selected candidate, its screen geometry findings and its visible branding findings.
2. THE Phone_Model SHALL be one `.glb` file produced from the selected candidate with `apps/game/scripts/optimize-environment.cjs` or an equivalent Meshopt and WebP pipeline. Its file size SHALL be at most 5 MB (5,242,880 bytes), and its file name SHALL contain no real brand name or product name.
3. THE Phone_Model SHALL show no real brand name, product name or logo on any surface that is visible in the game, at the framed position or during the entry animation. Each texture and material of the Phone_Model SHALL have been inspected, and each one that carried such a mark SHALL have been removed, replaced or covered. The inspection results SHALL be listed in `SOURCE.md`.
4. THE Asset_Credits SHALL contain exactly one entry for the Phone_Model with the following fields: the Phone_Model file name; the candidate file it was produced from; the creator named in the glTF metadata, or "not stated" when the metadata names no creator; the license as stated by the owner on 2026-11-12.
5. THE `SOURCE.md` file in `apps/game/public/assets/3d/props/phone/` SHALL record the selected candidate file, the Phone_Model file name, the optimization command and its settings, the file size before and after optimization, and each branding change made to the model.
6. THE Chapter_Page SHALL load the Phone_Model through the existing Drei `useGLTF` and React `Suspense` patterns used by the chapter canvas. The Suspense boundary for the Phone_Model SHALL wrap only the Phone_Model_View, so the chapter street stays rendered while the Phone_Model loads.
7. WHEN the chapter loader loads Chapter 1, THE chapter loader SHALL download the Phone_Model as one entry of the Chapter 1 asset list in `chapterRegistry.ts` before the Chapter_Page is entered. This entry SHALL have its own asset ID and its own loading text.
8. IF the Phone_Model is not yet loaded in the Drei `useGLTF` cache when the Call_Status of a Call becomes `ringing`, THEN THE Chapter_Page SHALL follow Requirement 8.3.
9. WHILE the Call_Presentation is open on a device that renders the chapter street at a mean of 30 frames per second or more without a Call, THE Phone_Model_View SHALL keep the mean frame rate at 30 frames per second or more. Both means SHALL be measured over a 10-second window on the same device, browser and viewport size.
10. THE Game_App SHALL define the loading text of the Phone_Model asset entry as the Translation_Key `chapters:chapter-1.assets.<assetId>` in both `en` and `vi`, so that the chapter loading screen shows that text in the selected locale.
11. THE Game_App source code SHALL reference only the Phone_Model file. It SHALL not reference either unoptimized candidate file (`iphone-17-pro.glb` or `phone-17-pro-max.glb`).
12. IF the Phone_Model download fails during Chapter 1 loading, THEN THE chapter loader SHALL still let the player enter Chapter 1, and THE Chapter_Page SHALL follow Requirement 8.2 when a Call starts ringing.

### Requirement 10: Screen attachment

**User Story:** As a player, I want the call screen to sit on the phone's glass, so that the phone looks like it is really showing the call.

#### Acceptance Criteria

1. WHERE the Phone_Model contains a usable screen mesh, THE Phone_Model_View SHALL place the Phone_Screen_UI on the Screen_Anchor derived from that mesh, where a usable screen mesh is a single mesh named in the design document whose front face covers the visible screen area of the Phone_Model.
2. WHERE the Phone_Model contains no usable screen mesh, THE Phone_Model_View SHALL place the Phone_Screen_UI on a fixed Screen_Anchor whose position, rotation and size are recorded in the design document and aligned to the visible screen area.
3. WHILE the Call_Presentation is open and the phone is at its framed position, THE Phone_Model_View SHALL keep each of the four Phone_Screen_UI edges within 4 CSS pixels of the matching visible screen area edge, for every viewport width from 320 to 2560 CSS pixels.
4. THE Phone_Model_View SHALL render the Phone_Screen_UI as HTML elements, so that text selection by screen readers, Tab focus, pointer clicks on the call buttons and the polite live region for the Caller_Line behave the same as in the current 2D call screen DOM.
5. WHILE the entry animation or the ringing vibration plays, THE Phone_Model_View SHALL move, rotate and scale the Phone_Screen_UI together with the Phone_Model, so that the Phone_Screen_UI stays on the Screen_Anchor in every rendered frame.
6. WHILE the Call_Presentation is open, THE Phone_Model_View SHALL show the Phone_Screen_UI in front of the Phone_Model surface, with no part of the Phone_Screen_UI hidden by the phone body, frame or bezel.
7. WHEN the viewport is resized while the Call_Presentation is open, THE Phone_Model_View SHALL realign the Phone_Screen_UI to the Screen_Anchor within 100 milliseconds after the resize ends, and SHALL keep the Call state and the focused element unchanged.

### Requirement 11: Architecture and code boundaries

**User Story:** As a developer, I want the 3D model, the screen content, the choice overlay and the call wiring kept in separate modules, so that each part is easy to change and test.

#### Acceptance Criteria

1. THE Game_App SHALL implement the Phone_Model_View, the Phone_Screen_UI, the Choice_Overlay and the Call_Presentation wiring as four separate source files, one per part, each located in `features/chapter1/phone/` or in one folder that sits directly under `features/chapter1/` next to `phone/`, with no file implementing more than one of these four parts.
2. THE Phone_Screen_UI and the Choice_Overlay SHALL import no `three`, `@react-three/fiber` or `@react-three/drei` module, either directly or through any relative import inside the Game_App, so that both render when WebGL is unavailable (Requirement 8.1).
3. THE Phone_Model_View SHALL receive the Call data it renders (caller display name, Fictional_Phone_Number, Call_Status, Caller_Line and the call button handlers) only through props, and SHALL read no value from the narrative store or from Narrative_Core selectors.
4. THE Phone_Model_View SHALL dispatch no Narrative_Core action, and the Accept, Decline and Hang up buttons it hosts SHALL reach the Narrative_Core only through handler props supplied by the Call_Presentation wiring.
5. THE Narrative_Core SHALL keep passing every check in the existing `game/narrative/boundaries.test.ts`, with no import of React, Three.js, React Three Fiber, Drei or i18n modules, and with no entry added to that test's forbidden-package or outside-file allowlists for this feature.
6. WHEN the player opens the phone while no Call is `ringing` or `active`, THE Chapter_Page SHALL render the home screen, Messages, Call history, Bank app and Decide button in the existing 2D `PhoneOverlay`, and SHALL render no Phone_Model_View and no Choice_Overlay.
7. WHEN the face-to-face dialogue with Sam starts, THE Chapter_Page SHALL render that dialogue and its response options in the existing `DialoguePanel` overlay, and SHALL render no Phone_Model_View and no Choice_Overlay.
8. THE Call_Presentation wiring SHALL dispatch only the existing `ANSWER_CALL`, `SELECT_DIALOGUE_OPTION` and `END_CALL` actions, SHALL read call and dialogue data only through the existing call state and `selectDialogueView` selectors, and SHALL create no new state store.
9. THE Game_App test suite SHALL include an automated import check that fails if any file of the Phone_Screen_UI or the Choice_Overlay imports a `three`, `@react-three/fiber` or `@react-three/drei` module.

### Requirement 12: Localization of new text

**User Story:** As a Vietnamese-speaking player, I want the new call UI in my language, so that I understand the call and my options.

#### Acceptance Criteria

1. THE Game_App SHALL define every new user-facing text of this feature as a Translation_Key in `apps/game/src/i18n/locales/en/chapter1/` and in `apps/game/src/i18n/locales/vi/chapter1/`. This covers visible labels, button text, Call_Status text, the Choice_Overlay label, the Call_Presentation accessible name, `aria-label` values and live-region text. The `vi` files SHALL contain the same set of new Translation_Keys as the `en` files, so that `pnpm typecheck` passes and no `en` key is missing in `vi`.
2. WHILE the selected locale is `vi`, THE Phone_Screen_UI and the Choice_Overlay SHALL show the Vietnamese chrome text from the `vi` Translation_Keys. They SHALL also show the Vietnamese narrative overlay text for the Caller_Line, the speaker label and every Dialogue_Option, looked up by the same content IDs as the English scenario data.
3. IF the selected locale is `vi` and a Translation_Key or a narrative overlay entry for a shown text is missing, THEN THE Phone_Screen_UI and the Choice_Overlay SHALL show the English text for that item, and SHALL show neither the raw Translation_Key, the raw content ID nor an empty string.
4. THE Phone_Screen_UI and the Choice_Overlay SHALL build every sentence from one Translation_Key with Interpolation_Variables (for example `{{name}}`) for the changing parts. They SHALL NOT join translated fragments, hard-coded strings or variables with string concatenation or template literals.
5. THE Phone_Screen_UI, the Fallback_Phone_Screen and the Choice_Overlay SHALL contain no hard-coded user-facing text in component code. Every visible or accessible text SHALL come from a Translation_Key, from the narrative overlay, or from the Call definition (caller display name and Fictional_Phone_Number).
6. WHILE the selected locale is `vi`, THE Phone_Screen_UI SHALL show the Fictional_Phone_Number with the same characters as in the `en` locale, as plain text with `dir="ltr"`.
7. WHEN the player changes the locale while the Call_Presentation is open, THE Phone_Screen_UI and the Choice_Overlay SHALL show the text of the new locale on the next render. The Call_Status, the current dialogue node, the order of the Dialogue_Options and the Narrative_Core state SHALL stay unchanged.

### Requirement 13: Tests and validation

**User Story:** As a developer, I want automated tests for the new call presentation, so that regressions are caught before merge.

#### Acceptance Criteria

1. THE Game_App test suite SHALL include a test that renders a Call with Call_Status `active` and asserts that the Phone_Screen_UI shows four values from the Chapter 1 scenario data: the caller display name, the Fictional_Phone_Number, the Call_Status text and the Caller_Line. The test SHALL also assert that the Fictional_Phone_Number is plain text with `dir="ltr"` and has no link element as an ancestor.
2. THE Game_App test suite SHALL include a test that renders a Call with Call_Status `active` on a dialogue node with at least two Dialogue_Options. The test SHALL assert that the Phone_Screen_UI element tree contains zero Dialogue_Option controls, and that the Choice_Overlay contains one button for each Dialogue_Option returned by `selectDialogueView`, in the same order.
3. THE Game_App test suite SHALL include a test that clicks a Dialogue_Option in the Choice_Overlay. The test SHALL assert that `SELECT_DIALOGUE_OPTION` is dispatched once with that Dialogue_Option ID, and that the Narrative_Core current dialogue node ID then equals the next node ID defined for that option in the scenario data.
4. THE Game_App test suite SHALL include three separate tests, one for each call button, with no other overlay open: (a) activating Accept while `ringing` changes the Call_Status to `active` and the Player_Controller `enabled` prop stays `false`; (b) activating Decline while `ringing` changes the Call_Status to a value other than `ringing` and `active`; (c) activating Hang up while `active` changes the Call_Status to a value other than `ringing` and `active`. Tests (b) and (c) SHALL also assert that the Player_Controller `enabled` prop is `true` and that the Phone_Model_View, the Phone_Screen_UI and the Choice_Overlay are absent from the render tree.
5. THE Game_App test suite SHALL include two tests that each render a Call with Call_Status `ringing`: one with WebGL reported as unavailable and one with a simulated Phone_Model load error. Each test SHALL assert that the Fallback_Phone_Screen renders the Accept and Decline buttons, that the Call_Status is unchanged, and that no blocking error dialog is shown. The load-error test SHALL also assert that exactly one console warning containing the Phone_Model asset path is logged.
6. THE Game_App test suite SHALL include a test that asserts the Phone_Model asset path appears exactly once in the Chapter 1 asset list, that the file exists under `apps/game/public/`, and that the file size is at most 5 MB.
7. THE Game_App test suite SHALL include a test that renders the Call_Presentation with the `vi` locale selected, once with Call_Status `ringing` and once with `active`. The test SHALL assert that every new chrome text (call label, Call_Status text, Accept, Decline and Hang up button text, Choice_Overlay label, Call_Presentation accessible name) equals the value of its Translation_Key in the `vi` `chapter1` locale files, and that none of them equals the English source value unless the two locale values are identical.
8. WHEN the feature is complete, THE developer SHALL run `pnpm test`, `pnpm typecheck` and `pnpm build` in that order, each after the previous command finishes. THE developer SHALL record in `docs/PROJECT_PROGRESS.md` the exit status of each command and the test pass, fail and skip counts reported by `pnpm test`. Any failing or skipped check SHALL be recorded as failing or skipped, and SHALL NOT be reported as passing.
9. WHEN `pnpm test` runs on the feature branch, THE existing main menu, startup loading, chapter loading and Narrative_Core `boundaries.test.ts` tests SHALL pass. None of these tests may be deleted, skipped or have their assertions weakened.
10. THE Game_App test suite SHALL include a property-based test that generates option sequences over the dialogue graph of every Chapter 1 Call, with at least 100 generated cases. The test SHALL assert that selecting the options through the Choice_Overlay produces a Narrative_Core state equal to dispatching the same `SELECT_DIALOGUE_OPTION` actions directly on the reducer.
11. THE Game_App tests for this feature SHALL run without network access, without an AI provider and without a WebGL context. Each Phone_Model_View and WebGL dependency SHALL be replaced by a test double, so the tests pass in the existing Vitest environment.

### Requirement 14: Delivery and documentation

**User Story:** As the project owner, I want the change delivered on its own branch with an honest report, so that I can review and merge it safely.

#### Acceptance Criteria

1. THE developer SHALL commit the feature on a branch named exactly `feat/game-3d-phone-call-ui` created from the current tip of `feat/game-i18n-en-vi`. Every commit message SHALL follow Conventional Commits (a `type(scope): summary` header with type `feat`, `fix`, `test`, `docs`, `chore` or `refactor`). Each commit SHALL keep the human as author and SHALL include a `Co-authored-by` trailer for the agent.
2. THE developer SHALL stage only the files this feature created or modified: Game_App source and tests, the Phone_Model asset, Locale_Dictionaries, Asset_Credits, `docs/PROJECT_PROGRESS.md`, related architecture documents and the spec files in `.kiro/specs/game-3d-phone-call-ui/`. THE developer SHALL NOT stage `.env` files, secrets, build output in `apps/game/dist/`, `node_modules/` or unrelated changes that were already in the working tree.
3. THE developer SHALL push `feat/game-3d-phone-call-ui` to the remote without force options (`--force`, `--force-with-lease` or `+refspec`). THE developer SHALL NOT push to or merge into `main` or `feat/game-i18n-en-vi`, and SHALL leave the merge to the owner.
4. WHEN the feature is complete, THE developer SHALL add one entry at the top of the "Task history" section of `docs/PROJECT_PROGRESS.md`. The entry SHALL contain: the date (`YYYY-MM-DD`) and task title, the objective, the files created, modified or deleted, the selected Phone_Model with its source (URL if known, otherwise "not provided"), author and license, how the Phone_Screen_UI is attached to the Screen_Anchor, how the Choice_Overlay works, the reused Narrative_Core state logic, the validation commands executed with their real results, the known limitations, any deviations from the documented architecture, and the follow-up tasks.
5. IF `pnpm test`, `pnpm typecheck` or `pnpm build` fails or cannot be run, THEN THE developer SHALL record in the Task history entry which command was affected, whether it failed or could not run, and the failure reason or failing test names. THE developer SHALL NOT describe the feature as completed or verified in `docs/PROJECT_PROGRESS.md` in that case.
6. WHEN the Task history entry is added, THE developer SHALL update the "Project status", "Completed", "In progress" and "Planned" sections of `docs/PROJECT_PROGRESS.md` to match the verified state of the feature. THE developer SHALL also update any architecture document whose description of the Chapter 1 call UI no longer matches the implementation (the 2D PhoneOverlay replaced by the Call_Presentation).
