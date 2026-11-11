# Implementation Plan: Game localization (English and Vietnamese)

## Overview

The plan builds the feature in dependency order. The I18n_Module skeleton, the `language` setting
and the pure narrative localization come first. Settings persistence and the Language_Selector
follow, then string extraction by area: shared screens, the Vietnamese narrative overlay, the
Chapter 1 interface and the teammate world pages. Cross-cutting tests and documentation close the
plan. All code is TypeScript in `apps/game` and `packages/shared-types`.

Translation work is split by file so several agents can work at the same time. Each namespace has
its own `en` and `vi` file, `chapter1` and `worlds` are composed from area files, and the
Vietnamese narrative overlay is composed from area parts (design, section 1, "File-split rule").
A task edits only the files it names. When a component API must change, keep it backward
compatible inside the area task and switch the caller in the wiring task.

Rules for every task:

- Work on branch `feat/game-i18n-en-vi`, created from `feat/chapter-01-playable` at `8fed327`
  (the branch already exists locally; check `git branch --show-current` before the first task).
  Create local commits only. Do not push.
- Test sub-tasks are required, not optional.
- Property tests use the seeded helpers in `src/test/seededRandom.ts` and `src/test/chapterRuns.ts`
  with at least 100 cases each (`CORE_PROPERTY_RUNS` = 200). Each property is one `it(...)` with the
  comment `// Feature: game-i18n-en-vi, Property N: <title>`. Do not add fast-check or any other
  dev dependency.
- `apps/game/src/game/narrative/**` must not import `i18next`, `react-i18next`, `src/i18n/`, React
  or Three.js.
- Repository content (code, comments, identifiers, docs, commit messages) is English. Vietnamese
  appears only in `src/i18n/locales/vi/**`, `src/i18n/narrative/chapter1.vi*`, `LOCALE_LABELS` and
  tests that assert Vietnamese output. Vietnamese text is natural, everyday Vietnamese with correct
  diacritics, in Unicode NFC.
- No emoji anywhere. Keep "SCAMMAZE" and "Northgate Bank" verbatim. Use only reserved domains
  (`.test`, `.example`, `.invalid`) and `+000` phone numbers. Never call anything "safe" in English
  and never use "an toàn" in Vietnamese. No currency.
- Keep asset names, creator names, license names, source URLs, landmark and place names
  untranslated.
- Commit sub-tasks use Conventional Commits, stage named files only (never `git add -A` or
  `git add .`; leave unrelated untracked files such as `iphoneModel/` and other specs'
  `tasks.meta.json` alone), and end the message with
  `Co-authored-by: Kiro Agent <244629292+kiro-agent@users.noreply.github.com>`.
- After each code task, run the related tests with
  `pnpm --filter @scammaze/game exec vitest run <paths>` and report the observed result.

## Tasks

- [x] 1. Foundations
  - [x] 1.1 Add the i18n dependencies
    - Confirm the current branch is `feat/game-i18n-en-vi` and that it contains `8fed327`
    - Run `pnpm --filter @scammaze/game add i18next@27.1.1 react-i18next@18.0.1`
    - Confirm the installed versions in `apps/game/node_modules/i18next/package.json` and
      `apps/game/node_modules/react-i18next/package.json` and that pnpm reports no peer warning
    - Files: `apps/game/package.json`, `pnpm-lock.yaml`
    - _Requirements: 1.2, 13.5_
  - [x] 1.2 Add `GameLocale` and `GameSettings.language`
    - In `packages/shared-types/src/index.ts`, add `export type GameLocale = "en" | "vi";` and the
      `language: GameLocale` field with its doc comment, as in design Data Models
    - Add `language: "en"` to every full `GameSettings` literal the type checker reports:
      `apps/game/src/app/App.tsx` (`DEFAULT_SETTINGS`),
      `features/chapter1/accessibility.test.tsx`, `features/chapter1/ChapterOnePage.test.tsx`,
      `features/chapter1/ChapterOnePage.restore.test.tsx`, and any other file `pnpm typecheck`
      names
    - Run `pnpm typecheck`
    - _Requirements: 2.1, 2.2_
  - [x] 1.3 Create the I18n_Module skeleton
    - Create `apps/game/src/i18n/` with `locales.ts` (`SUPPORTED_LOCALES`, `DEFAULT_LOCALE`,
      `isSupportedLocale`, `LOCALE_LABELS`), `types.ts` (`LocaleShape<T>`), `resources.ts`
      (`NAMESPACES`, typed `resources`), `index.ts` (`i18n` instance, `initI18n`, `applyLocale`),
      `i18next.d.ts` (`CustomTypeOptions`), `format.ts` (`formatNumber`, `formatPercent`,
      `formatDate`, cached per locale and options) and `useGameLocale.ts`, as in design section 1
    - Configure i18next with bundled resources, `initAsync: false`, `fallbackLng: "en"`,
      `supportedLngs`, `defaultNS: "common"`, `interpolation.escapeValue: false`,
      `react.useSuspense: false`; add no backend and no language detector
    - Create every locale file for `en` and `vi`: `common.ts`, `menu.ts`, `settings.ts`,
      `loading.ts`, `credits.ts`, `chapters.ts`, `chapter1/{index,hud,phone,story,outcome}.ts`,
      `worlds/{index,hcm,testmove,ueh,hue}.ts`. Area files start as empty objects; each `index.ts`
      spreads its area files; every `vi` file is typed `LocaleShape<typeof en>`
    - Author `common` completely in both locales (design section 3), including
      `actions.returnToMenu` = "Return to menu" / "Về menu chính" and `loading` = "Loading" /
      "Đang tải" in the same letter case as the English source
    - If the typed `t` from `i18next.d.ts` conflicts with the installed types, keep the
      augmentation for `resources` only and note the choice in a code comment
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 1.7, 1.8, 5.1, 5.2, 6.1, 6.4, 7.9_
  - [x] 1.4 Initialize i18n in the test setup
    - In `apps/game/src/test/setup.ts`, call `initI18n("en")` once and `applyLocale("en")` in
      `afterEach`
    - Run `pnpm test` and confirm every existing test still passes
    - _Requirements: 14.1, 14.11_
  - [x] 1.5 Write the init and key-consistency tests
    - Create `src/i18n/init.test.ts`: on a fresh instance, `t` returns Vietnamese text directly
      after `initI18n("vi")`; no backend plugin is registered; `react.useSuspense` is false;
      `navigator.language = "vi"` does not change the initial locale; `isSupportedLocale` accepts
      only `"en"` and `"vi"`; `formatPercent` and `formatDate` examples for both locales
    - Create `src/i18n/resources.test.ts`: per namespace, the same Plural_Base_Keys in `en` and
      `vi`; the same `{{variables}}` per key; no empty or whitespace-only text; every `vi` text
      equals its NFC form; `chapter1` and `worlds` area files have disjoint top-level key groups;
      `LOCALE_LABELS` are "English" and "Tiếng Việt". The test reads all dictionaries, so it
      covers text added by later tasks
    - _Requirements: 1.1, 1.3, 1.4, 1.6, 1.8, 5.2, 5.3, 5.4, 5.5, 5.9, 6.4, 14.7_
  - [x] 1.6 Name the i18n packages in the narrative boundaries test
    - In `src/game/narrative/boundaries.test.ts`, add `i18next` and `react-i18next` to the
      forbidden list, plus a fixture line for each that the checker must reject, and a check that
      no file imports from `src/i18n/`
    - _Requirements: 10.2_
  - [x] 1.7 Commit the foundations
    - Stage `apps/game/package.json`, `pnpm-lock.yaml`, `packages/shared-types/src/index.ts`,
      the files changed in 1.2, the files created in 1.3 and 1.5 (not `src/i18n/narrative*`),
      `src/test/setup.ts` and `src/game/narrative/boundaries.test.ts`
    - Message: `feat(game): add i18next locale module with English and Vietnamese resources`

- [x] 2. Narrative localization core (pure)
  - [x] 2.1 Implement `localizeScenario`
    - Create `src/game/narrative/localize.ts` with `NarrativeOverlay`, `NarrativeTextEntry`,
      `narrativeTextEntries`, `localizeScenario` and `localizeInteractionPrompts`, using one
      walker for listing and rebuilding, and the key scheme in design section 9
    - Use the overlay text only when it is a non-empty string; copy IDs, numbers, domains,
      conditions, effects and ordering unchanged; throw with the evidence ID when two relations of
      one item share a `claimId`; never mutate the inputs
    - Import nothing outside `game/narrative/` except `@scammaze/shared-types`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 10.3_
  - [x] 2.2 Write the property test for scenario localization
    - File `src/game/narrative/properties/localize.property.test.ts`
    - **Property 6: Localization replaces only text and falls back per field**
    - **Validates: Requirements 9.3, 9.4, 9.5, 10.3**
  - [x] 2.3 Add reason codes and decision hint codes
    - In `reducer.ts`, export `type ReasonCode = keyof typeof REASONS`
    - In `types.ts` and `selectors.ts`, add `hintCode: ReasonCode | null` to
      `DecisionOptionView` and `DecisionPreStepView` (set when the hint comes from `REASONS`, else
      `null`); keep `hint` unchanged
    - In `selectCallLog`, take `displayName` from `scenario.calls[record.callId].displayName` when
      present, else from the record
    - Update existing tests that deep-compare decision views (for example
      `features/chapter1/decision/DecisionPanel.test.tsx` and files under
      `game/narrative/properties/`) for the additive field
    - _Requirements: 8.6, 9.10_
  - [x] 2.4 Write the property test for decision hint codes
    - File `src/game/narrative/properties/decisionHints.property.test.ts`
    - **Property 9: Decision hint codes match their reasons**
    - **Validates: Requirements 8.6**
  - [x] 2.5 Commit the narrative core
    - Stage `src/game/narrative/localize.ts`, `reducer.ts`, `types.ts`, `selectors.ts`, the two
      new property tests and the test files updated in 2.3
    - Message: `feat(game): add display-only scenario localization and decision hint codes`

- [x] 3. Language setting, persistence and runtime switching
  - [x] 3.1 Implement the settings storage module
    - Create `src/app/settingsStorage.ts` with `SETTINGS_STORAGE_KEY`, `DEFAULT_SETTINGS`
      (`language: "en"`), `parseStoredSettings`, `loadSettings` and `saveSettings`, as in design
      section 5. Keep the legacy merge for the five existing fields; validate only `language`
    - `loadSettings` catches storage access errors and returns defaults; `saveSettings` returns
      `false` on error
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 13.3_
  - [x] 3.2 Write the property tests for settings parsing and round trip
    - File `src/app/settingsStorage.property.test.ts`, two `it(...)` blocks
    - **Property 1: Stored settings parsing matches the legacy merge and validates the language**
    - **Validates: Requirements 1.1, 2.2, 2.4, 2.5, 2.6, 2.7**
    - **Property 2: Settings serialization round trip**
    - **Validates: Requirements 2.3, 2.4**
  - [x] 3.3 Wire settings and locale into the App_Shell and `main.tsx`
    - In `src/main.tsx`, call `initI18n(loadSettings(window.localStorage).language)` before
      `createRoot().render()` and wrap `<App />` in `<I18nextProvider i18n={i18n}>`
    - In `src/app/App.tsx`, replace the inline settings reader and writer with `loadSettings` and
      `saveSettings` (write errors ignored, locale still applied); add
      `useLayoutEffect(() => applyLocale(settings.language), [settings.language])` before the
      route branches so every route follows the setting
    - Keep `index.html` unchanged
    - _Requirements: 1.5, 2.3, 2.8, 2.9, 4.1, 4.3, 4.4, 12.4, 13.2_
  - [x] 3.4 Write the property test for language selections
    - File `src/i18n/applyLocale.property.test.ts`
    - **Property 3: Language selections change only the language and the document language follows**
    - **Validates: Requirements 2.8, 4.1, 4.3**
  - [x] 3.5 Add the Language_Selector and translate the Settings_Modal
    - Author `locales/en/settings.ts` and `locales/vi/settings.ts` (design section 3)
    - In `features/menu/SettingsModal.tsx`, add the "Language" section first, as in design
      section 6: `role="radiogroup"` labeled by the localized heading, two native buttons with
      `role="radio"`, `aria-checked`, `lang={locale}` and `LOCALE_LABELS`, `grid-cols-2`, the
      graphics button classes, and the lucide `Languages` icon with `aria-hidden="true"`
    - Replace every literal in the modal with `t("settings:...")`; show graphics quality names
      from keys; format the volume with `formatPercent` and the field of view with `formatNumber`
      plus `°`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 6.1, 6.2, 7.2, 13.6_
  - [x] 3.6 Write the Settings_Modal tests
    - Create `features/menu/SettingsModal.test.tsx`: two radios labeled "English" and
      "Tiếng Việt"; `aria-checked` follows `settings.language`; click, Enter and Space call
      `onUpdateSettings({ language })`; Tab reaches both options in order; the group name and the
      volume percentage are localized in `vi`; no flag image is rendered
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.8, 6.2_
  - [x] 3.7 Commit the language setting
    - Stage `src/app/settingsStorage.ts`, `src/app/settingsStorage.property.test.ts`,
      `src/app/App.tsx`, `src/main.tsx`, `src/i18n/applyLocale.property.test.ts`,
      `src/i18n/locales/{en,vi}/settings.ts`, `features/menu/SettingsModal.tsx` and
      `features/menu/SettingsModal.test.tsx`
    - Message: `feat(game): add persisted language setting and runtime language switching`

- [x] 4. Checkpoint: settings and core
  - Run `pnpm test`, `pnpm typecheck` and `pnpm build`. Ensure all tests pass, ask the user if questions arise.

- [x] 5. Shared screens
  - [x] 5.1 Localize the main menu and prologue
    - Author `locales/{en,vi}/menu.ts` (design Data Models example; "TRÒ CHƠI MỚI", "TIẾP TỤC",
      "CÀI ĐẶT", "GHI CÔNG & GIẤY PHÉP")
    - Extract all text from `features/menu/MainMenuOverlay.tsx`, `features/menu/IntroPrologueModal.tsx`
      and `components/ui/BrandLogo.tsx`; keep "SCAMMAZE" unchanged
    - In `app/continueAvailability.ts`, add `reasonCode: "none" | "invalid"` next to the English
      `reason`; update `app/continueAvailability.test.ts`; `MainMenuOverlay` shows
      `t("menu:continueReasons.<reasonCode>")`
    - _Requirements: 5.1, 5.8, 7.1, 7.3, 7.7, 7.9, 7.11_
  - [x] 5.2 Localize the credits headings
    - In `config/credits.ts`, add a stable `id` to each group and item; keep English `category`
      and `notes` as the source
    - Author `locales/{en,vi}/credits.ts` (`groups.<id>.category`, `items.<id>.notes`, modal title,
      subtitle and field labels)
    - In `features/menu/CreditsModal.tsx`, render translated headings and labels; render asset
      names, creators, license names and URLs from data unchanged
    - _Requirements: 7.3, 7.10_
  - [x] 5.3 Localize the loading screens, errors, tips and WebGL fallback
    - Author `locales/{en,vi}/loading.ts`: `stage.<LoadingStage>`, `menuStartup.*`,
      `continueEyebrow`, `continueTitle`, `continueSubtitle`, `tipLabel`, `nextTip`,
      `progressLabel`, `slowNotice`, `fileCount_one`/`_other` (vi: `_other` only),
      `errors.<LoadingErrorCode>.title|message`, `tips.<tipId>`, `webgl.*`
    - In `game/loading/loadingStrings.ts`, make the helpers take a `TFunction` and a locale; in
      `game/loading/loadingErrors.ts`, keep English `title`/`message` as source and translate by
      `code` in the UI; in `config/loadingTips.ts`, add `LOADING_TIP_IDS` and keep the English array
      as an alias
    - Extract text from `components/ui/LoadingScreen.tsx`, `LoadingProgress.tsx`,
      `LoadingErrorState.tsx`, `LoadingTip.tsx`, `WebGLFallback.tsx`,
      `features/loading/MenuStartupLoading.tsx` and `features/loading/ChapterLoadingFlow.tsx`
      (update every caller of the changed helpers; keep `get.webgl.org` as plain text; format
      counts with `formatNumber`)
    - _Requirements: 5.7, 5.8, 6.3, 7.4, 7.5, 7.6_
  - [x] 5.4 Localize chapter titles, asset text and the chapter placeholder
    - Author `locales/{en,vi}/chapters.ts`: `chapter-1.title` = "The Urgent Call" /
      "Cuộc gọi khẩn cấp", `subtitle`, `assets.<assetId>`, `scenes.<SceneId>`, `placeholder.*`
    - In `game/loading/chapterLoader.ts`, add `currentAssetId: string | null` to the snapshot and
      update `chapterLoader.test.ts`; keep the English text in `game/chapters/chapterRegistry.ts`
      as the source
    - In `features/loading/ChapterLoadingFlow.tsx`, show title, subtitle, chapter label and asset
      text by chapter ID and asset ID; extract `features/chapter/ChapterPlaceholder.tsx`
    - _Requirements: 7.3, 7.8, 7.9_
  - [x] 5.5 Write the credits tests
    - Create `features/menu/CreditsModal.test.tsx`: in `vi`, category headings change; every asset
      name, creator, license name ("Creative Commons Attribution (CC-BY 4.0)", "MIT License") and
      source URL is identical to `en`
    - _Requirements: 7.3, 7.10_
  - [x] 5.6 Extend the loading tests for Vietnamese
    - In `features/loading/MenuStartupLoading.test.tsx`, `features/loading/ChapterLoadingFlow.test.tsx`
      and `components/ui/LoadingScreen.test.tsx`, add `vi` cases: stage text, file count with
      formatted numbers, tip label, the title and message of every error code, "Về menu chính"
      (shown upper-case by CSS), "Đang tải" and the chapter title "Cuộc gọi khẩn cấp". Keep the
      English cases unchanged
    - _Requirements: 7.4, 7.5, 7.8, 7.9, 14.10, 14.11_
  - [x] 5.7 Write the App language tests
    - Create `app/App.i18n.test.tsx` (mock the 3D canvas as `App.chapter.test.tsx` does): English
      on first start with empty storage; selecting "Tiếng Việt" switches the menu and the open
      Settings_Modal without a reload and sets `<html lang="vi">`; the menu shows "TRÒ CHƠI MỚI",
      "TIẾP TỤC", "CÀI ĐẶT", "GHI CÔNG & GIẤY PHÉP"; a stored `vi` survives a remount; an invalid
      stored `language` gives English; the other settings fields are kept after a language
      change; a throwing `setItem` still switches the locale; the current screen and the mocked
      scene and audio are not remounted or reset by a language change
    - _Requirements: 2.3, 2.4, 2.5, 2.8, 2.9, 4.1, 4.2, 4.3, 4.4, 4.6, 14.2, 14.3, 14.4, 14.5, 14.8, 14.10_
  - [x] 5.8 Commit the shared screens
    - Stage the files changed or created in 5.1 to 5.7, by name
    - Message: `feat(game): localize main menu, credits, loading screens and chapter text`

- [x] 6. Vietnamese Chapter 1 narrative overlay
  - [x] 6.1 Add the display scenario module and overlay skeleton
    - Create `src/i18n/narrative.ts` with `NARRATIVE_OVERLAYS`, `getDisplayScenario`,
      `getDisplayPrompts` and `useDisplayScenario` (design section 10): `en` returns
      `CHAPTER_1_SCENARIO` itself; `vi` is computed once and cached
    - Create `src/i18n/narrative/chapter1.vi.ts` merging the parts, and the empty parts
      `chapter1.vi/{core,evidence,world,dialogues,phone,decisions}.ts`
    - _Requirements: 9.3, 9.6, 9.8, 9.9_
  - [x] 6.2 Translate the core part
    - In `chapter1.vi/core.ts`: `title` ("Cuộc gọi khẩn cấp"), `subtitle`, `objectives/*`,
      `claims/*`, `warningSigns/*`, `journalNotes/*` and `prompts/*`, using the terminology table
      in the design
    - _Requirements: 9.6, 9.11, 9.12, 11.10_
  - [x] 6.3 Translate the evidence part
    - In `chapter1.vi/evidence.ts`: every `evidence/<id>/<field>` and
      `evidence/<id>/relations/<claimId>/note`; keep phone numbers, domains and "Northgate Bank"
      verbatim
    - _Requirements: 9.6, 9.11, 9.12, 11.10_
  - [x] 6.4 Translate the world part
    - In `chapter1.vi/world.ts`: `interactables/*`, `npcs/*` and `calls/*/displayName`
    - _Requirements: 9.6, 9.10, 9.11, 9.12_
  - [x] 6.5 Translate the dialogues part
    - In `chapter1.vi/dialogues.ts`: every persona field and dialogue line; the scammer lines stay
      fictional and contain no instruction usable for real fraud; "OTP" is explained once as
      "mã xác thực một lần (OTP)"
    - _Requirements: 9.6, 9.11, 9.12, 11.10_
  - [x] 6.6 Translate the phone part
    - In `chapter1.vi/phone.ts`: `phone/messages/*`, `phone/contacts/*/name`, `phone/bankApp/*`;
      keep every `+000` number and reserved domain verbatim
    - _Requirements: 9.6, 9.11, 9.12_
  - [x] 6.7 Translate the decisions part
    - In `chapter1.vi/decisions.ts`: `decisions/*`, `endings/*` (including variants and the
      simulation label) and `debrief/*`; the verified ending describes checking through the
      official channel (for example "Bạn đã kiểm tra qua số chính thức của Northgate Bank.") and
      never says the call, message or link is safe
    - _Requirements: 9.6, 9.11, 9.12, 11.9, 11.10_
  - [x] 6.8 Write the narrative overlay tests
    - Create `src/i18n/narrative.test.ts`: the `vi` overlay has a non-empty text for every
      Narrative_Text_Key and no unknown key (failures name the key); the parts have disjoint keys;
      `validateScenario(getDisplayScenario("vi"))` returns no errors;
      `getDisplayScenario("en") === CHAPTER_1_SCENARIO`; repeated calls return the same object;
      `narrativeTextEntries` covers every text string the existing English content-lint walker
      finds
    - _Requirements: 9.2, 9.6, 9.7, 9.9, 9.13_
  - [x] 6.9 Write the locale-independence property tests
    - File `src/i18n/localeIndependence.property.test.ts`, two `it(...)` blocks
    - **Property 7: The core gives the same results with any Localized_Scenario**
    - **Validates: Requirements 10.4, 9.4**
    - **Property 8: Saves do not depend on the UI language**
    - **Validates: Requirements 10.5, 10.6**
    - Also assert that a progress encoded while `vi` is active restores the same state while `en`
      is active (Requirement 10.7)
  - [x] 6.10 Commit the narrative overlay
    - Stage `src/i18n/narrative.ts`, `src/i18n/narrative/**`, `src/i18n/narrative.test.ts` and
      `src/i18n/localeIndependence.property.test.ts`
    - Message: `feat(game): add Vietnamese Chapter 1 narrative overlay`

- [x] 7. Chapter 1 interface
  - [x] 7.1 Localize the HUD area
    - Author `locales/{en,vi}/chapter1/hud.ts`: `titleCard.*`, `hud.*` (`unreadMessages_one/_other`,
      `newEntries_one/_other`), `objectives.*`, `toast.*`, `notice.*`, `resume.*`,
      `saveFailure.*`, `interaction.*`, and `page.*` for the strings in `ChapterOnePage.tsx`
      (`announce.objectiveCompleted` with `{{objective}}`, dialogue overlay text)
    - Extract text from `intro/ChapterTitleCard.tsx` and `hud/{HudButtons,ObjectiveTracker,
      ObjectiveToast,EvidenceNotice,ResumePrompt,SaveFailureNotice,InteractionPrompt}.tsx`,
      including accessible names and live-region text; keep key letters literal
    - _Requirements: 5.7, 8.1, 8.4, 8.7_
  - [x] 7.2 Localize the phone area
    - Author `locales/{en,vi}/chapter1/phone.ts` and extract text from `phone/{PhoneOverlay,
      PhoneHome,MessagesApp,CallHistoryApp,BankApp,IncomingCallScreen,CallScreen}.tsx`
      (including `CONNECTING_TEXT`, accessible names and announcements); "Cúp máy", "Từ chối",
      "Nghe máy" per the terminology table
    - _Requirements: 8.2, 8.4_
  - [x] 7.3 Localize the story area
    - Author `locales/{en,vi}/chapter1/story.ts`: `dialogue.*` (`playerSpeaker`, `fallbackOption`,
      `caption`), `journal.*` (`stance.<Stance>`, `claimStatus.<ClaimStatus>`, `source.<source>`)
      and `inspection.*`
    - Extract text from `dialogue/DialoguePanel.tsx`, `journal/EvidenceJournal.tsx` and
      `panels/InspectionPanel.tsx`; render speaker, stance, claim status and the fallback option
      by their codes, not by the core's English strings
    - _Requirements: 8.3, 8.4, 8.5_
  - [x] 7.4 Localize the outcome area
    - Author `locales/{en,vi}/chapter1/outcome.ts`: `decision.*`, `reasons.<ReasonCode>`,
      `ending.*`, `debrief.*`, `pause.*` (`restartConfirm` with `{{number}}`)
    - Extract text from `decision/DecisionPanel.tsx` (hint from `t("chapter1:reasons.<hintCode>")`
      when `hintCode` is set, else the scenario hint), `ending/EndingTransition.tsx`,
      `debrief/DebriefScreen.tsx` and `pause/PauseMenu.tsx`
    - _Requirements: 8.3, 8.4, 8.6_
  - [x] 7.5 Wire the display scenario into the Chapter_Page
    - In `features/chapter1/ChapterOnePage.tsx`: `const scenario = useDisplayScenario()`; wrap each
      selector in `useCallback(..., [scenario])`; call `buildDebrief(state, scenario)`; replace every
      direct `CHAPTER_1_SCENARIO` read with `scenario`; keep toasts and notices as IDs and resolve
      text at render; pass `getDisplayPrompts(locale)` to `InteractionPrompt`; use the `page.*`
      keys from 7.1; create the store with the canonical scenario as today and add no locale `key`
    - Finish any prop changes started in 7.1 to 7.4
    - _Requirements: 4.5, 9.8, 9.9, 9.10, 10.1_
  - [x] 7.6 Extend the phone tests for Vietnamese
    - In `features/chapter1/phone/PhoneOverlay.test.tsx`, add `vi` cases for app names, call
      history caller names from the Localized_Scenario, call buttons and accessible names
    - _Requirements: 8.2, 8.4, 9.10_
  - [x] 7.7 Extend the decision and debrief tests for Vietnamese
    - In `decision/DecisionPanel.test.tsx` and `debrief/DebriefScreen.test.tsx`, add `vi` cases for
      labels, reason hints by `hintCode`, debrief headings and accessible names
    - _Requirements: 8.3, 8.4, 8.6_
  - [x] 7.8 Extend the chapter page and accessibility tests
    - In `ChapterOnePage.test.tsx`: in `vi`, HUD, journal stance and claim status, player speaker
      and the fallback option are Vietnamese; switching locale while the journal is open keeps the
      same store state object, the open overlay and the event log, and changes the visible text;
      an objective toast shown before the switch changes language
    - In `accessibility.test.tsx`: accessible names and live-region announcements are Vietnamese
      in `vi`; key hints keep `E`, `P`, `J`, `Esc`
    - _Requirements: 4.5, 8.1, 8.3, 8.4, 8.5, 8.7, 9.8_
  - [x] 7.9 Commit the Chapter 1 interface
    - Stage `src/i18n/locales/{en,vi}/chapter1/*.ts` and the files changed in 7.1 to 7.8, by name
    - Message: `feat(game): localize the Chapter 1 interface`

- [x] 8. Checkpoint: game screens and Chapter 1
  - Run `pnpm test`, `pnpm typecheck` and `pnpm build`. Ensure all tests pass, ask the user if questions arise.

- [x] 9. Teammate world pages (extraction only, lower priority)
  - [x] 9.1 Localize the Ho Chi Minh City world
    - Author `locales/{en,vi}/worlds/hcm.ts`; extract labels, loading text and buttons from
      `features/hochiminh/{HCMOverlay,HCMPage,types}`; move existing Vietnamese text to `vi` and
      write the English source for `en`; keep landmark names (for example "Landmark 81") in code or
      data; change no behavior, layout, timing or controls
    - _Requirements: 12.1, 12.2, 12.3, 12.4_
  - [x] 9.2 Localize the TestMove world
    - Author `locales/{en,vi}/worlds/testmove.ts`; extract from
      `features/testmove/{TestMovePage,TestMoveOverlay}.tsx` under the same rules as 9.1
    - _Requirements: 12.1, 12.2, 12.3, 12.4_
  - [x] 9.3 Localize the UEH world
    - Author `locales/{en,vi}/worlds/ueh.ts`; extract from `features/ueh/UEHOverlay.tsx` under the
      same rules as 9.1
    - _Requirements: 12.1, 12.2, 12.3, 12.4_
  - [x] 9.4 Localize the Hue world
    - Author `locales/{en,vi}/worlds/hue.ts`; extract from `features/hue/{HuePage,components/HueHUD}.tsx`
      under the same rules as 9.1; keep place names such as "Cố Đô Huế" literal
    - _Requirements: 12.1, 12.2, 12.3, 12.4_
  - [x] 9.5 Write the world page render tests
    - Create `src/features/worlds.i18n.test.tsx`: render each overlay or HUD component in `en` and
      `vi` (3D canvas and audio mocked as in existing tests); labels change with the locale;
      landmark and place names are identical in both locales
    - _Requirements: 12.1, 12.2, 12.3_
  - [x] 9.6 Commit the world pages
    - Stage `src/i18n/locales/{en,vi}/worlds/*.ts`, the files changed in 9.1 to 9.4 and
      `src/features/worlds.i18n.test.tsx`
    - Message: `feat(game): localize teammate world pages`

- [x] 10. Cross-cutting checks
  - [x] 10.1 Write the Vietnamese content lint
    - Create `src/i18n/content.vi.test.ts` over every `vi` dictionary and the `vi` narrative
      overlay: fail on "an toàn" in any letter case; on non-reserved domains in the overlay and the
      `chapter1` dictionaries; on phone numbers not starting with `+000`; when the set of phone
      numbers or domains differs from the English text with the same key; on emoji; on currency
      symbols, ISO currency codes or listed blaming phrases ("lỗi của bạn", "ngu ngốc", "cả tin",
      "bất cẩn", "dại dột", "nhẹ dạ"); when "Northgate Bank" is missing where the English source
      has it, when "Ngân hàng Northgate" appears, or when another bank is named
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 13.6_
  - [x] 10.2 Write the i18n property tests
    - File `src/i18n/i18n.property.test.ts`, two `it(...)` blocks
    - **Property 4: Missing Vietnamese text falls back to English**
    - **Validates: Requirements 1.7, 5.6**
    - **Property 5: Plural selection and count formatting**
    - **Validates: Requirements 5.7, 6.3**
    - Covers Requirement 14.6 (missing-translation fallback)
  - [x] 10.3 Commit the cross-cutting checks
    - Stage `src/i18n/content.vi.test.ts` and `src/i18n/i18n.property.test.ts`, plus any
      translation fix the lint required (named files only)
    - Message: `test(game): add Vietnamese content lint and i18n property tests`

- [x] 11. Checkpoint: full suite
  - Run `pnpm test`, `pnpm typecheck` and `pnpm build`. Confirm `git diff --stat 8fed327 -- apps/landing apps/game/index.html` is empty. Ensure all tests pass, ask the user if questions arise.

- [x] 12. Documentation and steering
  - [x] 12.1 Update the language steering rule
    - In `.kiro/steering/language.md`: repository documents, code, comments, identifiers and
      commit messages stay English; localization has started for `apps/game` user-facing text,
      which lives in Locale_Dictionaries with English as source and fallback and Vietnamese as the
      second locale; the narrative uses the Vietnamese overlay keyed by content IDs; the landing
      app stays English-only until requested; keep the detection-data exception
    - _Requirements: 15.1_
  - [x] 12.2 Update AGENTS.md
    - Update the `language.md` row of the steering table and add `i18next` and `react-i18next` to
      the verified game stack line
    - _Requirements: 15.2_
  - [x] 12.3 Add "Adding a language" to CONTRIBUTING.md
    - Replace the statement that multi-language support comes later; describe adding a locale to
      `SUPPORTED_LOCALES` and `GameLocale`, copying the `en` dictionaries typed with `LocaleShape`,
      adding a narrative overlay, running the key, overlay and content-lint tests, and asking for
      a native-speaker review
    - _Requirements: 15.3_
  - [x] 12.4 Update the architecture overview
    - In `docs/architecture/OVERVIEW.md`, describe the I18n_Module, the Narrative_Overlay, the
      locale independence of the Chapter_Core and the future AI locale contract (status `PLANNED`);
      mark the implemented parts `IMPLEMENTED` only after the checkpoint in task 11 passed
    - _Requirements: 13.4, 15.4_
  - [x] 12.5 Record the work in PROJECT_PROGRESS.md
    - Run `pnpm test`, `pnpm typecheck` and `pnpm build` and record the observed results and test
      counts (baseline on `8fed327`: 48 files, 392 tests)
    - Add a task history entry (newest first) with the nine mandatory items, the justification of
      `i18next` and `react-i18next` (no i18n library existed; synchronous bundled init; React
      re-render on change; peer ranges checked), the dependency on the Chapter 1 pull request, the
      typed-`t` choice from 1.3, and a recommendation for a native-speaker review of all Vietnamese
      text; update the status sections
    - _Requirements: 14.12, 15.5_
  - [x] 12.6 Commit the documentation
    - Stage `.kiro/steering/language.md`, `AGENTS.md`, `CONTRIBUTING.md`,
      `docs/architecture/OVERVIEW.md`, `docs/PROJECT_PROGRESS.md` and
      `.kiro/specs/game-i18n-en-vi/{requirements.md,design.md,tasks.md,.config.kiro}`
    - Message: `docs: document game localization and the process for adding a language`
    - Do not push
    - _Requirements: 16.1, 16.2, 16.3_

- [x] 13. Final checkpoint
  - Run `pnpm test`, `pnpm typecheck` and `pnpm build`, and `git log --oneline 8fed327..HEAD` to list the local commits. Ensure all tests pass, ask the user if questions arise.

## Notes

- All sub-tasks are required, including tests.
- Property tests map one-to-one to design Properties 1 to 9; files 3.2, 6.9 and 10.2 hold two
  properties each, one `it(...)` per property.
- Requirements 3.6, 3.7, 9.11 and 11.10 need a browser or human judgement; they are covered by
  code review and the native-speaker review recommended in 12.5.
- Waves are designed so that tasks in the same wave edit different files and at most one commit
  task runs per wave.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.6", "2.1", "2.3"] },
    { "id": 1, "tasks": ["1.3", "2.2", "2.4"] },
    { "id": 2, "tasks": ["1.4", "1.5", "2.5", "3.1", "6.1"] },
    { "id": 3, "tasks": ["1.7", "3.2", "3.3", "3.4", "3.5", "6.2", "6.3", "6.4", "6.5", "6.6", "6.7"] },
    { "id": 4, "tasks": ["3.6", "5.1", "5.2", "5.3", "6.8", "6.9", "7.1", "7.2", "7.3", "7.4"] },
    { "id": 5, "tasks": ["3.7", "5.4", "5.5", "5.7", "7.5", "7.7"] },
    { "id": 6, "tasks": ["5.6", "6.10", "7.6", "7.8", "9.1", "9.2", "9.3", "9.4"] },
    { "id": 7, "tasks": ["5.8", "9.5", "10.1", "10.2"] },
    { "id": 8, "tasks": ["7.9", "12.1", "12.2", "12.3", "12.4"] },
    { "id": 9, "tasks": ["9.6", "12.5"] },
    { "id": 10, "tasks": ["10.3"] },
    { "id": 11, "tasks": ["12.6"] }
  ]
}
```
