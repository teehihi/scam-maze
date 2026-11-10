# Loading Screen Not Visible Bugfix Design

## Overview

The player confirmed the symptom: "It flashes too fast, I can't see anything." The loading screens render, but only for a fraction of a second. Two mechanisms cause this:

- `SceneTransition` always mounts at opacity 0 and fades in on the next animation frame (defects 1.1 and 1.3).
- Nothing keeps a loading screen up once its source reports done. The menu scene often reports ready quickly, and the Chapter 1 files usually come from the HTTP cache, so the fade-out starts before the fade-in has finished (defects 1.2, 1.4 and 1.5).

The fix has two parts, both in the presentation layer:

1. **Opaque first frame.** `SceneTransition` gets a `fadeIn` option (default `true`). The startup and chapter loading screens pass `fadeIn={false}`, so they are fully opaque on their first painted frame. Other users of `SceneTransition` (for example `ChapterPlaceholder`) keep the fade-in.
2. **Minimum display time (hold).** A small hook, `useMinimumDisplayTime`, starts one timer when a loading screen mounts. The screen may fade out only when the loading source is done **and** the minimum time has passed. Cancel, "Back to menu" and "Continue to menu" bypass the hold. The hold never touches progress values. Progress still comes only from the real loading source.

`chapterLoader.ts` and `useChapterLoader.ts` stay unchanged. The loader keeps reporting real stages and byte progress. It does not know that a hold exists.

## Glossary

- **Bug_Condition (C)**: A loading screen is mounted, and either its first painted frame is not fully opaque, or it starts to fade out before it has been fully opaque for the minimum display time, without the player having asked to leave.
- **Property (P)**: The loading screen is fully opaque from its first painted frame. It stays fully opaque until the loading source is done and the minimum display time has passed, or until the player chooses to leave.
- **Preservation**: Real progress reporting, error and stall handling, retry, cancel and abort behavior, reduced-motion instant transitions, the "hidden" handler firing exactly once, the NEW GAME → prologue → "Begin Chapter 1" flow, the WebGL fallback, and all other menu, audio and `/hochiminh` behavior.
- **Hold**: The period after mount during which a loading screen stays opaque even if loading is already done. It is presentation-only.
- **Bypass**: A player action that ends the screen without waiting for the hold: Cancel, Escape, "Return to menu" (chapter) and "Continue to menu" (startup).
- **`SceneTransition`**: Full-screen fade layer in `apps/game/src/components/ui/SceneTransition.tsx`. Exposes `data-state="visible" | "hidden"` and calls `onHidden` exactly once after the fade-out.
- **`ChapterLoadingFlow`**: Component in `apps/game/src/features/loading/ChapterLoadingFlow.tsx` that connects `useChapterLoader` to `LoadingScreen` and `SceneTransition`.
- **`MenuStartupLoading`**: Component in `apps/game/src/features/loading/MenuStartupLoading.tsx` that covers the main menu 3D scene at startup, using Drei `useProgress` and the `sceneReady` prop from `App.tsx`.
- **`CHAPTER_LOADING_MIN_DISPLAY_MS`**, **`STARTUP_LOADING_MIN_DISPLAY_MS`**: New exported constants for the hold length.

## Bug Details

### Bug Condition

The bug manifests whenever a startup or chapter loading screen is mounted and motion is not reduced (opacity 0 on the first frame), and whenever its loading source finishes quickly (fade-out starts while the screen is still partly transparent or has been opaque only for a few frames). `SceneTransition` initialises `entered` to `false` unless the duration is 0, and both flows derive `visible` only from the loading source, so `visible` can become `false` within a few frames of mount.

**Formal Specification:**
```
TYPE LoadingRun
  screen          : "startup" | "chapter"
  reducedMotion   : boolean
  doneAtMs        : number | null      // when the source reports done
                                        //   startup: sceneReady becomes true
                                        //   chapter: snapshot.stage becomes "ready"
  bypassAtMs      : number | null      // when the player cancels / leaves / continues to menu
  firstFrameOpacity : number           // observed opacity on the first painted frame
  fadeOutStartMs  : number | null      // observed time the layer switched to data-state="hidden"

FUNCTION minDisplayMs(screen)
  RETURN screen = "startup" ? STARTUP_LOADING_MIN_DISPLAY_MS     // 1200
                            : CHAPTER_LOADING_MIN_DISPLAY_MS     // 1500

FUNCTION isBugCondition(run)
  INPUT: run of type LoadingRun
  OUTPUT: boolean

  firstFrameNotOpaque := run.firstFrameOpacity < 1

  leftTooEarly := run.bypassAtMs = null
                  AND run.doneAtMs != null
                  AND run.fadeOutStartMs != null
                  AND run.fadeOutStartMs < max(run.doneAtMs, minDisplayMs(run.screen))

  RETURN firstFrameNotOpaque OR leftTooEarly
END FUNCTION
```

On the unfixed code, `firstFrameNotOpaque` is true for every run with `reducedMotion = false`, and `leftTooEarly` is true for every run with `doneAtMs < minDisplayMs(screen)`, because the fade-out starts at `doneAtMs`.

### Examples

- **Cached chapter files (1.4):** NEW GAME → prologue → "Begin Chapter 1". Both chapter files come from the HTTP cache, and `snapshot.stage` is `"ready"` after about 50 ms. Actual: the layer mounts at opacity 0, switches to `hidden` at about 50 ms, and the player sees a flicker. Expected: the layer is opaque at 0 ms, shows "Ready" with a full bar from about 50 ms, starts the fade-out at 1500 ms, and calls `onEnterChapter` once at about 2000 ms.
- **Fast menu startup (1.1, 1.2):** `sceneReady` becomes `true` 300 ms after mount. Actual: the canvas and menu are visible through a transparent layer, then the layer fades out from partial opacity. Expected: opaque at 0 ms, status "Ready" from 300 ms, fade-out starts at 1200 ms.
- **Slow chapter load (no extension):** files download in 4000 ms. Expected (fixed and unfixed agree on timing): the fade-out starts as soon as the stage is `"ready"` at 4000 ms. The hold does not add time, because the minimum has already passed.
- **Early cancel (1.5, 2.7):** the player presses Cancel 100 ms after mount. Expected: downloads abort immediately, the fade-out starts at 100 ms with no hold, and `onBackToMenu` is called once after the normal fade-out.
- **Edge case, reduced motion:** cached chapter, `reducedMotion = true`. Expected: opaque at 0 ms, hold until 1500 ms, then an instant hide (duration 0) and `onEnterChapter` once.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Chapter progress is computed only by `chapterLoader.ts` from received bytes of every manifest file, and is indeterminate when any size is unknown (3.1). `chapterLoader.ts` and `useChapterLoader.ts` are not modified.
- The startup bar stays indeterminate, with the real Drei `useProgress` file count as text (3.2).
- The stall timeout still aborts downloads and shows the "stalled" error with Retry and Back to menu (3.3).
- Retry starts a new load attempt and ignores the old attempt's events (3.4).
- Unmount or cancel aborts downloads, clears all timers (now including the hold timer) and sends no further updates (3.5).
- Reduced motion still means instant show and hide, with no fade animation (3.6).
- `onHidden` fires exactly once per `SceneTransition`; `onEnterChapter` / `onBackToMenu` / `onFinished` each fire at most once (3.7).
- NEW GAME still opens the prologue modal first, and chapter loading still starts only after "Begin Chapter 1" (3.8). CONTINUE with no valid save stays disabled with the reason text (3.9).
- Without WebGL, `App.tsx` still skips `MenuStartupLoading` and shows the canvas fallback (3.10). `App.tsx` needs no change.
- `SceneTransition` used without `fadeIn={false}` (for example `ChapterPlaceholder`) still fades in exactly as before.
- Main menu, settings, sound toggle, audio and the `/hochiminh` route are untouched (3.11). Ambient audio still starts when `showLoading` becomes false, which is now up to the hold length later on a fast start.
- The 30-second "taking longer than usual" watchdog still restarts only on real progress changes and never advances progress.

**Scope:**
All runs where the bug condition does NOT hold must be unaffected, except for the documented timing changes on bug-condition runs. This includes:
- runs where loading takes at least the minimum display time (no extension of the hold);
- runs that end through a bypass action (Cancel, Escape, "Return to menu", "Continue to menu");
- runs that end in an error state, which stay on screen until the player acts;
- every non-loading screen and every other `SceneTransition` user.

## Hypothesized Root Cause

Based on the bug description and the current code, the causes are:

1. **Fade-in always starts at opacity 0**: In `SceneTransition`, `entered` starts as `duration === 0`, so with motion allowed the first frame has `data-state="hidden"` and `opacity-0`. `entered` becomes `true` only in a `requestAnimationFrame` callback, and the CSS transition then takes 500 ms to reach full opacity.

2. **Visibility is tied directly to the loading source**: `ChapterLoadingFlow` computes `visible = session === null && !leavingToMenu`, and `MenuStartupLoading` computes `visible = !sceneReady && !dismissed`. When the source finishes within a few frames, `visible` turns `false` while the fade-in is still running, so `opaque` is never true or is true only briefly.

3. **No minimum display time**: An earlier version had a minimum display time, but it was removed together with the timers that faked progress. Nothing replaced the presentation-only part.

4. **Cached assets make the chapter load near-instant**: The Chapter 1 files are the files the main menu already downloaded, so the chapter loader reaches `"ready"` within a few frames in normal play. This makes cause 2 the common case, not an edge case.

The exploratory tests below must confirm causes 1 and 2 before the fix is written.

## Correctness Properties

Property 1: Bug Condition - Loading screens are opaque from the first frame and held for the minimum display time

_For any_ loading run where the bug condition holds (isBugCondition returns true on the unfixed code), that is, any startup or chapter run with any reduced-motion setting and any done time `doneAtMs`, and no bypass action, the fixed components SHALL render the `SceneTransition` layer with `data-state="visible"` on the first render, SHALL keep it `visible` until `max(doneAtMs, minDisplayMs(screen))`, SHALL switch it to `hidden` at that time, and SHALL call `onEnterChapter` (chapter) or `onFinished` (startup) exactly once after the fade-out. While held after done, the screen SHALL show the status "Ready" and, for chapter loading, the progress value 1; for startup loading, the bar SHALL stay indeterminate. No timer SHALL create or change a progress value.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**

Property 2: Bypass - Player exit actions skip the hold

_For any_ loading run where the player chooses Cancel, Escape or "Return to menu" (chapter) or "Continue to menu" (startup, from an error or the slow notice) at any time `bypassAtMs`, the fixed components SHALL abort the chapter loader immediately (chapter), SHALL switch the layer to `hidden` at `bypassAtMs` without waiting for the hold, and SHALL call `onBackToMenu` or `onFinished` exactly once after the normal fade-out, and SHALL NOT call `onEnterChapter`.

**Validates: Requirements 2.7, 2.8**

Property 3: Preservation - Non-buggy runs and other behavior are unchanged

_For any_ input where the bug condition does NOT hold (loading took at least the minimum display time, the run ended in an error, or the component is a non-loading `SceneTransition` user), the fixed code SHALL produce the same result as the original code: the same progress values and status text from the real source, the same error, stall and retry behavior, the same abort and timer cleanup on unmount, instant transitions under reduced motion, the default fade-in for other `SceneTransition` users, and exactly one "hidden" callback.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `apps/game/src/components/ui/SceneTransition.tsx`

**Component**: `SceneTransition`

**Specific Changes**:
1. **Add `fadeIn?: boolean` (default `true`)**: Initialise `entered` to `!fadeIn || duration === 0`. With `fadeIn={false}` the first render has `data-state="visible"` and `opacity-100`, and the rAF effect does nothing. A separate prop is preferred over duplicating the component, and over `initiallyVisible`, because `visible` already exists and means "should be shown".
2. **Keep the fade-out unchanged**: `onHidden` still fires exactly once via `firedRef`, after `duration` ms (or at once when `duration` is 0). Update the doc comment to describe `fadeIn`.

**File**: `apps/game/src/features/loading/useMinimumDisplayTime.ts` (new)

**Hook**: `useMinimumDisplayTime(minMs: number, resetKey?: unknown): boolean`

**Specific Changes**:
1. **One timer per hold**: In a `useEffect` keyed on `[minMs, resetKey]`, set `elapsed` to `false`, start `setTimeout(() => setElapsed(true), minMs)`, and clear it in the cleanup. This clears the timer on unmount and restarts it when `resetKey` changes.
2. **Presentation-only contract**: The hook returns only a boolean "minimum time has passed". It receives no progress, returns no progress, and does not read the clock. A doc comment states that it must never decide whether loading succeeded.
3. **Pure helper for tests**: Export `shouldShowLoadingScreen({ done, minElapsed, bypassed }): boolean`, returning `!bypassed && !(done && minElapsed)`. Both flows use it, so the visibility rule lives in one tested place.

**File**: `apps/game/src/features/loading/ChapterLoadingFlow.tsx`

**Component**: `ChapterLoadingFlow`

**Specific Changes**:
1. **Constant**: Export `CHAPTER_LOADING_MIN_DISPLAY_MS = 1500`. This is long enough to read the chapter title and the "Ready" status, and shorter than the fade-in plus fade-out of a typical cold load, so it costs little on real downloads.
2. **Hold**: Track attempts locally (`const [attempt, setAttempt] = useState(0)`; the Retry handler calls `retry()` and increments `attempt`) and call `useMinimumDisplayTime(CHAPTER_LOADING_MIN_DISPLAY_MS, attempt)`. Retry therefore clears the old hold timer and starts a new one, so a cached retry still shows "Ready" long enough to read.
3. **Visibility**: `visible = shouldShowLoadingScreen({ done: session !== null, minElapsed, bypassed: leavingToMenu })`.
4. **Bypass**: `handleBack` is unchanged (calls `cancel()` and sets `leavingToMenu`), so Cancel, Escape and "Return to menu" skip the hold.
5. **Opaque first frame**: Pass `fadeIn={false}` to `SceneTransition`.
6. **Progress and status during the hold**: No change needed. When `snapshot.stage === "ready"` the flow already passes `progress = 1` and `describeChapterStage` returns `LOADING_TEXT.stage.ready` ("Ready"). `handleHidden` still calls `onEnterChapter(session)` once, guarded by `SceneTransition`'s `firedRef`.

**File**: `apps/game/src/features/loading/MenuStartupLoading.tsx`

**Component**: `MenuStartupLoading`

**Specific Changes**:
1. **Constant**: Export `STARTUP_LOADING_MIN_DISPLAY_MS = 1200`. Startup is shorter than chapter loading because the player has not asked for anything yet and wants to reach the menu.
2. **Hold**: `const minElapsed = useMinimumDisplayTime(STARTUP_LOADING_MIN_DISPLAY_MS)`; `visible = shouldShowLoadingScreen({ done: sceneReady, minElapsed, bypassed: dismissed })`.
3. **Bypass**: `dismiss` (used by "Continue to menu" on the error and on the slow notice) is unchanged and skips the hold.
4. **Opaque first frame**: Pass `fadeIn={false}` to `SceneTransition`.
5. **Status during the hold**: When `sceneReady` is true and there is no error, set `status = LOADING_TEXT.menuStartup.ready` and `detail = undefined`. The bar stays indeterminate (`progress={null}`), because startup progress is not measured in bytes, and no percentage is shown.
6. **Watchdog**: The slow-notice effect keeps its current dependencies. It only runs while `visible && !failed`; once `sceneReady` is true the hold is at most 1200 ms, far below the 30-second notice.

**File**: `apps/game/src/game/loading/loadingStrings.ts`

**Specific Changes**:
1. **Add `menuStartup.ready: "Ready"`**: A complete string in the existing data object, ready for later extraction. The chapter flow already uses `LOADING_TEXT.stage.ready`.

**Reduced motion decision**: The hold still applies when the player prefers reduced motion; only the transitions become instant (duration 0). The hold is a static screen with no animation, so it does not conflict with the reduced-motion preference. Without the hold, reduced-motion players would get an even shorter flash (an instant show and an instant hide), which is the reported bug in its worst form, and they would not be able to read the status text.

**Not changed**: `chapterLoader.ts`, `useChapterLoader.ts`, `LoadingScreen.tsx`, `App.tsx`, `ChapterPlaceholder.tsx`. No new dependency.

**Documentation**: As required by `AGENTS.md`, the implementation task adds an entry to `docs/PROJECT_PROGRESS.md` with the files, the validation commands and their results.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior. Timing tests use `vi.useFakeTimers()` and `act(() => vi.advanceTimersByTime(ms))`, and they reference the exported constants instead of literal numbers. Reduced motion is controlled with the existing `mockReducedMotion` helper in `ChapterLoadingFlow.test.tsx`. Startup tests keep the existing `useProgress` mock.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Render each flow on the UNFIXED code with motion allowed, make the loading source finish immediately (cached fake fetch for chapters, `sceneReady` flipped to `true` for startup), and assert the expected fixed behavior. Use local hold values in these tests (1500 ms and 1200 ms) because the constants do not exist yet.

**Test Cases**:
1. **Opaque first frame, chapter**: Render `ChapterLoadingFlow` with motion allowed; assert `data-state="visible"` on the first render (will fail on unfixed code: `hidden`).
2. **Opaque first frame, startup**: Render `MenuStartupLoading` with motion allowed; assert `data-state="visible"` on the first render (will fail on unfixed code).
3. **Cached chapter hold**: Serve both files immediately; after the stage is `"ready"`, advance 100 ms; assert the layer is still `visible` (will fail on unfixed code: already `hidden`).
4. **Fast startup hold**: Rerender with `sceneReady` true at 0 ms; advance 100 ms; assert still `visible` (will fail on unfixed code).

**Expected Counterexamples**:
- `data-state` is `hidden` on the first render when motion is allowed.
- `data-state` becomes `hidden` within a few milliseconds of the source finishing.
- Possible causes: `entered` initialised to `false` in `SceneTransition`; `visible` derived only from the loading source; no hold.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL run WHERE isBugCondition(run) DO
  render screen(run) with fake timers and reducedMotion(run)
  ASSERT layer.dataState = "visible" on first render
  finish source at run.doneAtMs
  ASSERT layer.dataState = "visible" at every t < max(run.doneAtMs, minDisplayMs(run.screen))
  ASSERT status = "Ready" for t >= run.doneAtMs while held
  ASSERT layer.dataState = "hidden" at t = max(run.doneAtMs, minDisplayMs(run.screen))
  advance fade duration (500 ms, or 0 when reduced motion)
  ASSERT completion handler called exactly once
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL run WHERE NOT isBugCondition(run) DO
  ASSERT observable(original, run) = observable(fixed, run)
  // observable = progress values, status text, errors, abort signals,
  //              fade-out start time, number of handler calls
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

No property-based testing library is installed, and `AGENTS.md` asks to avoid new dependencies. The property tests therefore use a small seeded generator inside Vitest (a fixed-seed linear congruential generator producing done times, bypass times and reduced-motion flags), run a fixed number of cases (for example 50), and print the failing input in the assertion message. If the team later approves `fast-check`, these tests can move to it without changing the properties.

**Test Plan**: Observe behavior on UNFIXED code first for slow loads, errors, cancel, retry and unmount, then write tests capturing that behavior and run them against the fixed code.

**Test Cases**:
1. **No hold extension**: On unfixed code, a chapter load that reaches `"ready"` after more than `CHAPTER_LOADING_MIN_DISPLAY_MS` starts the fade-out at that moment; verify the fixed code starts it at the same moment (no extra delay).
2. **Cancel bypasses the hold**: Cancel at 100 ms; verify downloads abort at once, the layer is `hidden` at 100 ms, and `onBackToMenu` is called once after the fade-out, with `onEnterChapter` never called.
3. **Continue to menu bypasses the hold**: Startup with a file error; click "Continue to menu" at 100 ms; verify `hidden` at once and `onFinished` once after the fade-out.
4. **Unmount clears the hold timer**: Unmount during the hold; verify `vi.getTimerCount()` is 0 afterwards, no handler is called, and `console.error` is not called.
5. **Retry restarts the hold**: Fail, then Retry with a cached response; verify a new hold applies and `onEnterChapter` is called once.
6. **Reduced motion**: Verify transitions are `0ms`, the first render is `visible`, the hold still applies, and the hide is instant after it.
7. **Default fade-in kept**: Render `SceneTransition` without `fadeIn`; verify the first render is `hidden` and it becomes `visible` after the animation frame, as before.
8. **Progress honesty**: During the hold, verify the chapter bar shows `aria-valuenow="100"` only after the stage is `"ready"`, and the startup bar has no `aria-valuenow`; advancing timers during the hold never changes these values.

### Unit Tests

- `shouldShowLoadingScreen`: all eight combinations of `done`, `minElapsed`, `bypassed`.
- `useMinimumDisplayTime`: returns `false` before `minMs`, `true` at `minMs`; restarts on `resetKey` change; leaves no pending timer after unmount.
- `SceneTransition`: `fadeIn={false}` renders `visible` on the first render; default still fades in; `onHidden` fires exactly once, including when `visible` toggles more than once.
- `MenuStartupLoading`: shows "Ready" while held after `sceneReady`; the slow notice still appears after `STARTUP_SLOW_NOTICE_MS` when nothing changes.
- Update existing timing tests that rely on real-time `waitFor` with a 2000 ms timeout (for example "waits for the fade-out before entering when motion is allowed" and "finishes only when the scene reports ready") to use fake timers and the new constants, so they do not depend on wall-clock speed.

### Property-Based Tests

- **Property 1 (fix)**: For generated `doneAtMs` in `[0, 2 × minDisplayMs]` and both reduced-motion values, for both screens, the layer is `visible` on the first render and until `max(doneAtMs, minDisplayMs)`, then `hidden`, with exactly one completion call.
- **Property 2 (bypass)**: For generated `bypassAtMs` in `[0, 2 × minDisplayMs]`, with the source done or not done, the layer is `hidden` at `bypassAtMs` and only the exit handler is called, once.
- **Property 3 (preservation)**: For generated `doneAtMs` greater than or equal to `minDisplayMs`, the fade-out starts exactly at `doneAtMs`, matching the unfixed behavior; for generated progress sequences, the displayed progress equals the loader's reported progress at every step.

### Integration Tests

- Full chapter flow with the fake fetch and cached files: first render opaque, "Ready" during the hold, fade-out, `onEnterChapter` once, and no second call after rerender (extends the existing "enters the chapter exactly once" test).
- Manual check on the branch, after restarting `pnpm dev:game`: NEW GAME → prologue → "Begin Chapter 1" shows the chapter screen for about 1.5 seconds with a cached load, and the page reload shows the startup screen for at least about 1.2 seconds before the menu.
- Quality gate: `pnpm test`, `pnpm typecheck` and `pnpm build` pass, with all existing tests still passing (58 at the time of the report) plus the new tests.
