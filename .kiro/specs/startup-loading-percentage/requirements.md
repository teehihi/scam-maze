# Requirements Document

## Introduction

The startup loading screen of the main menu (`apps/game/src/features/loading/MenuStartupLoading.tsx`)
currently shows an indeterminate bar and a file count from Drei `useProgress`. Drei's file total
grows while the street GLB is parsed (embedded textures register as items), so a percentage based
on file counts can go backwards. This feature adds a real percentage to the startup bar, measured
from the bytes of the main menu street GLB download (`STREET_ENVIRONMENT_GLB`,
`/assets/3d/optimized/MenuBG.optimized.glb`, about 26 MB). The percentage never decreases and is
never produced by a timer. When the download size is unknown, the screen keeps the current
indeterminate bar and file-count text. All other startup behavior stays as it is.

The sky texture (`SKY_TEXTURE`) is not part of the measured bytes: it loads through an image
loader that reports no byte progress.

## Glossary

- **Startup_Screen**: The `MenuStartupLoading` component that covers the main menu scene while it loads.
- **Street_GLB**: The main menu street environment file at `STREET_ENVIRONMENT_GLB`.
- **Street_Loader**: The loader that downloads and parses the Street_GLB for the main menu scene and for its module-level preload.
- **Byte_Progress_Store**: A framework-free module that holds the measured download progress of the Street_GLB and notifies subscribers when the value changes.
- **Progress_Event**: A download progress report with `loaded` bytes, `total` bytes and a `lengthComputable` flag, as emitted by the three.js file loader.
- **Known_Total_Event**: A Progress_Event where `lengthComputable` is true, `total` is a finite number greater than 0, and `loaded` is a finite number of 0 or more.
- **Byte_Percent**: The value held by the Byte_Progress_Store: either `null` (unknown) or an integer from 0 to 100.
- **Download_Complete**: The state after the Street_Loader has finished downloading and parsing the Street_GLB.
- **Scene_Ready**: The state in which the menu scene has compiled its shaders and the Startup_Screen receives `sceneReady={true}`.
- **Minimum_Display_Hold**: The existing period of `STARTUP_LOADING_MIN_DISPLAY_MS` during which the Startup_Screen stays visible.
- **Progress_Bar**: The `LoadingProgress` bar rendered by the Startup_Screen, determinate when it has a number and indeterminate when it has `null`.

## Requirements

### Requirement 1: Single download of the street file

**User Story:** As a player on a slow connection, I want the 26 MB street file downloaded only once, so that measuring progress does not cost extra time or data.

#### Acceptance Criteria

1. THE Street_Loader SHALL serve the module-level preload and the menu scene component from one shared loader cache entry for the Street_GLB.
2. WHEN the menu scene loads, THE Street_Loader SHALL issue exactly one network request for the Street_GLB during startup.
3. THE Street_Loader SHALL decode the Street_GLB with the Meshopt decoder, so that the menu scene receives the same scene content as before this feature.
4. THE Street_Loader SHALL report load failures through the existing Drei `useProgress` errors list.

### Requirement 2: Measured byte progress

**User Story:** As a player, I want the startup percentage to reflect real downloaded bytes, so that the number is honest.

#### Acceptance Criteria

1. WHEN the Street_Loader receives a Known_Total_Event, THE Byte_Progress_Store SHALL compute a candidate percent as `floor(loaded / total × 100)`, limited to the range 0 to 99.
2. WHEN a candidate percent is greater than the current Byte_Percent, or the current Byte_Percent is `null`, THE Byte_Progress_Store SHALL set Byte_Percent to the candidate percent.
3. WHEN a candidate percent is lower than or equal to the current Byte_Percent, THE Byte_Progress_Store SHALL keep the current Byte_Percent.
4. IF a Progress_Event is not a Known_Total_Event, THEN THE Byte_Progress_Store SHALL keep the current Byte_Percent.
5. WHEN the Street_Loader reaches Download_Complete, THE Byte_Progress_Store SHALL set Byte_Percent to 100.
6. THE Byte_Progress_Store SHALL hold `null` as Byte_Percent until the first Known_Total_Event or Download_Complete.
7. WHEN the Byte_Percent changes, THE Byte_Progress_Store SHALL notify every current subscriber once.
8. WHEN the Byte_Progress_Store is reset, THE Byte_Progress_Store SHALL set Byte_Percent to `null`.
9. THE Byte_Progress_Store SHALL change Byte_Percent only in response to Progress_Events, Download_Complete or a reset.

### Requirement 3: Percentage on the startup screen

**User Story:** As a player, I want to see a percentage on the startup loading bar, so that I know how much of the street has loaded.

#### Acceptance Criteria

1. WHILE Scene_Ready is false and Byte_Percent is a number below 100, THE Startup_Screen SHALL show a determinate Progress_Bar at Byte_Percent with the status "Loading the street scene".
2. WHILE Scene_Ready is false and Byte_Percent is 100, THE Startup_Screen SHALL show a full determinate Progress_Bar with the status "Preparing the street scene".
3. WHILE Scene_Ready is false and Byte_Percent is `null`, THE Startup_Screen SHALL show an indeterminate Progress_Bar with the existing status and file-count text derived from Drei `useProgress`.
4. WHILE Scene_Ready is true and no error is shown, THE Startup_Screen SHALL show a full determinate Progress_Bar with the status "Ready", including during the Minimum_Display_Hold.
5. WHILE the Startup_Screen is visible, THE Startup_Screen SHALL show a Progress_Bar value that is greater than or equal to every value the Progress_Bar showed earlier in the same mount.
6. WHILE Byte_Percent and the Drei `useProgress` values stay unchanged, THE Startup_Screen SHALL keep the same Progress_Bar value as time passes.
7. WHILE Byte_Percent is a number, THE Startup_Screen SHALL omit the Drei file-count detail text.

### Requirement 4: Preserved startup behavior

**User Story:** As a player, I want the rest of the startup screen to behave as before, so that the change adds a percentage without new problems.

#### Acceptance Criteria

1. THE Startup_Screen SHALL keep the existing Minimum_Display_Hold, opaque first frame, fade-out and single `onFinished` call.
2. WHEN Byte_Percent changes, THE Startup_Screen SHALL restart the 30-second slow-notice watchdog.
3. IF Drei `useProgress` reports errors or the scene reports an error, THEN THE Startup_Screen SHALL show the existing error state with "Reload page" and "Continue to menu".
4. WHEN the player selects "Continue to menu", THE Startup_Screen SHALL start the fade-out at once, bypassing the Minimum_Display_Hold.
5. THE Startup_Screen SHALL keep the existing reduced-motion behavior and the existing WebGL fallback path.
6. THE menu scene SHALL keep the existing scene content, calibration, animation and `compileAsync` readiness logic.

### Requirement 5: Documentation

**User Story:** As a team member, I want the docs to describe the real startup progress behavior, so that the documentation stays accurate.

#### Acceptance Criteria

1. THE project SHALL describe the byte-measured startup percentage in the startup-loading paragraph of `docs/architecture/OVERVIEW.md` section 4.2.1.
2. THE project SHALL record this task in the "Task history" of `docs/PROJECT_PROGRESS.md` with the fields listed in AGENTS.md section 6.
