# Design Document

## Overview

This is a layout-only change to the loading screens of `apps/game`. The two loading flows stop passing tips to `LoadingScreen`, and `LoadingScreen` replaces its two-column bottom grid with a single full-width column. Loading logic, timings, progress values and error handling are not touched.

## Architecture

No architectural change. `LoadingScreen` stays a presentational component rendered by `ChapterLoadingFlow` and `MenuStartupLoading`. `LoadingTip.tsx` and `config/loadingTips.ts` stay in the codebase, unused by the two flows, with their existing tests.

## Components and Interfaces

### `ChapterLoadingFlow.tsx` and `MenuStartupLoading.tsx`

- Remove the `LOADING_TIPS` import.
- Remove the `initialTipIndex` state (`useState(() => Math.floor(Math.random() * LOADING_TIPS.length))`).
- Remove the `tips` and `initialTipIndex` props from the `<LoadingScreen>` element.
- Keep `useState` imported, because both files use it for other state.

### `LoadingScreen.tsx`

`LoadingScreenProps` is unchanged (`tips?` and `initialTipIndex?` stay optional).

Bottom content area, before:

```tsx
<div className="relative z-10 mt-auto grid w-full gap-6 px-6 pb-7 sm:px-10 sm:pb-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-end lg:gap-14">
  <div className="w-full max-w-2xl space-y-6">
    {/* eyebrow, title, subtitle */}
    {/* error box or progress area */}
  </div>
  {/* tip card as right column */}
</div>
```

After:

```tsx
<div className="relative z-10 mt-auto flex w-full flex-col gap-6 px-6 pb-7 sm:px-10 sm:pb-10">
  <div className="w-full max-w-2xl space-y-2">{/* eyebrow, title, subtitle */}</div>

  {error ? (
    <div className="w-full max-w-2xl">
      <LoadingErrorState /* same props */ />
    </div>
  ) : (
    <div className="w-full space-y-4">{/* LoadingProgress, notice, Cancel button */}</div>
  )}

  {tips && tips.length > 0 && (
    <div className="w-full max-w-md">
      <LoadingTip tips={tips} initialIndex={initialTipIndex} />
    </div>
  )}
</div>
```

`LoadingProgress` already fills its container (`w-full` bar), so removing the `max-w-2xl` cap lets the bar, status line and percentage reach the right page padding. If `LoadingProgress` has its own width cap, remove it as part of the same task.

## Data Models

No data model changes.

## Error Handling

The error box keeps the same component and props; only its wrapper changes to cap its width at `max-w-2xl`. The Escape key behavior is unchanged.

## Correctness Properties

No property-based tests apply. Every acceptance criterion is a UI layout check or a single render check, so the change is verified with example-based tests and the workspace checks.

## Testing Strategy

- Update `apps/game/src/features/loading/ChapterLoadingFlow.test.tsx`: replace `expect(screen.getByLabelText("Awareness tip")).toBeTruthy()` with `expect(screen.queryByLabelText("Awareness tip")).toBeNull()`.
- Keep the existing `LoadingTip` and `LoadingScreen` tests unchanged.
- Run `pnpm test`, `pnpm typecheck` and `pnpm build` from the workspace root (84 tests before this change).
