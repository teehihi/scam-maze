# Requirements Document

## Introduction

This feature adds English and Vietnamese localization to the SCAMMAZE game app (`apps/game`).
English (`en`) is the default locale and the fallback for every missing text. Vietnamese (`vi`) is
the second locale. The player picks the language in the existing Settings modal of the main menu.
The choice applies at once without a page reload, is stored with the other game settings, and is
restored on the next visit.

The feature covers all user-facing text in `apps/game`: the main menu and its modals, the startup
and chapter loading screens, loading errors, the WebGL fallback, credits headings and notes,
awareness tips, the chapter placeholder, Continue reasons, the Chapter 1 interface (HUD, phone,
dialogue, journal, decision panel, ending, debrief, pause menu, notices and accessible labels),
the Chapter 1 narrative content, and the teammate world pages (`/hochiminh`, `/testmove`, `/ueh`,
`/hue`).

Translation is display-only. The deterministic Chapter 1 core (`game/narrative/`) keeps its
English authored text as the canonical source and its stable IDs. Game state, rules, conditions,
outcomes and saved games never depend on the selected language.

Context and constraints (owner decisions, recorded here so the spec is self-contained):

- The owner explicitly requested localization. The steering rule `.kiro/steering/language.md`,
  which says localization is "planned but not started", is updated as part of this feature.
- Library choice: `i18next` 27.1.1 and `react-i18next` 18.0.1 (no i18n library is installed
  today; peer ranges verified on npm: i18next peers `typescript ^5 || ^6 || ^7`, react-i18next
  peers `react >= 18.0.0`, `i18next >= 27.0.1`).
- The landing app (`apps/landing`) is a separate app on a separate origin and is out of scope.
- No AI NPC integration exists in the code base. A locale contract for future AI dialogue is
  recorded as future work only.
- Work happens on branch `feat/game-i18n-en-vi`, created from `feat/chapter-01-playable` (commit
  `8fed327`). Chapter 1 is not merged into `main` (`72edd16`) yet, so the pull request for this
  feature depends on the Chapter 1 pull request.

## Glossary

- **Game_App**: The React application in `apps/game`.
- **Landing_App**: The separate React application in `apps/landing`.
- **Locale**: A language code used by the Game_App. Type `GameLocale`.
- **Supported_Locale**: One of the locales the Game_App ships: `en` or `vi`.
- **Default_Locale**: `en`. Used on first visit, for invalid stored values, and as the fallback.
- **I18n_Module**: The code in `apps/game/src/i18n/` that initializes i18next, lists the
  Supported_Locales, holds the Locale_Dictionaries and exposes formatting helpers.
- **Locale_Dictionary**: The typed TypeScript resource object for one Locale and one namespace
  (for example `locales/vi/menu.ts`).
- **Translation_Key**: A stable identifier for one user-facing text, independent of the English
  wording (for example `menu:buttons.newGame.label`).
- **Plural_Base_Key**: A Translation_Key with its plural suffix (`_one`, `_other`) removed.
- **Interpolation_Variable**: A `{{name}}` placeholder inside a translated text.
- **Game_Settings**: The `GameSettings` object from `packages/shared-types`, extended with the
  `language` field.
- **Settings_Store**: The code that reads and writes Game_Settings in `localStorage` under the key
  `scammaze_settings_v1`.
- **Settings_Modal**: The existing modal in `apps/game/src/features/menu/SettingsModal.tsx`.
- **Language_Selector**: The language control inside the Settings_Modal.
- **App_Shell**: The `App` component in `apps/game/src/app/App.tsx`.
- **Chapter_Core**: The pure TypeScript modules in `apps/game/src/game/narrative/` (reducer,
  store, selectors, debrief, validators and Chapter 1 scenario data).
- **Canonical_Scenario**: `CHAPTER_1_SCENARIO`, the English authored Scenario_Data used by the
  Chapter_Core.
- **Narrative_Text_Key**: A stable key that names one text field of the Canonical_Scenario by
  its content IDs (for example `evidence/ev.bank-card/title`).
- **Narrative_Overlay**: A map from Narrative_Text_Key to translated text for one Locale.
- **Localized_Scenario**: A display-only copy of the Canonical_Scenario with text fields replaced
  from a Narrative_Overlay.
- **Chapter_Page**: `ChapterOnePage` and its child components in `features/chapter1/`.
- **Save_Data**: The saved game in `localStorage` written by `game/saves/`.
- **Content_Lint**: The automated tests that check authored text against the safety and audience
  rules.
- **Teammate_World_Page**: The pages behind the routes `/hochiminh`, `/testmove`, `/ueh` and
  `/hue`.
- **Document_Language**: The `lang` attribute of the `<html>` element.

## Requirements

### Requirement 1: Locale infrastructure

**User Story:** As a developer, I want one small i18n module with bundled dictionaries, so that every screen can show text in the selected language without loading delays.

#### Acceptance Criteria

1. THE I18n_Module SHALL define the Supported_Locales `en` and `vi`, the Default_Locale `en`, and a type guard `isSupportedLocale` that returns true only for a Supported_Locale.
2. THE I18n_Module SHALL use `i18next` and `react-i18next` as the only localization libraries.
3. THE I18n_Module SHALL bundle every Locale_Dictionary in the JavaScript build and SHALL load no translation file over the network.
4. WHEN the I18n_Module is initialized with a Locale, THE I18n_Module SHALL complete initialization synchronously, so that a translation call made directly after initialization returns the text of that Locale.
5. THE Game_App SHALL initialize the I18n_Module with the stored Locale before the first render of the App_Shell.
6. THE I18n_Module SHALL configure react-i18next without React Suspense.
7. THE I18n_Module SHALL use `en` as the fallback language for every Translation_Key.
8. THE I18n_Module SHALL select the initial Locale only from Game_Settings and SHALL ignore the browser language.

### Requirement 2: Language setting and persistence

**User Story:** As a player, I want the game to remember my language, so that I do not have to choose it again on every visit.

#### Acceptance Criteria

1. THE Game_Settings SHALL contain a `language` field of type `GameLocale` with the values `en` or `vi`, defined once in `packages/shared-types`.
2. THE Settings_Store SHALL use `en` as the default `language` value.
3. WHEN the player changes the language, THE Settings_Store SHALL write the complete Game_Settings, including `language`, to `localStorage` under the key `scammaze_settings_v1`.
4. WHEN the Game_App starts and the stored Game_Settings contain a Supported_Locale in `language`, THE Settings_Store SHALL restore that Locale.
5. IF the stored `language` value is missing, is not a string, or is not a Supported_Locale, THEN THE Settings_Store SHALL use `en`.
6. IF the stored settings value is not valid JSON or is not a JSON object, THEN THE Settings_Store SHALL use the default Game_Settings.
7. WHEN the Settings_Store restores Game_Settings, THE Settings_Store SHALL keep the graphics quality, sound, music volume, effects volume and field-of-view values exactly as the current loading code keeps them.
8. WHEN the player changes the language, THE App_Shell SHALL change only the `language` field of Game_Settings and SHALL keep every other Game_Settings field unchanged.
9. IF writing to `localStorage` fails, THEN THE App_Shell SHALL keep the selected Locale for the current session and continue without an error message.

### Requirement 3: Language selector in Settings

**User Story:** As a player, I want to choose English or Vietnamese in the Settings window, so that I can read the game in the language I understand best.

#### Acceptance Criteria

1. THE Settings_Modal SHALL contain a Language_Selector with exactly two options labeled "English" and "Tiếng Việt", each label written in its own language.
2. THE Language_Selector SHALL mark the option that matches the current `language` setting as selected, both visually and with `aria-checked="true"` or `aria-pressed="true"`.
3. THE Language_Selector SHALL have an accessible group name in the current Locale.
4. WHEN the player activates a Language_Selector option with a pointer, the Enter key or the Space key, THE Settings_Modal SHALL request the matching `language` value through `onUpdateSettings`.
5. THE Language_Selector SHALL be reachable with the Tab key in the same focus order as the other Settings_Modal controls.
6. THE Language_Selector SHALL use the existing Settings_Modal button styles, typography and colors.
7. WHILE the viewport is 320 CSS pixels wide, THE Language_Selector SHALL show both options without horizontal scrolling.
8. THE Language_Selector SHALL use text labels and SHALL use no flag images and no emoji.

### Requirement 4: Runtime language switching

**User Story:** As a player, I want the new language to appear right away, so that I can see the change without reloading or losing progress.

#### Acceptance Criteria

1. WHEN the `language` setting changes, THE App_Shell SHALL switch the I18n_Module to that Locale without a page reload.
2. WHEN the I18n_Module switches Locale, THE Game_App SHALL re-render every mounted component that shows translated text in the new Locale, including the open Settings_Modal.
3. WHEN the I18n_Module switches Locale, THE App_Shell SHALL set the Document_Language to the new Locale.
4. WHEN the Game_App starts, THE App_Shell SHALL set the Document_Language to the restored Locale.
5. WHEN the Locale changes while the Chapter_Page is mounted, THE Chapter_Page SHALL keep the same Chapter_Store, the same chapter state and the same open overlays.
6. WHEN the Locale changes, THE Game_App SHALL keep the audio state, the 3D scene and the current screen unchanged.

### Requirement 5: Locale dictionaries and keys

**User Story:** As a translator, I want stable keys with an English source and a matching Vietnamese dictionary, so that I can find and check every text.

#### Acceptance Criteria

1. THE I18n_Module SHALL identify every user-facing text by a Translation_Key that does not depend on the English wording.
2. THE I18n_Module SHALL store the English Locale_Dictionaries as the source and SHALL type the Vietnamese Locale_Dictionaries against the English key structure, so that a missing or extra Vietnamese key is a TypeScript error.
3. THE I18n_Module SHALL provide the same set of Plural_Base_Keys in `en` and `vi` for every namespace.
4. THE I18n_Module SHALL use the same set of Interpolation_Variables in the `en` text and the `vi` text of every Plural_Base_Key.
5. THE I18n_Module SHALL contain no empty or whitespace-only text in any Locale_Dictionary.
6. IF a Translation_Key has no text in the current Locale, THEN THE I18n_Module SHALL return the English text for that key.
7. THE I18n_Module SHALL express count-dependent text with i18next plural keys: `_one` and `_other` for `en`, and `_other` for `vi`, which has a single plural form.
8. THE I18n_Module SHALL build every translated sentence from one complete text with Interpolation_Variables and SHALL not join sentence fragments.
9. THE I18n_Module SHALL store every Vietnamese text in Unicode normalization form NFC.

### Requirement 6: Locale-aware formatting

**User Story:** As a player, I want numbers shown the way my language writes them, so that values are easy to read.

#### Acceptance Criteria

1. THE I18n_Module SHALL format displayed numbers and percentages with `Intl.NumberFormat` for the current Locale.
2. WHEN the Settings_Modal shows the volume, THE Settings_Modal SHALL format the value as a percentage for the current Locale.
3. WHEN a count is shown inside a translated text, THE I18n_Module SHALL format the count for the current Locale.
4. WHERE a later screen shows a date or time, THE I18n_Module SHALL provide a date formatter based on `Intl.DateTimeFormat` for the current Locale.

### Requirement 7: Main menu, loading and shared screens

**User Story:** As a Vietnamese-speaking player, I want the menu and loading screens in Vietnamese, so that I can start the game without English.

#### Acceptance Criteria

1. THE Game_App SHALL show the main menu buttons, sublabels, tooltips, audio indicator and navigation label in the current Locale.
2. THE Game_App SHALL show the Settings_Modal title, subtitle, control labels, graphics quality names and descriptions, field-of-view labels and sound labels in the current Locale.
3. THE Game_App SHALL show the prologue modal, the credits modal headings and the chapter placeholder in the current Locale.
4. THE Game_App SHALL show the startup loading screen, the chapter loading screen, loading stages, file counts, awareness tips, the slow-loading notice and every loading button in the current Locale.
5. THE Game_App SHALL show each loading error title and message in the current Locale, selected by the error code.
6. THE Game_App SHALL show the WebGL fallback screen in the current Locale.
7. THE Game_App SHALL show the reason for a disabled Continue button in the current Locale, selected by a stable reason code.
8. THE Game_App SHALL show the chapter title, subtitle, chapter number label and asset loading text in the current Locale, selected by chapter ID and asset ID.
9. WHEN the Locale is `vi`, THE Game_App SHALL show the main menu labels "TRÒ CHƠI MỚI", "TIẾP TỤC", "CÀI ĐẶT" and "GHI CÔNG & GIẤY PHÉP", the return button text "Về menu chính" where the English source text is "Return to menu", the loading text "Đang tải" where the English source text is "Loading", and the Chapter 1 title "Cuộc gọi khẩn cấp" where the English source text is "The Urgent Call", each in the same letter case as its English source text, so that CSS upper-casing shows "VỀ MENU CHÍNH", "ĐANG TẢI" and "CUỘC GỌI KHẨN CẤP".
10. THE Game_App SHALL keep asset names, creator names, license names (for example "Creative Commons Attribution (CC-BY 4.0)" and "MIT License"), source URLs and place names unchanged in every Locale.
11. THE Game_App SHALL keep the product name "SCAMMAZE" unchanged in every Locale.

### Requirement 8: Chapter 1 interface

**User Story:** As a Vietnamese-speaking player, I want the Chapter 1 controls, phone and panels in Vietnamese, so that I can play the whole chapter in my language.

#### Acceptance Criteria

1. THE Chapter_Page SHALL show the title card, HUD buttons, badges, objective tracker, objective toasts, evidence notices, resume prompt and save failure notice in the current Locale.
2. THE Chapter_Page SHALL show the phone home screen, messages app, call history, bank app, incoming call screen and call screen in the current Locale.
3. THE Chapter_Page SHALL show the dialogue panel, the evidence journal, the inspection panel, the decision panel, the ending screen, the debrief screen and the pause menu in the current Locale.
4. THE Chapter_Page SHALL show every accessible name, live-region announcement and keyboard hint label in the current Locale.
5. THE Chapter_Page SHALL show the speaker name of player lines, the evidence stance text, the claim status text and the dialogue fallback option in the current Locale, selected by their stable codes.
6. THE Chapter_Page SHALL show decision hints that come from Chapter_Core rejection reasons in the current Locale, selected by a stable reason code.
7. THE Chapter_Page SHALL keep keyboard shortcut keys (for example `E`, `P`, `J`, `Esc`) the same in every Locale.

### Requirement 9: Chapter 1 narrative localization

**User Story:** As a Vietnamese-speaking player, I want the story, evidence and dialogue in Vietnamese with the same meaning, so that I learn the same lesson as an English-speaking player.

#### Acceptance Criteria

1. THE Chapter_Core SHALL keep the English authored text of the Canonical_Scenario as the source text.
2. THE Chapter_Core SHALL derive one Narrative_Text_Key for every translatable text field of the Canonical_Scenario and of the Chapter 1 interaction prompts, built only from content IDs and field names.
3. THE Chapter_Core SHALL provide a pure function `localizeScenario` that returns a Localized_Scenario from the Canonical_Scenario and a Narrative_Overlay.
4. THE Localized_Scenario SHALL have the same IDs, keys, conditions, effects, numbers, domains, ordering and structure as the Canonical_Scenario and SHALL differ only in translatable text fields.
5. IF the Narrative_Overlay has no text for a Narrative_Text_Key, THEN THE `localizeScenario` function SHALL keep the English text for that field.
6. THE Game_App SHALL provide a Vietnamese Narrative_Overlay with a text for every Narrative_Text_Key of Chapter 1.
7. THE Game_App SHALL contain no Narrative_Overlay entry whose key is not a Narrative_Text_Key of the Canonical_Scenario.
8. WHEN the Chapter_Page renders, THE Chapter_Page SHALL pass the Localized_Scenario for the current Locale to the selectors and the debrief builder.
9. THE Chapter_Page SHALL reuse one Localized_Scenario object per Locale, so that memoized selectors keep stable results.
10. THE Chapter_Page SHALL show caller names in the call history from the Localized_Scenario by call ID.
11. THE Vietnamese Narrative_Overlay SHALL convey the same educational meaning, warning signs, claims and consequences as the English text.
12. THE Vietnamese Narrative_Overlay SHALL keep the bank name "Northgate Bank", every phone number, every domain and every product name exactly as in the English text.
13. THE `validateScenario` function SHALL accept the Vietnamese Localized_Scenario without errors.

### Requirement 10: Locale independence of game state and saves

**User Story:** As a player, I want my progress and outcome to be the same in both languages, so that switching language never changes the game.

#### Acceptance Criteria

1. THE Chapter_Store SHALL run the reducer only with the Canonical_Scenario.
2. THE Chapter_Core SHALL contain no import of `i18next`, `react-i18next` or the I18n_Module.
3. THE Chapter_Core SHALL keep every dialogue option ID, evidence ID, interactable ID, claim ID, decision ID, objective ID and outcome ID the same in every Locale.
4. FOR ALL action sequences, THE Chapter_Core SHALL produce the same acceptance results, flags, evidence, claim statuses, decision and outcome with the Localized_Scenario of any Locale as with the Canonical_Scenario.
5. FOR ALL action sequences, THE Save_Data written by the Game_App SHALL be identical for every Locale.
6. THE Save_Data SHALL contain no translated text.
7. WHEN a game saved under one Locale is continued under another Locale, THE Game_App SHALL restore the same chapter state.

### Requirement 11: Vietnamese content rules

**User Story:** As the product owner, I want the Vietnamese text to follow the same safety and audience rules as the English text, so that the game teaches correctly in both languages.

#### Acceptance Criteria

1. THE Content_Lint SHALL check every Vietnamese Locale_Dictionary and the Vietnamese Narrative_Overlay.
2. THE Content_Lint SHALL fail when a Vietnamese text contains the phrase "an toàn" in any letter case.
3. THE Content_Lint SHALL fail when a text in the Vietnamese Narrative_Overlay or the Vietnamese `chapter1` Locale_Dictionary contains a domain that is not a reserved domain (`.test`, `.example`, `.invalid`, `example.com`).
4. THE Content_Lint SHALL fail when a Vietnamese text contains a phone number that does not start with `+000`.
5. THE Content_Lint SHALL fail when the set of phone numbers or domains in a Vietnamese text differs from the set in the English text with the same key.
6. THE Content_Lint SHALL fail when a Vietnamese text contains an emoji.
7. THE Content_Lint SHALL fail when a Vietnamese text contains a currency symbol, an ISO currency code or a listed blaming phrase.
8. THE Content_Lint SHALL fail when a Vietnamese text names a bank other than "Northgate Bank" or translates "Northgate Bank".
9. THE Vietnamese text of the verified ending SHALL describe the result of checking through the official channel and SHALL not state that the call, message or link is safe.
10. THE Vietnamese text SHALL use plain, everyday Vietnamese with correct diacritics and SHALL contain no region-specific brand, payment method or reporting channel in core content.

### Requirement 12: Teammate world pages

**User Story:** As a player who opens a demo world page, I want its interface text in my selected language, so that the whole Game_App follows one language setting.

#### Acceptance Criteria

1. THE Teammate_World_Pages SHALL show their loading text, overlay labels, HUD labels and buttons from the Locale_Dictionaries in the current Locale.
2. THE Teammate_World_Pages SHALL keep landmark names and place names unchanged in every Locale.
3. THE Teammate_World_Pages SHALL keep their current behavior, layout and controls when their text is moved into the Locale_Dictionaries.
4. THE Teammate_World_Pages SHALL read the Locale from the same Game_Settings as the main menu.

### Requirement 13: Scope boundaries

**User Story:** As the product owner, I want the change limited to the game app, so that other parts of the project stay stable.

#### Acceptance Criteria

1. THE feature SHALL leave every file under `apps/landing` unchanged.
2. THE Game_App SHALL keep the `index.html` title and meta tags in English and SHALL set only the Document_Language at runtime.
3. THE Game_App SHALL read the Locale only from its own `localStorage` and SHALL not assume shared storage with the Landing_App.
4. THE feature SHALL add no AI integration; THE project documentation SHALL record a locale contract for future AI dialogue as future work.
5. THE feature SHALL add no runtime dependency other than `i18next` and `react-i18next`.
6. THE Game_App SHALL use no emoji as icons in the Language_Selector or in any Locale_Dictionary.

### Requirement 14: Automated tests and quality gates

**User Story:** As a developer, I want tests that prove the language behavior, so that later changes cannot break it silently.

#### Acceptance Criteria

1. THE test setup SHALL initialize the I18n_Module with `en` before each test file and SHALL reset the Locale to `en` after each test.
2. THE test suite SHALL verify that the Game_App shows English on first start with no stored settings.
3. THE test suite SHALL verify that selecting "Tiếng Việt" in the Settings_Modal shows Vietnamese text in the main menu and in the open Settings_Modal without a reload.
4. THE test suite SHALL verify that a stored `vi` setting is restored after a remount of the App_Shell.
5. THE test suite SHALL verify that an invalid stored `language` value results in `en`.
6. THE test suite SHALL verify that a missing Vietnamese text falls back to the English text.
7. THE test suite SHALL verify that `en` and `vi` have the same Plural_Base_Keys, the same Interpolation_Variables per key, and no empty text.
8. THE test suite SHALL verify that changing the language keeps every other Game_Settings field.
9. THE test suite SHALL verify the properties of Requirement 10 with seeded generated action sequences.
10. THE test suite SHALL verify that the main menu and the loading screen show the Vietnamese labels listed in Requirement 7.9.
11. THE test suite SHALL keep the existing English assertions passing.
12. WHEN the feature is complete, THE commands `pnpm typecheck`, `pnpm test` and `pnpm build` SHALL succeed.

### Requirement 15: Documentation and steering

**User Story:** As a contributor, I want the language rules and the process for adding a language documented, so that I can extend the localization correctly.

#### Acceptance Criteria

1. THE file `.kiro/steering/language.md` SHALL state that repository documents, code, comments and identifiers stay in English, that user-facing game text lives in Locale_Dictionaries with English as source and fallback and Vietnamese as second locale, and that the Landing_App stays English-only until requested.
2. THE file `AGENTS.md` SHALL describe the updated language rule in its steering table.
3. THE file `CONTRIBUTING.md` SHALL contain an "Adding a language" section and SHALL replace the statement that multi-language support comes later.
4. THE file `docs/architecture/OVERVIEW.md` SHALL describe the I18n_Module, the Narrative_Overlay and the locale independence of the Chapter_Core with status `IMPLEMENTED` once verified.
5. THE file `docs/PROJECT_PROGRESS.md` SHALL contain a task history entry for this feature with the justification of the two new dependencies, the validation results, the dependency on the Chapter 1 pull request, and a recommendation for a native-speaker review of the Vietnamese text.

### Requirement 16: Branch and commits

**User Story:** As the owner, I want the work on its own branch with clear commits, so that I can review and merge it after Chapter 1.

#### Acceptance Criteria

1. THE work SHALL happen on branch `feat/game-i18n-en-vi`, created from `feat/chapter-01-playable` at commit `8fed327`.
2. THE commits SHALL use Conventional Commits, stage only named files, and carry the trailer `Co-authored-by: Kiro Agent <244629292+kiro-agent@users.noreply.github.com>`.
3. THE tasks SHALL create local commits only and SHALL not push.
