# Requirements Document

## Introduction

This feature expands Chapter 1 ("The Urgent Call") of the SCAMMAZE game app (`apps/game`) into a
complete first-person narrative investigation with a target length of 20 to 30 minutes. The
target is a goal, not a result: it is proposed and unmeasured, and it can be claimed only after
a real playthrough (Requirement 14).

The main change is how characters talk. Today the caller's lines appear as text on the phone
screen. After this feature, the primary way an NPC speaks is a pre-recorded or pre-generated
voice clip played during a phone call. Subtitles are always available as text. The phone screen
shows a believable voice-call UI (caller name, fictional number, status, call duration, call
controls). The player's response choices stay outside the phone in the existing HUD overlay.

The change builds on, and does not replace, these working systems: the deterministic narrative
core, the 3D phone call presentation, the evidence journal, the save system, the en/vi
localization, the chapter loader and the Settings screen. The game stays fully playable with AI
disabled, without a microphone, offline once assets are loaded, and with sound off.

Context and constraints (recorded so the spec is self-contained):

- Branch dependency. The 3D phone call UI (spec `game-3d-phone-call-ui`) lives on branch
  `feat/game-3d-phone-call-ui` (tip `8c93d27` at the time of writing, pushed, not merged to
  `main`). `main` (`507988a`) already holds the en/vi localization (PR #17) and also PRs #18
  and #19. This feature needs the 3D phone, so the new branch `feat/chapter-01-voice-narrative`
  is to be created from `feat/game-3d-phone-call-ui`. Whether to merge `main` into that branch
  first is an owner decision (Open decision 1). This spec phase creates no branch.
- Hybrid intelligence. The deterministic core owns state, rules, evidence, decisions, outcomes
  and progression. Voice, subtitles and sound are presentation only. No AI provider is used.
- Audio files. The agent that writes the code cannot record or generate real speech. The
  feature therefore delivers the playback system, the manifest contract, a production plan and
  an exact missing-recordings report. It does not deliver recordings unless the owner supplies
  them (Open decision 2).
- Steering rules apply: no emoji (use `lucide-react`), fictional bank, domains and numbers only,
  never call a number, message or URL "safe", all user-facing text through i18n or the narrative
  overlay, no string concatenation, repository content in English.

### Audit summary (verified in this session; paths relative to `d:\scam-maze`)

Exists and is reused:

| Area | Verified source paths |
|---|---|
| Narrative core (pure TS, no React/Three/i18n) | `apps/game/src/game/narrative/{reducer,selectors,dialogueEngine,validateScenario,conditions,evidence,objectives,outcome,debrief,localize,store,types}.ts`; boundary test `boundaries.test.ts` |
| Chapter 1 scenario data | `apps/game/src/game/narrative/chapter1/{scenario,ids,claims,evidence,interactables,objectives,phone,decisions,endings,debrief}.ts` and `chapter1/dialogues/{scamCall,callback,officialLine,shopkeeper}.ts` |
| Existing IDs | calls `call.scam-1`, `call.callback`, `call.official`; graphs `dlg.scam-call`, `dlg.callback`, `dlg.shopkeeper`, `dlg.official-line`; 5 objectives; 5 interactables; 11 evidence items; 4 claims; 3 decisions; 3 outcomes (`verified`, `risky`, `uncertain`) (`chapter1/ids.ts`) |
| Dialogue model | `DialogueGraph.lines` maps line IDs to English text; `DialogueNode` has `speaker`, `lineId`, `options`, `onEnter`, `end`; `DialogueOption` has `lineId`, `conditions`, `effects`, `next`, `debriefTag` (`narrative/types.ts`). It has no audio field. |
| Vietnamese overlay (display only) | `apps/game/src/i18n/narrative/chapter1.vi.ts` and `chapter1.vi/{core,decisions,dialogues,evidence,phone,world}.ts`; applied by `narrative/localize.ts` |
| UI dictionaries | `apps/game/src/i18n/locales/{en,vi}/**` (for example `chapters.ts`, `settings.ts`, `menu.ts`) |
| Chapter page and overlays | `apps/game/src/features/chapter1/ChapterOnePage.tsx`, `overlays.ts`, `useCallTriggers.ts`, `useChapterState.ts`, `useCheckpointSaver.ts`, `focusTrap.ts` |
| 3D phone call UI | `apps/game/src/features/chapter1/call/{CallPresentation,PhoneScreenUI,PlayerChoiceOverlay,PhoneScreenHost,PhoneModel3D,callLayout,phoneMotion,phoneScreenSink,phoneReflections,screenQuad,phoneModelStatus}.ts(x)`; shared keys hook `features/chapter1/dialogue/useDialogueOptionKeys.ts`; import boundary test `call/importBoundaries.test.ts` |
| 2D phone apps | `apps/game/src/features/chapter1/phone/*` (home, Messages, Call history, Bank app, Decide) |
| Other Chapter 1 UI | `features/chapter1/{debrief,decision,dialogue,ending,hud,interaction,intro,journal,panels,pause,world}/` |
| Saves | `apps/game/src/game/saves/saveGame.ts`: format version 2 under key `scammaze_save_v2` (accepted `CoreAction` list replayed by `chapterProgress.ts`, max 1000 actions), v1 to v2 migration exists |
| Settings | `apps/game/src/app/settingsStorage.ts` (key `scammaze_settings_v1`); `GameSettings` in `packages/shared-types/src/index.ts` has `graphicsQuality`, `soundEnabled`, `musicVolume`, `sfxVolume`, `fov`, `language` only |
| Audio code (patterns only) | Web Audio in `apps/game/src/app/App.tsx` (menu music, ambience, SFX with gains), `features/vehicle/useVehicleAudio.ts`, `features/player/runtime/{CharacterAudio,CharacterAssetCache}.ts`; `HTMLAudioElement` use in `features/ueh/music.ts` |
| Reduced motion | `apps/game/src/components/ui/usePrefersReducedMotion.ts` (reads the OS media query only) |
| Chapter loader | `apps/game/src/game/chapters/chapterRegistry.ts` (assets with an `optional` flag), `game/loading/chapterLoader.ts`, loading text in `i18n/locales/{en,vi}/chapters.ts` |
| Tests | Vitest + jsdom; `chapter1/playthroughs.test.ts`, `chapter1/content.test.ts`, `dialogueEngine.test.ts`, `validateScenario.test.ts`, `features/chapter1/accessibility.test.tsx`, `i18n/content.vi.test.ts`, helpers `src/test/{seededRandom,chapterRuns,callStates}.ts` |

Does not exist (verified by search; must be created or extended):

- No speech or voice playback code. The search for `speechSynthesis` in `apps/game/src` found
  nothing. No `VoiceDialoguePlayer`.
- No Chapter 1 voice files. `apps/game/public/assets/audio` holds only `button_hover.mp3`,
  `closedoorlx.wav`, `drive.wav`, `hit_punch.mp3`, `menu_ambient.mp3`, `menu_music.mp3`,
  `miss_punch.mp3`, `stop.wav`, `stopCar.wav`. There is no `chapter01` folder.
- No voice volume, subtitle toggle, reduced-stress mode or in-game reduced-motion setting in
  `GameSettings`.
- No audio fields in the scenario schema, no audio manifest, no ringtone or phone-speaker filter.
- No call duration display, no Mute control and no Replay control on the phone screen (to be
  confirmed against `PhoneScreenUI.tsx` in the design phase).
- Only one scripted phone scam call graph (`dlg.scam-call`), one callback graph (`dlg.callback`)
  and one official-line graph (`dlg.official-line`). The number of dialogue nodes is not yet
  counted; the design phase records the count as the baseline.

Items the audit could not confirm and the design phase must verify before relying on them: how
`PhoneScreenUI.tsx` renders the Caller_Line today, whether `settingsStorage.ts` merges missing
keys with defaults, the exact node count per graph, and whether `playthroughs.test.ts` encodes
specific node IDs that a graph change would break.

Flagged content issue: the English prologue string `menu.prologue.location` in
`apps/game/src/i18n/locales/en/menu.ts` is "District 4 · Morning" (Vietnamese: "Quận 4 · Buổi
sáng"). This is a country-specific place name in core content, which the audience rule
discourages. Open decision 3.

Open decisions for the owner are listed at the end of this document.

## Glossary

- **Game_App**: The React application in `apps/game`.
- **Chapter_Page**: `features/chapter1/ChapterOnePage.tsx`, which owns the overlay stack and
  wires the narrative store to the UI.
- **Narrative_Core**: The deterministic code in `apps/game/src/game/narrative/`. It must not
  import React, Three.js or i18n modules.
- **Scenario_Data**: The Chapter 1 content in `apps/game/src/game/narrative/chapter1/`.
- **Narrative_Overlay**: The display-only Vietnamese text in `apps/game/src/i18n/narrative/`,
  keyed by stable content IDs. It never changes IDs, rules, evidence, decisions, outcomes or state.
- **Act**: One of six story parts: (1) An ordinary evening, (2) The first call, (3)
  Investigation, (4) Escalating pressure, (5) The decision, (6) Aftermath.
- **Call**: One phone call defined in Scenario_Data with a display name and a Fictional_Phone_Number.
- **Fictional_Phone_Number**: A number in the reserved `+000` format, shown as plain text and
  never as a link.
- **Dialogue_Node**: One node of a dialogue graph. A node spoken by a non-player speaker is a
  Spoken_Node.
- **Spoken_Node**: A Dialogue_Node whose speaker is `caller` or `npc` and whose line is voiced.
- **Voice_Clip**: One audio file for one Spoken_Node in one locale.
- **Audio_Manifest**: Versioned data, kept apart from rendering code, that maps each Spoken_Node
  and locale to a Voice_Clip entry (see Requirement 4).
- **Clip_Status**: For each Audio_Manifest entry, one of `present` (file exists and is verified
  playable), `missing` (no file), or `placeholder-tts` (development-only synthesized preview).
- **Voice_Dialogue_Player**: The Game_App module that plays Voice_Clips, new or reused from
  existing audio code. It owns playback state and nothing else.
- **Subtitle**: The text of the current Spoken_Node line in the selected locale, shown as a
  caption independent of audio.
- **Phone_Screen_UI**: The HTML content shown on the 3D phone (or the Fallback_Phone_Screen)
  during a Call: `features/chapter1/call/PhoneScreenUI.tsx`.
- **Choice_Overlay**: `features/chapter1/call/PlayerChoiceOverlay.tsx`, which lists the player's
  Dialogue_Options outside the phone.
- **Dev_Speech_Preview**: A development-only text-to-speech preview through the browser
  `speechSynthesis` API, used when a Voice_Clip is missing.
- **Evidence_Item**: One entry of the evidence journal with a stable ID.
- **Verification_Channel**: A way to check a claim independent of the caller (for example the
  official line or the bank app).
- **Ending**: One of the outcomes `verified`, `risky`, `uncertain`, or the optional
  `investigator` outcome.
- **Debrief**: The end-of-chapter explanation of the scam tactic, the player's decisions,
  discovered and missed evidence, and safer alternatives.
- **Reduced_Stress_Mode**: A setting that lowers audio and pacing intensity (Requirement 11.3).
- **Reduced_Motion**: The state where the OS `prefers-reduced-motion: reduce` query matches, or
  the in-game reduced-motion setting is on.
- **Settings**: The persisted `GameSettings` object under key `scammaze_settings_v1`.
- **Content_Validator**: The automated check of Scenario_Data, Audio_Manifest and
  Narrative_Overlay described in Requirement 13.
- **Playtest**: A real, timed, start-to-finish playthrough of Chapter 1 by a human.
- **Developer**: The person or AI coding agent who implements, tests and documents this feature.

## Requirements

### Requirement 1: Audit before changes

**User Story:** As the project owner, I want a verified record of what exists and what must change, so that the work reuses working systems and no feature is claimed without evidence.

#### Acceptance Criteria

1. WHEN implementation of this feature starts, THE Developer SHALL complete an audit of the paths listed in the Audit summary, and SHALL record in `docs/PROJECT_PROGRESS.md` each path that was checked, whether it was reused unchanged, extended or replaced, and each item the Audit summary listed as unconfirmed.
2. THE Developer SHALL record the baseline before any change: the number of Dialogue_Nodes per graph, the number of tests and test files reported by `pnpm test`, and the results of `pnpm typecheck` and `pnpm build`.
3. IF an audit finding contradicts a statement in this document, THEN THE Developer SHALL update this document and record the correction in `docs/PROJECT_PROGRESS.md`.
4. THE Developer SHALL describe only verified behavior as implemented in any report, commit message or progress entry.

### Requirement 2: Expanded six-act narrative

**User Story:** As a player, I want a complete story with a beginning, an investigation and consequences, so that Chapter 1 feels like a full investigation and not a single call.

#### Acceptance Criteria

1. THE Scenario_Data SHALL define Chapter 1 as six Acts in this order: (1) An ordinary evening, (2) The first call, (3) Investigation, (4) Escalating pressure, (5) The decision, (6) Aftermath, and SHALL define for each Act its entry condition, its objectives and its exit condition as data.
2. WHEN Act 1 is active, THE Chapter_Page SHALL let the player explore the apartment and street, learn the interaction controls, and receive a first incoming Call that has a plausible in-world reason, using only locations and interactables that exist in the current 3D scenes.
3. WHEN Act 2 is active, THE Scenario_Data SHALL provide a first Call in which the caller impersonates the fictional "Northgate Bank" under the caller name "Alex", with at least three distinct response choices at the opening node, a way to question the caller's identity, and at least two suspicious signs that the player can notice.
4. WHEN Act 3 is active, THE Scenario_Data SHALL provide at least one contradiction between the caller's claims and the evidence that can be settled only through a Verification_Channel, and SHALL provide no single clue that settles the story alone.
5. WHEN Act 4 is active, THE Scenario_Data SHALL provide a second or follow-up Call whose opening node depends on at least one earlier player decision or discovered Evidence_Item, with at least one new inconsistency in the caller's account.
6. THE Scenario_Data SHALL provide in every Act at least one way for the player to continue without being punished by an unavoidable bad outcome, and SHALL leave the player able to end any suspicious Call.
7. WHEN Act 5 is active, THE Scenario_Data SHALL let the player make the final decision with the evidence found so far, and SHALL keep a safe decision available whether or not all Evidence_Items were found.
8. WHEN Act 6 is active, THE Chapter_Page SHALL show the Ending and the Debrief that reflect the player's actual decisions and discovered evidence (Requirement 10).
9. THE Scenario_Data SHALL keep all existing canonical names where already used: "Northgate Bank", caller "Alex", the existing Call IDs and the existing Dialogue_Graph IDs, unless the design document records a deliberate rename and its save impact (Requirement 12).
10. THE Scenario_Data SHALL teach tactics that exist in many countries (urgency, impersonation, request for a one-time code, request to move money, pressure to stay on the line) and SHALL use no real brand, currency, address format, payment method or reporting channel specific to one country.
11. THE Scenario_Data SHALL avoid blaming the player for falling for a tactic and SHALL not use fear as the main motivator in any line.

### Requirement 3: Proposed content budget and playtime claim

**User Story:** As the project owner, I want a content budget that keeps the chapter inside 20 to 30 minutes without filler, so that scope stays controlled and the playtime claim stays honest.

#### Acceptance Criteria

1. THE design document SHALL record the content budget below as PROPOSED targets, marked unmeasured, and SHALL update each number to the real count when the content is written.
2. THE proposed budget SHALL be: Act 1 about 4 minutes, 0 to 1 Calls, 3 to 4 Spoken_Nodes; Act 2 about 5 minutes, 1 Call, 18 to 24 Spoken_Nodes; Act 3 about 7 minutes, 1 outgoing Verification_Channel Call, 10 to 14 Spoken_Nodes; Act 4 about 5 minutes, 1 Call, 14 to 20 Spoken_Nodes; Act 5 about 3 minutes, 0 new Calls; Act 6 about 3 minutes, 0 new Calls.
3. THE proposed budget SHALL total about 5 Calls (the 3 existing plus up to 2 new), 50 to 70 Spoken_Nodes per locale, 80 to 120 player Dialogue_Options across all graphs, 12 to 16 Evidence_Items, 6 to 9 objectives and 4 to 5 Endings. These numbers are targets and not a promise.
4. THE Scenario_Data SHALL add no new 3D location, scene or interactable whose only purpose is to lengthen play time.
5. THE Developer SHALL report playtime only as a measured value from a Playtest (Requirement 14.4), and SHALL report any number derived from estimates, such as summed audio durations, labeled as an estimate.

### Requirement 4: Audio manifest contract and voice asset strategy

**User Story:** As a content author, I want one versioned manifest that maps each spoken line to an audio file per locale, so that voice assets can be produced, checked and swapped without touching components.

#### Acceptance Criteria

1. THE Game_App SHALL keep the Audio_Manifest in data files separate from React and Three.js code, with a `schemaVersion` field, and SHALL type it so that a Dialogue_Node ID or Voice_Clip entry that does not exist fails the type check or the Content_Validator.
2. THE Audio_Manifest SHALL contain for each Spoken_Node and each supported locale (`en`, `vi`) one entry with these fields: `clipId` (stable, locale-independent), `nodeId`, `graphId`, `speakerId`, `locale`, `sources` (one or more files with MIME type), `durationMs` (measured, or absent while `missing`), `status` (Clip_Status), `voiceNote` (character description for the voice actor or TTS voice), and `credit` (creator and license, or "not provided").
3. THE Audio_Manifest SHALL be adapted to the existing scenario schema by extending it minimally, for example a new optional `voice` map on Spoken_Nodes or a separate manifest keyed by `graphId` and `nodeId`, and SHALL not duplicate the scenario engine or the line text.
4. THE Audio_Manifest SHALL use public paths of the form `/assets/audio/chapter01/<locale>/<clipId>.<ext>` under `apps/game/public/`, consistent with existing audio under `apps/game/public/assets/audio`.
5. THE Game_App SHALL treat a manifest entry as playable only WHEN its Clip_Status is `present`, and THE Content_Validator SHALL confirm that every `present` entry points to a file that exists on disk.
6. THE Developer SHALL write no manifest entry as `present` for a file that does not exist, SHALL fabricate no audio file, and SHALL not report dubbing as complete unless every Spoken_Node has a `present` clip in the locale being reported.
7. THE Developer SHALL deliver a voice asset production plan inside the design document: the full script list with `clipId`, speaker, locale, line text, and a target duration range in seconds; the file format and encoding settings; the naming rule; a loudness target; the maximum file size per clip; and the maximum total size per locale. The plan SHALL mark all numeric targets as PROPOSED (a starting proposal is 24 to 48 kbps mono Opus in an Ogg container as primary, plus an AAC or MP3 source for browsers without Opus, 3 to 15 seconds per clip, at most 150 KB per clip and 6 MB per locale).
8. THE Audio_Manifest SHALL list the clips a Playtest needs in a generated report that names every `missing` clip by `clipId`, locale, speaker and line text, so that the owner can see exactly which recordings are missing.
9. THE design document SHALL record the voice production path decision (Open decision 2) and, for each `present` clip, its creator, license and source. The Game_App SHALL not use a voice clone of a real person.
10. WHERE a licensed pre-generated text-to-speech voice is used, THE `docs` or credits entry SHALL name the voice provider and license, and THE `apps/game/src/config/credits.ts` list SHALL contain one entry for the voice clips.
11. THE Chapter loader SHALL load the Voice_Clips for Act 1 and Act 2 before the Chapter_Page is entered or on first need with a visible fallback, and SHALL not block entry to the chapter when a Voice_Clip fails to load (Requirement 5.7).

### Requirement 5: Voice dialogue playback

**User Story:** As a player, I want to hear the caller speak, so that the call feels like a real conversation.

#### Acceptance Criteria

1. THE Voice_Dialogue_Player SHALL play the Voice_Clip of the current Spoken_Node for the selected locale WHEN a Call is `active` and the current Dialogue_Node changes to a Spoken_Node, or WHEN a Call becomes `active` on a Spoken_Node.
2. THE Voice_Dialogue_Player SHALL offer play, pause, resume, stop and replay of the latest Spoken_Node line, and a volume control that uses the voice volume setting (Requirement 11).
3. WHEN the current Dialogue_Node changes while a Voice_Clip is playing, THE Voice_Dialogue_Player SHALL stop the previous Voice_Clip before the next one starts, so that at most one Voice_Clip is audible at any time.
4. WHEN the Call ends (hang up, decline, or the dialogue ends), WHEN the Chapter_Page unmounts, or WHEN the player leaves the chapter, THE Voice_Dialogue_Player SHALL stop playback within 100 milliseconds and SHALL release its audio resources and event listeners.
5. THE Voice_Dialogue_Player SHALL start audio only after the browser allows it, using the player's first explicit interaction in the Game_App (for example the Start or Continue button or the Accept button) to unlock the audio context, and SHALL not throw when the browser blocks autoplay.
6. IF the browser blocks audio when a Spoken_Node starts, THEN THE Phone_Screen_UI SHALL show the Subtitle and a visible Replay control, and SHALL play the clip when the player activates Replay.
7. IF a Voice_Clip is `missing`, fails to load or fails to decode, THEN THE Voice_Dialogue_Player SHALL show the Subtitle, SHALL report the failure to the Content_Validator log once per clip per session, SHALL not block the dialogue, and SHALL use the Dev_Speech_Preview only under Requirement 6.
8. THE Narrative_Core SHALL decide when a dialogue node completes from state and player input only; THE Voice_Dialogue_Player SHALL report playback end as presentation information and SHALL not change Narrative_Core state.
9. WHERE a node is authored with a `waitForVoice` option, THE Choice_Overlay SHALL show the player's options only after the Voice_Clip ends, within 300 ms, or after the player activates a Skip control; otherwise THE Choice_Overlay SHALL show the options as soon as the node starts.
10. WHEN the Voice_Clip of a Spoken_Node ends and the node has no authored automatic transition, THE Game_App SHALL not advance the dialogue.
11. WHEN Settings sound is off or the voice volume is 0, THE Voice_Dialogue_Player SHALL play no audio, SHALL keep Subtitles visible, and SHALL not change the dialogue flow.
12. THE Voice_Dialogue_Player SHALL use no new runtime dependency unless the design document justifies it, and SHALL use no telephony, WebRTC or microphone API.
13. THE Voice_Dialogue_Player SHALL be implemented without importing React or Three.js in its playback logic, so that it can be tested with a test double for the audio element or audio context; the React hook that connects it to the Chapter_Page SHALL be a separate file.

### Requirement 6: Missing recordings and development speech preview

**User Story:** As the owner, I want the game to stay playable and honest while recordings are missing, so that I can test the story before all audio exists.

#### Acceptance Criteria

1. IF no Voice_Clip is `present` for a Spoken_Node in the selected locale, THEN THE Game_App SHALL show the Subtitle and the Phone_Screen_UI call controls and SHALL let the player complete the Call without audio.
2. WHERE the Dev_Speech_Preview is enabled and `speechSynthesis` is supported, THE Voice_Dialogue_Player SHALL speak the Subtitle text for a Spoken_Node whose Voice_Clip is not `present`, using a voice whose language tag matches the selected locale when one is available.
3. THE Dev_Speech_Preview SHALL be off by default, SHALL be enabled only in development builds (`import.meta.env.DEV`) or through an explicit developer flag, and SHALL not appear in the production Settings screen.
4. WHILE the Dev_Speech_Preview is speaking, THE Phone_Screen_UI SHALL show a visible label that names the audio as a development preview, from a Translation_Key in both locales.
5. IF no voice matches the selected locale, THEN THE Dev_Speech_Preview SHALL stay silent for that line and the Subtitle SHALL remain visible; it SHALL not speak Vietnamese text with an English voice and present it as Vietnamese audio.
6. THE Dev_Speech_Preview SHALL follow the same stop, overlap, mute and cleanup rules as Voice_Clips (Requirements 5.3, 5.4, 5.11).
7. THE Game_App SHALL not count a Dev_Speech_Preview line as a `present` clip in any report.
8. WHEN the Developer reports audio status, THE report SHALL state the count of `present`, `placeholder-tts` and `missing` clips per locale and SHALL list every `missing` clip.

### Requirement 7: Voice-first phone screen

**User Story:** As a player, I want the phone to look like a real voice call, so that I focus on listening and not on reading paragraphs.

#### Acceptance Criteria

1. WHILE a Call is `ringing`, THE Phone_Screen_UI SHALL show the incoming-call label, the caller display name, the Fictional_Phone_Number, the ringing status, an Answer button and a Decline button.
2. WHILE a Call is `active`, THE Phone_Screen_UI SHALL show the caller display name, the Fictional_Phone_Number, the active status, a call duration counter, a Mute control, a Replay control and a Hang up button.
3. WHILE a Call is `active`, THE Phone_Screen_UI SHALL show the Subtitle in a short caption panel limited to the current line, and SHALL show it only WHEN the subtitle setting is on or the Voice_Clip for the line is not playable.
4. THE Phone_Screen_UI SHALL show no player Dialogue_Option and no long dialogue paragraph; the Choice_Overlay outside the phone SHALL stay the only place where the player's options appear.
5. THE call duration counter SHALL count whole seconds from the moment the Call becomes `active`, SHALL be derived from the presentation clock, and SHALL not be stored in Narrative_Core state or saves.
6. WHEN the player activates Mute, THE Voice_Dialogue_Player SHALL silence the caller's audio for the Call, THE Mute control SHALL show its pressed state by text or `aria-pressed`, and the Subtitle SHALL stay visible.
7. WHEN the player activates Replay, THE Voice_Dialogue_Player SHALL replay the latest Spoken_Node line from its start, SHALL stop any current playback first, and SHALL change no Narrative_Core state.
8. THE Phone_Screen_UI SHALL build all labels from Translation_Keys in `apps/game/src/i18n/locales/{en,vi}/chapter1/`, with `lucide-react` icons marked `aria-hidden="true"` next to visible text, and SHALL contain no emoji.
9. THE Phone_Screen_UI SHALL keep the rules of `game-3d-phone-call-ui` that already apply: the Fictional_Phone_Number as plain text with `dir="ltr"`, no verified or "safe" badge, a polite live region for a changed line, and native buttons with visible focus.
10. THE Phone_Screen_UI SHALL be used by the 3D Phone_Model_View and by the Fallback_Phone_Screen with the same content and handlers, and SHALL import no `three`, `@react-three/fiber` or `@react-three/drei` module (the existing `call/importBoundaries.test.ts` stays in force).
11. WHERE the Call is a face-to-face conversation (NPC Sam), THE Chapter_Page SHALL keep using the existing `DialoguePanel` presentation, and Sam's lines SHALL also use the Voice_Dialogue_Player and Subtitles through that presentation.

### Requirement 8: Player choices in the HUD

**User Story:** As a player, I want meaningful choices in a game overlay outside the phone, so that I decide while I listen.

#### Acceptance Criteria

1. WHILE a Call is `active` and the current node has options, THE Choice_Overlay SHALL list every available Dialogue_Option from the Narrative_Core selector in order, once each, outside the Phone_Screen_UI element tree.
2. THE Scenario_Data SHALL give each player decision node between 2 and 4 Dialogue_Options, except nodes that have a single authored continuation.
3. THE Choice_Overlay SHALL support mouse, touch and keyboard (Tab, arrow keys, Home, End, number keys 1 to 4, Enter, Space), and SHALL show distinct default, hover, focus, pressed, selected and disabled states that differ in a visible property other than color alone.
4. WHEN the player selects a Dialogue_Option, THE Choice_Overlay SHALL dispatch at most one `SELECT_DIALOGUE_OPTION` action for that node, even after repeated activation before the next node renders.
5. WHEN a Voice_Clip ends, THE Game_App SHALL not select an option or advance the node unless Requirement 5.9 applies.
6. THE Choice_Overlay SHALL let the player replay the caller's latest line through a Replay control that is outside the Phone_Screen_UI or through the phone Replay control, and SHALL keep keyboard focus on the same element after a replay.
7. THE Game_App SHALL preserve the camera, pointer lock and Player_Controller behavior defined in `game-3d-phone-call-ui` Requirement 6 and Requirement 7.
8. THE Choice_Overlay SHALL show each option text from the display scenario (English or Vietnamese overlay) and SHALL not show hidden consequences or the scoring of an option.
9. WHILE the Chapter_Page is paused, THE Choice_Overlay SHALL render all options as disabled and SHALL ignore number keys.

### Requirement 9: Dialogue tree, tones and call behavior

**User Story:** As a player, I want the caller to react to what I say, so that the conversation feels alive and my choices matter.

#### Acceptance Criteria

1. THE Scenario_Data SHALL provide response options across these categories somewhere in Chapter 1: identity verification, asking for transaction details, challenging authority, requesting time, independent verification, refusing a suspicious request, ending a Call safely, and following a simulated risky instruction.
2. THE Scenario_Data SHALL tag each caller line with an authored tone: `professional`, `reassuring`, `defensive`, `impatient` or `pressuring`, and the tone SHALL be deterministic data, not random.
3. THE Dialogue_Engine SHALL choose every next node from the current node, the selected option, flags, claim status, evidence and pressure level, and SHALL use no random value.
4. WHEN the player has discovered a given Evidence_Item or set a given flag, THE Scenario_Data SHALL make a stated set of options or caller lines available or change them through `conditions` and `startNodeWhen`, so that at least five earlier decisions or Evidence_Items change later dialogue.
5. WHEN the player raises a point that the Evidence_Item supports (for example a number mismatch), THE caller SHALL respond with a line that reacts to that point and not with a generic line.
6. THE Scenario_Data SHALL escalate caller pressure over the chapter through the existing pressure level (0 to 3), and SHALL give the player an exit (hang up, request time, or independent verification) at every pressure level.
7. THE Scenario_Data SHALL write caller lines in the voice of a fictional scammer in a defensive training context, and SHALL include no real credentials, real account details, working payment instructions or step-by-step content usable for real fraud.
8. THE Scenario_Data SHALL write each line as one complete sentence set for translation, in plain English with short sentences, and SHALL write all Vietnamese lines as natural, non-literal speech.
9. THE Scenario_Data SHALL include enough authored content for the Act budget in Requirement 3 and SHALL include no repeated filler lines added only to reach a node count.

### Requirement 10: Investigation, evidence and verification

**User Story:** As a player, I want to look for clues in the world and on my devices, so that my decision rests on what I found.

#### Acceptance Criteria

1. THE Scenario_Data SHALL define each Evidence_Item with a stable ID, a source (physical, device, dialogue, npc, verification), a discovery method, the claims it relates to with a stance, its meaning, its warning signs, and a debrief hint for the case where it is missed.
2. THE Scenario_Data SHALL include these evidence types, using existing items where they fit: suspicious caller information; a contradiction between account or transaction information and the caller's claim; a Verification_Channel result; a historical account notification or document; a clue in the 3D environment; and a clue on a virtual device (phone or computer).
3. THE Game_App SHALL use the existing interaction system and the existing locations (`apartment`, `street`), and SHALL fit each new Evidence_Item to an object that already exists in the 3D scene or to a virtual device screen.
4. WHERE a computer screen is used as a clue source, THE Game_App SHALL implement it as a 2D overlay opened by an existing interactable, and SHALL not add a new 3D scene for it.
5. WHILE a Call is on hold, ended, or declined, THE Chapter_Page SHALL let the player explore and inspect evidence according to authored rules in Scenario_Data.
6. THE Chapter_Page SHALL let the player end any suspicious Call at any time, and no evidence, objective or ending SHALL require the player to stay on a Call.
7. WHEN the player ends a Call early, THE Scenario_Data SHALL provide a way for the scammer to call again or for the story to continue, so that no soft lock results (Requirement 13).
8. THE Scenario_Data SHALL never mark any number, message or URL as "safe"; verification results SHALL be worded as "matches the official record" or "does not match", or an equivalent neutral phrase.
9. THE Game_App SHALL analyze any URL shown in evidence by string only, SHALL not fetch or load it, and SHALL show scenario domains as plain text.

### Requirement 11: Settings, audio mix and accessibility

**User Story:** As a player with different needs, I want to control voice, captions and intensity, so that I can play comfortably.

#### Acceptance Criteria

1. THE `GameSettings` type in `packages/shared-types` SHALL be extended with: `voiceVolume` (0.0 to 1.0), `subtitlesEnabled` (boolean), `reducedStress` (boolean) and `reducedMotion` (`system`, `on` or `off`), and the Settings screen SHALL expose each with a label from Translation_Keys in both locales. The existing `soundEnabled` and `musicVolume`/`sfxVolume` settings SHALL keep their meaning, and the master volume SHALL be the existing sound setting unless the design document justifies a new field.
2. WHEN `scammaze_settings_v1` was saved before this feature, THE Game_App SHALL load it without error and SHALL fill each new field with its default (proposed defaults: `voiceVolume` 1.0, `subtitlesEnabled` true, `reducedStress` false, `reducedMotion` `system`), and SHALL keep all existing values.
3. WHILE Reduced_Stress_Mode is on, THE Game_App SHALL lower ringtone and tension-sound volume to a stated fraction of normal, SHALL remove the ringing vibration, SHALL lengthen the pause before the caller's pressure lines by an authored amount, and SHALL keep all story content and outcomes unchanged.
4. WHILE the `reducedMotion` setting is `on`, or is `system` and the OS query matches, THE Game_App SHALL apply Reduced_Motion to the phone entry animation, the ringing vibration and any new motion added by this feature.
5. THE Subtitles SHALL be on by default, SHALL show the speaker label and the current line, and SHALL be independent of whether audio plays.
6. WHERE a non-speech sound conveys information (ringtone, connection sound, a notification), THE Game_App SHALL show a caption or visual cue for it that works when sound is off.
7. THE Game_App SHALL not present any information only through audio; every Spoken_Node line SHALL be available as a Subtitle, and every ring SHALL be visible on the Phone_Screen_UI.
8. THE Game_App SHALL be playable with the keyboard alone, including answering, hanging up, muting, replaying, choosing an option and reading the Debrief.
9. THE Game_App SHALL keep text contrast of at least 4.5:1 and a visible focus indicator of at least 3:1 for all new controls.
10. THE Game_App SHALL contain no jump-scare sound and no continuous loud alarm sound, and SHALL cap the peak level of every ambient or tension sound at a value recorded in the design document.

### Requirement 12: English and Vietnamese localization

**User Story:** As a player in Vietnam or elsewhere, I want the voice, captions and UI in my language, so that I understand the story.

#### Acceptance Criteria

1. THE Game_App SHALL use the Settings language to choose the Subtitle language and the Voice_Clip locale; narrative IDs (node, option, clip, evidence, flag) SHALL stay language independent.
2. THE Scenario_Data SHALL keep English as the authored source, and THE Narrative_Overlay SHALL hold the Vietnamese text for every new line, option, objective, evidence text, ending and debrief text, keyed by stable content IDs.
3. THE Game_App SHALL add every new UI text to both `locales/en` and `locales/vi` dictionaries, with one complete string per sentence and interpolation variables, and SHALL use no string concatenation.
4. IF a Vietnamese Voice_Clip is not `present` for a line, THEN THE Game_App SHALL show the Vietnamese Subtitle, and WHERE an English Voice_Clip is `present` and the owner enables the English-voice fallback, THE Game_App SHALL play the English clip with a visible label that names the audio as English.
5. THE Game_App SHALL not label English audio as Vietnamese, and SHALL not play a clip whose manifest locale differs from the label shown.
6. WHEN the player changes the language during the chapter, THE Game_App SHALL change the Subtitle, UI text and the next Voice_Clip locale, SHALL stop the current clip, SHALL keep the Narrative_Core state, the saved progress and the call state unchanged, and SHALL not restart the dialogue.
7. THE existing content lint (`apps/game/src/i18n/content.vi.test.ts`) SHALL cover the new Vietnamese text and SHALL keep its rules: no "an toàn" used as a safety claim, reserved domains only, `+000` numbers, no emoji, and "Northgate Bank" never translated.
8. WHERE the owner decides to neutralize the "District 4" prologue text (Open decision 3), THE Game_App SHALL replace it in both locales with a text that names no real district.

### Requirement 13: Validation, save compatibility and soft-lock prevention

**User Story:** As a developer, I want automatic checks of the content and safe handling of old saves, so that a bad edit or an old save cannot break the chapter.

#### Acceptance Criteria

1. THE Content_Validator SHALL fail with a clear message for each of these: a node ID or option target that does not exist; an unreachable node or branch; a cycle with no exit; a dead end that is not an authored end; an Evidence_Item, flag, claim or objective reference that does not exist; a condition that can never be true; a Spoken_Node without a Subtitle line in `en` or `vi`; a manifest entry for a node that does not exist; a `present` entry whose file does not exist; and a Spoken_Node without a manifest entry.
2. THE Content_Validator SHALL extend the existing `validateScenario.ts` and its tests, SHALL not duplicate its checks, and SHALL be pure TypeScript with no React or Three.js import.
3. THE Content_Validator SHALL prove that every Ending is reachable and that, from every reachable state, at least one Ending is reachable (no soft lock), including after the player hangs up early, declines a Call or leaves a Call on hold.
4. THE Game_App SHALL keep loading saves of format version 2 created before this feature. The design document SHALL choose one of: (a) keep format version 2 and make the new content compatible with old action logs, or (b) bump to a new format version with a migration. The choice is Open decision 4, and the design document SHALL state the effect on a player with an old save.
5. IF a saved action log no longer replays against the new Scenario_Data, THEN THE Game_App SHALL restore the latest valid checkpoint or start the chapter from the beginning, SHALL not crash, and SHALL tell the player in a localized message.
6. THE Game_App SHALL not store audio state, call duration, subtitle text or speech state in saves.
7. THE existing tests (`playthroughs.test.ts`, `boundaries.test.ts`, `call/importBoundaries.test.ts`, `accessibility.test.tsx`, `content.vi.test.ts`, the Main Menu, loading and Settings tests) SHALL keep passing. THE Developer SHALL update a test only when the Scenario_Data change makes its expected values obsolete, SHALL record each such update and its reason in `docs/PROJECT_PROGRESS.md`, and SHALL not delete, skip or weaken an assertion without recording it.

### Requirement 14: Endings, debrief and playtest

**User Story:** As a player, I want clear consequences and an explanation of what happened, so that I learn the pattern without being blamed.

#### Acceptance Criteria

1. THE Scenario_Data SHALL provide at least three reachable Endings: SAFE (`verified`, through independent verification), RISKY (`risky`, the player follows a simulated fraudulent instruction with a fictional loss) and UNCERTAIN (`uncertain`, the player refuses pressure but does not establish the truth).
2. WHERE the optional INVESTIGATOR Ending is included, THE Scenario_Data SHALL grant it only WHEN the player has found a stated strong set of Evidence_Items and has completed an incident report step, and THE design document SHALL state the evidence set.
3. THE Narrative_Core SHALL decide the Ending deterministically from state, and no random value, audio event or AI output SHALL influence it.
4. THE Debrief SHALL list the tactic used, the decisions the player made, the Evidence_Items found and the ones missed with their debrief hints, and safer alternatives, and SHALL read from the Narrative_Core state and event log.
5. THE Scenario_Data SHALL not reward a dangerous action: no Ending SHALL give a higher result for sharing a one-time code, moving money or staying on a suspicious Call.
6. THE Ending and Debrief text SHALL say that nothing real happened (the simulation label) and SHALL not blame the player.
7. THE Game_App SHALL offer a replay of the chapter after the Debrief.
8. WHEN the Developer reports playtime, THE report SHALL give the time measured in at least one Playtest from the first Main Menu action to the end of the Debrief, with the Ending reached; IF no Playtest was done, THEN THE report SHALL state that playtime is not measured.
9. THE Developer SHALL not describe Chapter 1 as complete until a human has played it from start to finish.

### Requirement 15: Ambient audio and cinematic pacing

**User Story:** As a player, I want sound that supports the mood without scaring me, so that the call feels tense but fair.

#### Acceptance Criteria

1. WHERE ambient or effect audio assets exist, THE Game_App SHALL play, through the existing Web Audio patterns and the `sfxVolume` setting, an optional ringtone, a connection sound and room or street ambience, and SHALL list each asset in the Audio_Manifest or the credits with creator and license.
2. WHERE no ringtone asset exists, THE Phone_Screen_UI SHALL still show the ringing status visually (Requirement 11.7).
3. WHERE the design document includes a phone-speaker voice filter, THE Voice_Dialogue_Player SHALL apply it as a Web Audio filter chain at playback time to caller clips only, and THE filter SHALL be optional and removable without changing the Voice_Clip files.
4. WHEN the Narrative_Core raises the pressure level, THE Game_App MAY raise a tension sound within the cap in Requirement 11.10, and SHALL lower it again when pressure drops or the Call ends.
5. THE Scenario_Data MAY include short authored pauses between caller lines, and SHALL express each as data with a duration in milliseconds.
6. THE Game_App SHALL stop or fade out ringtone, tension and Voice_Clips when the Call ends, the pause menu opens or the chapter exits, and SHALL resume only what the new state requires.

### Requirement 16: Architecture and maintainability

**User Story:** As a developer, I want story, audio data, rendering and playback kept separate, so that each part is easy to change and test.

#### Acceptance Criteria

1. THE Game_App SHALL keep story, dialogue, evidence, decision rules, endings, localization and the Audio_Manifest in data modules, and SHALL put no chapter dialogue text in JSX or Three.js code.
2. THE Narrative_Core SHALL keep passing `boundaries.test.ts` with no import of React, Three.js, R3F, Drei, i18n or audio APIs, and with no allowlist entry added for this feature.
3. THE Game_App SHALL keep these as separate files: the Audio_Manifest data, the Voice_Dialogue_Player logic, the React hook that connects it to the Chapter_Page, the Phone_Screen_UI, and the Choice_Overlay.
4. THE Developer SHALL extend the scenario schema minimally, SHALL give new schemas a version field, and SHALL use stable IDs for all new content.
5. THE Developer SHALL add no new database, backend call, AWS resource, paid service or LLM provider, and SHALL justify any new dependency in `docs/PROJECT_PROGRESS.md`.
6. THE Game_App SHALL work offline once assets are loaded and without AI, a backend or a microphone.

### Requirement 17: Tests and validation

**User Story:** As a developer, I want automated tests for the narrative, audio, localization and gameplay, so that regressions are caught before merge.

#### Acceptance Criteria

1. THE Game_App test suite SHALL include narrative tests that show: all Endings are reachable; every node and option target is valid; every evidence, flag, claim and objective reference is valid; no soft lock exists; and earlier decisions change later dialogue.
2. THE Game_App test suite SHALL include audio tests, using a test double for the audio API, that show: the correct clip is chosen for each Spoken_Node and locale; no two clips overlap on quick node changes; Replay restarts the latest line; Hang up and chapter exit stop playback and release listeners; mute and volume settings are respected; blocked autoplay shows the Subtitle and Replay; and a missing or failing clip falls back to the Subtitle.
3. THE Game_App test suite SHALL include localization tests that show: Subtitles appear in `en` and `vi`; clip locale choice respects availability; no English clip is labeled Vietnamese; and a language switch keeps progress.
4. THE Game_App test suite SHALL include gameplay tests that show: the 3D phone call UI is used; choices render outside the phone; evidence changes available options; an Ending and the Debrief are reached; and a full run passes with AI disabled and with no microphone.
5. THE Game_App test suite SHALL include property-based tests over seeded random option sequences for every Call graph, with at least 100 cases, that show: the Narrative_Core state after choices through the Choice_Overlay equals the state after dispatching the same actions directly, and every run reaches an Ending or an authored safe exit.
6. THE Game_App tests SHALL run without network access, without a WebGL context, without real audio devices and without an AI provider.
7. WHEN the feature is complete, THE Developer SHALL run `pnpm test`, `pnpm typecheck` and `pnpm build` one after the other (never `pnpm test` and `pnpm typecheck` in parallel), and SHALL record the real exit status and pass, fail and skip counts of each in `docs/PROJECT_PROGRESS.md`. The baseline on the phone branch is 81 test files and 752 tests passing, with typecheck and build passing.
8. IF any command fails or cannot run, THEN THE Developer SHALL record which one and why, and SHALL not describe the feature as complete or verified.

### Requirement 18: Delivery and documentation

**User Story:** As the project owner, I want the work delivered in small, reviewable steps with an honest report, so that I can merge it safely.

#### Acceptance Criteria

1. THE Developer SHALL work on a branch named `feat/chapter-01-voice-narrative` created from the branch chosen in Open decision 1, SHALL preserve uncommitted and teammate work in the working tree, and SHALL not create or switch branches during the requirements phase.
2. THE Developer SHALL make small commits with Conventional Commit headers, SHALL keep the human as author with a `Co-authored-by` trailer for the agent, and SHALL stage only files this feature created or modified.
3. THE Developer SHALL push without force options, SHALL not push to or merge into `main` or any other base branch, and SHALL leave the merge to the owner.
4. THE Developer SHALL follow this implementation order, mapped to tasks later: audit; narrative and dialogue graph; audio and localization contracts; voice playback with Subtitle sync; update the 3D phone call UI; integrate the external Choice_Overlay; investigation objectives and evidence; escalating caller behavior; Endings and Debrief; audio assets or documented development fallbacks; tests, Playtest and optimization. The Developer SHALL not start by rebuilding unrelated 3D scenes or by adding an AI provider.
5. THE Developer SHALL update `docs/PROJECT_PROGRESS.md` after each meaningful task with the entry fields required by `AGENTS.md`, and SHALL create no redundant Markdown files.
6. THE final report SHALL list: files changed; the narrative structure; the Dialogue_Node count; audio implemented and audio missing (per locale, per Clip_Status); localization coverage; Evidence_Items and Endings; measured playtime (if any); real test, typecheck and build results; and known limitations.
7. THE Developer SHALL update `docs/architecture/OVERVIEW.md` and any other document whose description of the Chapter 1 call UI or audio no longer matches the implementation, keeping status labels correct.

## Open decisions for the owner

1. Branch base. Create `feat/chapter-01-voice-narrative` from `feat/game-3d-phone-call-ui` (recommended, because the 3D phone lives there), and decide whether to merge `main` into that branch first to pick up PRs #18 and #19, or to wait until the phone branch is merged.
2. Voice production path. Choose human voice actors or licensed pre-generated TTS for `en` and `vi`, name who produces and checks the files, and confirm the license and credit text. Voice cloning of real people is not allowed. Until files exist, the chapter runs with Subtitles and the development-only speech preview.
3. The "District 4" prologue text. Decide whether to replace it with a neutral location in both locales (recommended by the audience rule).
4. Save format. Decide whether to keep format version 2 with compatible content, or bump the version with a migration. A bump is safer if existing node IDs change.
5. Proposed numbers. Confirm or change the content budget (Requirement 3) and the audio targets (Requirement 4.7). They are proposals and have not been measured.
6. Optional items. Decide whether to include the INVESTIGATOR Ending, the phone-speaker voice filter, the English-voice fallback for Vietnamese, and the new second Calls.
7. Unoptimized assets. Decide where recordings are stored in the repository and whether large source files stay out of `apps/game/public/` so they are not copied into `dist`.
