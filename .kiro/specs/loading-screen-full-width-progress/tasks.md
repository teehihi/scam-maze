# Implementation Plan: Loading Screen Full-Width Progress

## Overview

Remove the awareness tip card from both loading flows and make the loading screen progress area span the full page width. One implementation task followed by a checkpoint.

## Tasks

- [x] 1. Remove the tip card and make the progress area full width
  - [x] 1.1 Update loading flows, LoadingScreen layout, test and progress log
    - In `apps/game/src/features/loading/ChapterLoadingFlow.tsx` and `apps/game/src/features/loading/MenuStartupLoading.tsx`: remove the `LOADING_TIPS` import, the `initialTipIndex` state, and the `tips` / `initialTipIndex` props on `<LoadingScreen>`
    - In `apps/game/src/components/ui/LoadingScreen.tsx`: replace the two-column grid with a single full-width column; cap only the title block and the error box at `max-w-2xl`; render the progress area at full width; render the optional tip card below the progress area in a `max-w-md` wrapper; keep `LoadingScreenProps` unchanged
    - Do not change loading logic, timings or progress behavior; keep `LoadingTip.tsx` and `config/loadingTips.ts`
    - In `apps/game/src/features/loading/ChapterLoadingFlow.test.tsx`: change the "Awareness tip" assertion to `expect(screen.queryByLabelText("Awareness tip")).toBeNull()`
    - Add a newest-first entry to the Task history in `docs/PROJECT_PROGRESS.md` per AGENTS.md section 6, reporting only observed results
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 3.1, 3.3_

- [x] 2. Checkpoint - Ensure all tests pass
  - Run `pnpm test`, `pnpm typecheck` and `pnpm build` from the workspace root; all must pass. Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 3.2_

## Notes

- No optional tasks and no property-based tests: the change is layout-only.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] }
  ]
}
```
