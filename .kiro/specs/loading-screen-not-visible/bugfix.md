# Bugfix Requirements Document

## Introduction

On branch `feat/game-cinematic-loading-screen`, a player reported that no loading screen is visible in the game app (`apps/game`). The report covers two loading moments:

- **Startup loading**: the screen that should cover the 3D main menu scene while it loads.
- **Chapter loading**: the screen that should appear after NEW GAME → prologue → "Begin Chapter 1" (or after CONTINUE), while the Chapter 1 files are fetched and the session is prepared.

There are two observed problems:

1. The startup screen first renders fully transparent and then fades in. If the menu scene becomes ready quickly, the player sees the 3D canvas and menu straight away, and the loading screen is never visible, or it is only a faint flash.
2. The Chapter 1 files are the same files the main menu already downloaded. They usually come from the HTTP cache, so the chapter loader reaches "ready" within a few frames. The chapter screen then starts its fade-out before its fade-in has finished, and the player sees nothing or a flicker of a fraction of a second.

Before this branch, the loading screen was fully opaque on its first frame and stayed up for a minimum time. Those timers were removed because they also faked progress. The fix must make the screens visible again **without** any timer producing or changing progress values.

Out of scope for code changes:

- NEW GAME opens the prologue modal, and chapter loading starts only after "Begin Chapter 1". This flow is intended and stays as it is. Testing must follow this path.
- If the player is running an old dev server or the deployed `main` build, the new screen is not present at all. Before treating a report as a code defect, check the branch and restart `pnpm dev:game`.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the game app mounts on the main menu route with WebGL available and motion is not reduced THEN the system renders the startup loading screen at opacity 0 on its first frame, so the 3D canvas and main menu are visible behind a transparent layer

1.2 WHEN the menu scene reports ready before or during the startup fade-in THEN the system starts the fade-out from a partly transparent state, so the startup loading screen is never visible at full opacity or is not noticeable at all

1.3 WHEN chapter loading starts and motion is not reduced THEN the system renders the chapter loading screen at opacity 0 on its first frame, so the main menu stays visible for the first frame of the transition

1.4 WHEN all chapter files are already cached and the chapter loader reaches the "ready" stage within a few frames THEN the system starts the fade-out before the fade-in has finished, so the chapter loading screen appears as a brief flicker or not at all

1.5 WHEN the player cancels chapter loading or chooses "Back to menu" within a few frames of the start THEN the system starts the fade-out before the screen is fully visible, so the player cannot tell that loading started

### Expected Behavior (Correct)

2.1 WHEN the game app mounts on the main menu route with WebGL available THEN the system SHALL render the startup loading screen fully opaque on its first painted frame, with no fade-in, so the 3D canvas and main menu are covered from the start

2.2 WHEN the menu scene reports ready before the startup loading screen has been shown for a minimum display time THEN the system SHALL keep the screen fully opaque until that minimum display time has passed, and only then fade it out

2.3 WHEN chapter loading starts THEN the system SHALL make the chapter loading screen fully opaque on its first painted frame, or SHALL complete its fade-in before any fade-out can start, so the screen is always seen at full opacity

2.4 WHEN the chapter loader reaches the "ready" stage before the chapter loading screen has been shown for the minimum display time THEN the system SHALL keep the screen fully opaque until that time has passed, then fade out and call the "enter chapter" handler exactly once

2.5 WHILE the system holds a loading screen open for the minimum display time THEN the system SHALL show only values reported by the real loading source: the progress bar SHALL show the measured byte progress (or the honest value 1 once the "ready" stage is reached), or SHALL stay indeterminate when progress is not measured, and no timer SHALL create, raise or animate a progress percentage

2.6 WHILE the system holds a loading screen open for the minimum display time after loading has finished THEN the system SHALL show a status that states loading is complete (for example "Ready"), so the extra time is not presented as ongoing loading

2.7 WHEN the player cancels or chooses "Back to menu" during chapter loading THEN the system SHALL stop the loader immediately and SHALL return to the main menu without waiting for the minimum display time, apart from the normal fade-out

2.8 WHEN the startup loading screen shows an error or the "taking longer than usual" notice and the player chooses "Continue to menu" THEN the system SHALL dismiss the screen without waiting for the minimum display time, apart from the normal fade-out

### Unchanged Behavior (Regression Prevention)

3.1 WHEN chapter files download with a known size THEN the system SHALL CONTINUE TO compute progress only from received bytes of every file in the chapter manifest, and SHALL CONTINUE TO show an indeterminate bar when any file size is unknown

3.2 WHEN the startup loading screen is shown THEN the system SHALL CONTINUE TO show an indeterminate bar with the real file count as text, based on Drei `useProgress`

3.3 WHEN no bytes arrive for the stall timeout THEN the system SHALL CONTINUE TO abort the downloads and show the "stalled" error with Retry and Back to menu actions

3.4 WHEN the player chooses Retry after a chapter loading error THEN the system SHALL CONTINUE TO start a new load attempt and SHALL CONTINUE TO ignore events from the previous attempt

3.5 WHEN the chapter loading flow unmounts or is cancelled THEN the system SHALL CONTINUE TO abort pending downloads, clear all timers and send no further updates

3.6 WHEN the user has enabled reduced motion THEN the system SHALL CONTINUE TO show and hide loading screens with instant changes (no fade animation)

3.7 WHEN a loading screen is hidden THEN the system SHALL CONTINUE TO call its "hidden" handler exactly once, with no duplicate transition and no duplicate "enter chapter" or "back to menu" call

3.8 WHEN the player chooses NEW GAME THEN the system SHALL CONTINUE TO open the prologue modal first, and SHALL CONTINUE TO start chapter loading only after "Begin Chapter 1"

3.9 WHEN the player chooses CONTINUE with no valid save THEN the system SHALL CONTINUE TO keep CONTINUE disabled and show the existing reason text

3.10 WHEN WebGL is not available at startup THEN the system SHALL CONTINUE TO skip the startup loading screen and show the canvas fallback

3.11 WHEN the player uses the main menu, settings, sound toggle, audio playback or the `/hochiminh` route THEN the system SHALL CONTINUE TO behave exactly as before this fix

3.12 WHEN `pnpm test`, `pnpm typecheck` and `pnpm build` run THEN the system SHALL CONTINUE TO pass all existing tests (58 at the time of this report) and checks
