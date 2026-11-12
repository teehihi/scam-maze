# Requirements Document

## Introduction

This feature redesigns the screen of the in-game phone call in Chapter 1 ("The Urgent Call") of
the SCAMMAZE game app (`apps/game`). Today the call screen reads like a dialogue box. After this
feature it looks like a believable in-call phone interface: a caller avatar, the caller name and
number, a call status, a call timer and a small set of round action buttons. The caller's words
are delivered by voice. When subtitles apply, they appear outside the phone in a separate
subtitle overlay. The player's reply options stay outside the phone.

Audit of the current code (branch `feat/chapter-01-voice-narrative`, commit `f5694a6`):

- `apps/game/src/features/chapter1/call/PhoneScreenUI.tsx` renders the phone screen content. In
  the active state it renders the avatar, caller name, number, the status text, the call timer
  (`call-duration`), a voice notice paragraph (`call-notice`), a scrolling live region
  (`call-line-region`) that holds the caller line card (`dialogue-line`) or the connecting text,
  the Mute and Replay buttons and a full-width Hang up button. The caller line card and the
  connecting text are the "dialogue box" this feature removes from the phone.
- `apps/game/src/features/chapter1/call/CallPresentation.tsx` is the wiring component. It reads
  `state.call` and `selectDialogueView(state, scenario)`, builds the `CallScreenView` (including
  the caller line), computes `captionVisible = subtitlesEnabled || !voice.snapshot.audible`, and
  renders `PhoneScreenHost` (with the single phone screen instance) and `PlayerChoiceOverlay` as
  siblings.
- `apps/game/src/features/chapter1/call/PhoneScreenHost.tsx` projects the screen element onto the
  3D phone (`model`) or onto a 2D bezel (`fallback`). It is unchanged by this feature.
- `apps/game/src/features/chapter1/call/PlayerChoiceOverlay.tsx` renders the reply options
  outside the phone in `layout.choice`. It is unchanged by this feature.
- `apps/game/src/features/chapter1/call/callLayout.ts` (`computeCallLayout`) returns `screen`,
  `choice` and `screenCornerRadius`. It has no region for subtitles.
- `apps/game/src/features/chapter1/call/PhoneModel3D.tsx` renders the 3D phone in the canvas and
  is unchanged by this feature.
- `apps/game/src/features/chapter1/voice/useVoicePlayback.ts`, `useCallDuration.ts` and
  `useCallAudio.ts` own voice playback, the call timer and call sounds. They are reused. The
  phone-speaker filter is the `phoneVoiceFilter` setting, applied when a line starts
  (`apps/game/src/game/voice/VoiceDialoguePlayer.ts`, `phoneFilter`).
- `apps/game/src/features/chapter1/ChapterOnePage.tsx` passes `voice`, `durationSeconds` and
  `subtitlesEnabled` to `CallPresentation`.
- `apps/game/src/features/chapter1/theme.ts` holds the brand tokens and the `UI` class strings.
- `apps/game/src/i18n/locales/{en,vi}/chapter1/phone.ts` hold the call text.
- Existing tests that assert the caller line inside the phone and must be updated on purpose:
  `call/PhoneScreenUI.test.tsx`, `call/PhoneScreenUI.controls.test.tsx`,
  `call/callPresentation.content.property.test.tsx`, `call/ChapterOnePage.call.test.tsx`,
  `accessibility.test.tsx`, `ChapterOnePage.voice.test.tsx`. Tests that guard unchanged contracts
  and must keep passing: `call/callPresentation.equivalence.property.test.tsx`,
  `call/callPresentation.parity.property.test.tsx`,
  `call/callPresentation.voiceEquivalence.property.test.tsx`,
  `call/callLayout.property.test.ts`, `call/callButtons.property.test.tsx`,
  `call/importBoundaries.test.ts`, `call/contrast.test.ts`, `noAuthoredText.test.ts`.

Scope and owner decisions (recorded so the spec is self-contained):

- No screenshots were attached to the owner brief. The visual design is derived from the text
  only. Any reference screenshot is inspiration only: no real person's photo and no sample
  avatar is used. The caller avatar is a generic icon.
- Working branch: `feat/game-phone-call-ui-redesign`, created from the tip of
  `feat/chapter-01-voice-narrative` (`f5694a6`).
- "Speaker" is a toggle for the existing phone-speaker sound effect (`phoneVoiceFilter`). There is
  no real audio routing. Keypad and Hold are omitted because they would have no meaning in the
  game.
- The Call ended status is not displayed on the phone, because the locked `call` overlay closes in
  the same update that ends the call. This is a resolved assumption; see the design.
- Out of scope: the face-to-face `DialoguePanel` (Sam), the non-call phone apps, the narrative
  core in `apps/game/src/game/narrative/`, the voice engine, scenario data, new chapters and AI.

## Glossary

- **Phone_Call_Screen**: The DOM component that renders the phone-owned call content. It is
  projected onto the 3D phone model or shown on the 2D fallback screen. It replaces
  `PhoneScreenUI`.
- **Call_Presentation**: The existing wiring component `CallPresentation` that reads the chapter
  store and places the Phone_Call_Screen, the Call_Subtitle_Overlay and the Choice_Overlay.
- **Call_Dialogue_View**: The pure derived view (caller line, narration, screen view) that
  `Call_Presentation` computes from `state.call` and `selectDialogueView`.
- **Call_Subtitle_Overlay**: The new DOM component that shows the current caller line outside the
  phone.
- **Choice_Overlay**: The existing `PlayerChoiceOverlay` that shows the player's reply options.
- **Caller_Line**: The current dialogue line whose speaker is `caller` or `npc`.
- **Call_Layout**: The result of `computeCallLayout`: rectangles for the phone screen, the
  subtitle overlay and the choice overlay.
- **Subtitle_Rect**: The rectangle of Call_Layout reserved for the Call_Subtitle_Overlay.
- **Voice_Controller**: The `VoiceController` returned by `useVoicePlayback`.
- **Subtitles_Setting**: The existing `settings.subtitlesEnabled` setting.
- **Speaker_Toggle**: The Phone_Call_Screen button that turns the phone-speaker sound effect on or
  off for the current call.
- **Call_Timer**: The elapsed call time from `useCallDuration`, shown as `mm:ss`.
- **Compact_Layout**: The Phone_Call_Screen layout used when the screen height is below 360 CSS px.
- **Phone_Screen_Host**: The existing `PhoneScreenHost` that places the Phone_Call_Screen.

## Requirements

### Requirement 1: Phone call screen content

**User Story:** As a player, I want the phone to look like a real in-call screen, so that the call
feels believable.

#### Acceptance Criteria

1. WHILE a call is ringing, THE Phone_Call_Screen SHALL show a generic caller avatar, the caller
   name, the caller number, the status text "Incoming call", a Decline button and an Accept
   button.
2. WHILE a call is active, THE Phone_Call_Screen SHALL show a generic caller avatar, the caller
   name, the caller number, the status text "Call in progress", the Call_Timer and the action
   buttons of Requirement 3.
3. THE Phone_Call_Screen SHALL render the caller avatar as a generic icon inside a circle and
   never as a photograph of a person.
4. WHILE a call is active, THE Phone_Call_Screen SHALL show the Call_Timer in the format `mm:ss`
   with two-digit minutes and two-digit seconds.
5. THE Phone_Call_Screen SHALL show the caller number as plain text without a link, without a
   `tel:` target and without a tab stop.
6. THE Phone_Call_Screen SHALL NOT show a badge, label or icon that states a caller, number or
   message is trustworthy.

### Requirement 2: Phone screen excludes narrative content

**User Story:** As a player, I want the phone to show only the call, so that the screen is not a
text box.

#### Acceptance Criteria

1. THE Phone_Call_Screen SHALL NOT render the text of any Caller_Line.
2. THE Phone_Call_Screen SHALL NOT render the connecting text "Connected. Waiting for the caller
   to speak.".
3. THE Phone_Call_Screen SHALL NOT render any voice notice text.
4. THE Phone_Call_Screen SHALL NOT render player reply options, evidence, journal entries or
   debrief content.
5. WHILE a call is active, THE Phone_Call_Screen SHALL contain no scrolling text region.
6. THE Phone_Call_Screen SHALL render the same content in `model` mode and in `fallback` mode.

### Requirement 3: Action buttons

**User Story:** As a player, I want familiar call buttons, so that I can control the call like on a
real phone.

#### Acceptance Criteria

1. WHILE a call is active, THE Phone_Call_Screen SHALL render a Mute button, a Speaker_Toggle, a
   Replay button and an End call button, and no other button.
2. THE Phone_Call_Screen SHALL render the Mute button, the Speaker_Toggle and the Replay button
   as round buttons with a visible text label in one row of three columns.
3. THE Phone_Call_Screen SHALL render the End call button as a red round or pill button centered
   below the row of three.
4. WHEN the player presses Mute, THE Phone_Call_Screen SHALL call the mute handler, and THE
   Voice_Controller SHALL mute or unmute the call voice.
5. WHEN the player presses the Speaker_Toggle, THE Call_Presentation SHALL turn the phone-speaker
   sound effect on or off for the current call without changing the saved settings.
6. WHEN the player presses Replay, THE Voice_Controller SHALL replay the last Caller_Line voice.
7. IF the call has no audio for the current line, THEN THE Phone_Call_Screen SHALL disable the
   Replay button.
8. WHEN the player presses End call, THE Call_Presentation SHALL dispatch the end-call action
   once.
9. THE Phone_Call_Screen SHALL expose Mute and the Speaker_Toggle as toggle buttons with
   `aria-pressed`.
10. THE Phone_Call_Screen SHALL NOT render Keypad or Hold buttons.

### Requirement 4: Visual style and compact layout

**User Story:** As a player, I want a clean, dark phone screen, so that the call is easy to read.

#### Acceptance Criteria

1. THE Phone_Call_Screen SHALL use the SCAMMAZE dark background and the brand tokens from
   `theme.ts`, with purple used only for accents and focus.
2. THE Phone_Call_Screen SHALL render every text at a size of at least 14 CSS px.
3. THE Phone_Call_Screen SHALL keep a text contrast ratio of at least 4.5:1 against its
   background for every text and button label.
4. WHILE the screen height is below 360 CSS px, THE Phone_Call_Screen SHALL use the Compact_Layout
   with a smaller avatar and smaller gaps and without hiding the Call_Timer or any button.
5. WHILE the screen container is narrower than 200 CSS px, THE Phone_Call_Screen SHALL hide the
   visible button labels and keep each button's accessible name.
6. WHILE reduced motion is requested, THE Phone_Call_Screen SHALL render without the ringing
   wobble and without transitions.
7. THE Phone_Call_Screen SHALL NOT use emoji, glow effects, neon gradients or holographic
   effects.

### Requirement 5: External subtitles

**User Story:** As a player, I want to read what the caller says when I need to, so that the call
is accessible without crowding the phone.

#### Acceptance Criteria

1. WHILE a call is active and the current node is a Caller_Line, THE Call_Subtitle_Overlay SHALL
   show the speaker name and the text of that Caller_Line outside the Phone_Call_Screen.
2. THE Call_Subtitle_Overlay SHALL show the text of the current Caller_Line only and never the
   text of an earlier line.
3. WHILE the Subtitles_Setting is on, THE Call_Subtitle_Overlay SHALL be visible.
4. WHILE the Subtitles_Setting is off and the voice is not audible, THE Call_Subtitle_Overlay
   SHALL be visible.
5. WHILE the Subtitles_Setting is off and the voice is audible, THE Call_Subtitle_Overlay SHALL
   show no line text.
6. WHEN the current Caller_Line changes, THE Call_Subtitle_Overlay SHALL replace the shown text
   with the new line within the same render.
7. THE Call_Subtitle_Overlay SHALL render the line inside one persistent polite live region
   with `aria-atomic="true"` so a repeated render of the same line makes no new announcement.
8. WHILE the current node has no linked dialogue view, THE Call_Subtitle_Overlay SHALL show the
   connecting text.
9. WHERE the voice has a notice (autoplay blocked, development preview, English voice, or no
   audio), THE Call_Subtitle_Overlay SHALL show that notice in a second polite live region.
10. WHILE reduced motion is requested, THE Call_Subtitle_Overlay SHALL change text without a fade.
11. THE Call_Subtitle_Overlay SHALL NOT be a tab stop and SHALL NOT capture pointer events.

### Requirement 6: Layout reserves room for subtitles

**User Story:** As a player, I want the subtitles, the phone and my choices to stay apart, so that
nothing covers anything else.

#### Acceptance Criteria

1. THE Call_Layout SHALL include a Subtitle_Rect.
2. FOR EVERY viewport from 320 to 2560 CSS px wide and from 480 to 1600 CSS px high, THE
   Call_Layout SHALL place the Subtitle_Rect inside the viewport.
3. FOR EVERY viewport in that range, THE Call_Layout SHALL place the Subtitle_Rect so that it
   does not intersect the phone screen rectangle.
4. FOR EVERY viewport in that range, THE Call_Layout SHALL place the Subtitle_Rect so that it
   does not intersect the choice rectangle.
5. WHILE the viewport is narrower than 640 CSS px, THE Call_Layout SHALL place the Subtitle_Rect
   between the phone screen and the choice rectangle.
6. WHILE the viewport is at least 640 CSS px wide, THE Call_Layout SHALL place the Subtitle_Rect
   in the left column above the choice rectangle.
7. THE Call_Layout SHALL keep the existing guarantees: the phone screen aspect ratio, the minimum
   screen width of 132 CSS px, the choice rectangle inside the viewport, and no intersection of
   the screen and the choice rectangle.
8. IF the line text is taller than the Subtitle_Rect, THEN THE Call_Subtitle_Overlay SHALL scroll
   the text vertically and SHALL NOT truncate it.

### Requirement 7: Player choices stay outside the phone

**User Story:** As a player, I want my reply options to look like game controls, so that I can tell
my choices from the caller's words.

#### Acceptance Criteria

1. WHILE a call is active and the dialogue view has options, THE Choice_Overlay SHALL render the
   options outside the Phone_Call_Screen and outside the Call_Subtitle_Overlay.
2. THE Choice_Overlay SHALL remain operable with the mouse and with the keyboard, including the
   number keys 1 to 9.
3. WHEN the player selects an option, THE Call_Presentation SHALL call the page's option handler
   with the option ID and the dialogue SHALL advance to the next node.
4. WHILE the voice gate is waiting for the caller to finish, THE Choice_Overlay SHALL keep showing
   the listening message and the "Show replies now" button.
5. THE Call_Presentation SHALL render the Choice_Overlay without changing its props contract.

### Requirement 8: Call flow and attention

**User Story:** As a player, I want the call to grab my attention and end cleanly, so that I can
follow it.

#### Acceptance Criteria

1. WHEN a call starts ringing, THE Call_Presentation SHALL show the phone in the existing entry
   motion and SHALL move keyboard focus to the Accept button.
2. WHEN the player presses Accept, THE Call_Presentation SHALL unlock audio inside the click and
   call the page's answer handler once.
3. WHEN the player presses End call or Decline, THE Call_Presentation SHALL call the page's end
   handler once, THE Voice_Controller SHALL stop the voice, and the call overlay SHALL close.
4. WHILE the game is paused, THE Call_Presentation SHALL disable every call button and the
   Choice_Overlay.
5. WHEN a call ends, THE Call_Presentation SHALL reset the Speaker_Toggle to the saved
   `phoneVoiceFilter` setting for the next call.
6. WHEN a new call starts, THE Voice_Controller SHALL start with the voice not muted.

### Requirement 9: Preserved contracts

**User Story:** As a maintainer, I want the redesign to be presentation only, so that the game
rules and voice system stay intact.

#### Acceptance Criteria

1. THE Call_Presentation SHALL keep the existing props, the locked `call` overlay entry, the
   `PhoneScreenHost` projection, the 2D fallback and the 200 ms pending grace.
2. THE Call_Presentation SHALL read call and dialogue state through `useChapterState` and SHALL
   create no store.
3. FOR ANY call state, THE visible phone content, the subtitle text and the options SHALL be the
   same in `model` mode and `fallback` mode.
4. THE Call_Presentation SHALL keep the core game working with sound off, with the voice
   unavailable and without the backend.
5. THE Phone_Call_Screen, the Call_Subtitle_Overlay and the new strings SHALL use i18next keys in
   both `en` and `vi`, with one complete string per sentence and no string concatenation.
6. THE feature SHALL use `lucide-react` icons only, with no emoji.
7. THE feature SHALL NOT use the words "safe" or "an toàn" for a number, message, URL or caller.
8. THE feature SHALL show fictional numbers as plain text and SHALL NOT render scenario domains as
   links.
9. THE feature SHALL NOT add a runtime dependency or a dev dependency.
10. THE feature SHALL NOT change `apps/game/src/game/narrative/**`, scenario data or the voice
    engine under `apps/game/src/game/voice/**`.

### Requirement 10: Accessibility

**User Story:** As a player who uses a keyboard or a screen reader, I want the redesigned call to be
operable and announced, so that I am not blocked.

#### Acceptance Criteria

1. THE Phone_Call_Screen SHALL give every button an accessible name that contains its visible
   label.
2. THE Phone_Call_Screen SHALL mark the avatar as decorative with `aria-hidden="true"`.
3. THE Phone_Call_Screen SHALL expose the Call_Timer as a `timer` role with an accessible name.
4. THE Call_Presentation SHALL keep the modal `dialog` role and its accessible name.
5. THE Call_Presentation SHALL give the Call_Subtitle_Overlay an accessible region name.
6. WHILE a button is focused with the keyboard, THE Phone_Call_Screen SHALL show a visible focus
   outline.
7. THE Phone_Call_Screen SHALL NOT convey a state by color alone.

### Requirement 11: Verification and delivery

**User Story:** As a maintainer, I want the change verified and delivered in a reviewable way, so
that I can trust the result.

#### Acceptance Criteria

1. THE feature SHALL include automated tests for: the phone model still rendering, the call
   screen rendered on the phone, the absence of caller line text and option controls on the
   phone, caller info and the Call_Timer shown, options outside the phone, dialogue progression,
   End call, voice playback, and the subtitle overlay when subtitles apply.
2. WHEN all tasks are done, THE `pnpm test`, `pnpm typecheck` and `pnpm build` commands SHALL pass
   and the result SHALL be recorded as executed or not executed in `docs/PROJECT_PROGRESS.md`.
3. THE feature SHALL be committed on the branch `feat/game-phone-call-ui-redesign` with only the
   relevant files staged by name.
4. THE feature SHALL be pushed without force and SHALL NOT be merged.
5. THE feature SHALL update `docs/PROJECT_PROGRESS.md`, `ACCESSIBILITY.md` and
   `docs/architecture/OVERVIEW.md` where the call UI description changes.
