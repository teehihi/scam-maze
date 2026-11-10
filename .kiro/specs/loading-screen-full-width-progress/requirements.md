# Requirements Document

## Introduction

The chapter loading screen and the menu startup loading screen currently show an awareness tip card in the bottom-right corner, next to a progress area capped at `max-w-2xl` in a two-column grid. This change removes the tip card from both loading screens and makes the progress area span the full width of the page, between the left and right page padding. Loading logic, timings and progress behavior stay unchanged.

## Glossary

- **Loading_Screen**: The presentational component `apps/game/src/components/ui/LoadingScreen.tsx`.
- **Chapter_Loading_Flow**: The component `apps/game/src/features/loading/ChapterLoadingFlow.tsx` that renders the Loading_Screen while a chapter loads.
- **Menu_Startup_Loading**: The component `apps/game/src/features/loading/MenuStartupLoading.tsx` that renders the Loading_Screen while the main menu loads.
- **Awareness_Tip_Card**: The `LoadingTip` component, labelled "Awareness tip", that shows a scam-awareness tip.
- **Progress_Area**: The part of the Loading_Screen that contains the progress bar, the status line, the percentage, the optional notice and the optional Cancel button.
- **Page_Padding**: The horizontal padding of the Loading_Screen bottom content area (`px-6`, and `sm:px-10` from the `sm` breakpoint).

## Requirements

### Requirement 1: Remove the awareness tip card from loading flows

**User Story:** As a player, I want the loading screen without the tip card on the right, so that the screen shows only the chapter title and the loading progress.

#### Acceptance Criteria

1. WHEN the Chapter_Loading_Flow renders the Loading_Screen, THE Chapter_Loading_Flow SHALL render the Loading_Screen without the Awareness_Tip_Card.
2. WHEN the Menu_Startup_Loading renders the Loading_Screen, THE Menu_Startup_Loading SHALL render the Loading_Screen without the Awareness_Tip_Card.
3. THE Loading_Screen SHALL keep the optional `tips` and `initialTipIndex` props so that other callers can still show the Awareness_Tip_Card.

### Requirement 2: Full-width progress area

**User Story:** As a player, I want the loading bar to reach the right side of the screen, so that progress is easy to see.

#### Acceptance Criteria

1. THE Loading_Screen SHALL render the Progress_Area at the full width between the left and right Page_Padding at every viewport width.
2. THE Loading_Screen SHALL limit the width of the eyebrow, title and subtitle block to `max-w-2xl`.
3. WHILE an error is shown, THE Loading_Screen SHALL limit the width of the error box to `max-w-2xl`.
4. WHERE the `tips` prop contains at least one tip, THE Loading_Screen SHALL render the Awareness_Tip_Card below the Progress_Area instead of in a side column.

### Requirement 3: Tests, checks and progress log

**User Story:** As a developer, I want the tests and progress log to match the new behavior, so that the repository stays accurate.

#### Acceptance Criteria

1. WHEN the Chapter_Loading_Flow test renders the loading state, THE test SHALL assert that no element labelled "Awareness tip" is present.
2. WHEN the change is complete, THE `pnpm test`, `pnpm typecheck` and `pnpm build` commands SHALL pass from the workspace root.
3. WHEN the change is complete, THE `docs/PROJECT_PROGRESS.md` Task history SHALL contain a new newest-first entry that reports only observed results.
