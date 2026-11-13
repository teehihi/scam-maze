# Design: Automated Gameplay QA

## Layers

| Layer | Tool | Runs | Purpose |
|---|---|---|---|
| Logic | Vitest + jsdom (exists) | every change, CI | reducer, scenarios, components |
| Agent QA | Playwright MCP (`.kiro/settings/mcp.json`, `@playwright/mcp@0.0.85`, Chrome, headless, isolated profile) | on demand by agents | exploratory and review checks on the live dev server |
| Regression flows | Playwright library Runner (new, `apps/game/qa/`) | developers on 5174, CI on preview | repeatable QA_Flows with evidence |

The MCP layer is already verified (2026-11-13): an MCP stdio client ran 11 checks of the menu ->
Settings -> New Game -> intro -> in game -> pause -> Return to menu flow on the owner's dev server;
it found the StrictMode double-step bug, which got a jsdom regression test.

## Runner

- `apps/game/qa/flows/*.ts`: each exports `{ name, steps: Step[] }`; a step has `do(page)` and
  `expect(page, probe)`.
- `apps/game/qa/run.ts`: launches Chrome (channel `chrome`, falls back to bundled Chromium) with
  `--use-angle=swiftshader --enable-unsafe-swiftshader` for headless WebGL, isolated context,
  viewport 1366x768, locale from the flow; writes `.kiro/qa-output/<timestamp>/`.
- Dependency: `@playwright/test` or `playwright` pinned to the version used by `@playwright/mcp`
  (decide in task 1; justify in the PR; root devDependency).
- Package script: `pnpm --filter @scammaze/game qa -- --base-url http://localhost:5174 [--flow name]`.

## QA_Probe

`window.__SCAMMAZE_QA__` defined only when `import.meta.env.DEV || import.meta.env.VITE_QA === "1"`:

```ts
interface QaProbe {
  version: 1;
  menu(): { activeItem: string | null };
  chapter(): Pick<ChapterState, "status" | "outcome" | "decision" | "pressure"> & {
    act: string; activeObjectives: string[]; discovered: string[];
  } | null;
}
```

Read-only: returns frozen copies from the existing store and selectors; no dispatch. A unit test
asserts it is absent when both flags are off and that returned objects are copies.

## Driving Chapter 1 deterministically

Flows move the player through interactions with the existing interaction prompts (E key on a
focused object) using the authored layout in `game/scenes/MainMenuScene/streetPlayArea.ts` and
the chapter's interactable positions; calls are triggered by the existing ring rules. No
gameplay shortcut is added to production code. If walking proves flaky in software WebGL, add a
dev-only "focus interactable <id>" probe command in a later, reviewed task.

## Correctness properties

| ID | Property | Requirements |
|---|---|---|
| Q1 | For every QA_Flow, the final QA_Probe state equals the state the same action sequence produces in `chapterReducer` (cross-check browser vs core). | 1.2, 1.3, 2.1 |
| Q2 | Running a flow twice on a fresh isolated profile yields the same step results. | 2.3 |
| Q3 | A flow with any console error fails. | 3.2 |

## Risks

Software WebGL is slow (the whole 11-check MCP flow took 36 s on the owner's Mac; a cold first
load took longer): generous step timeouts, one browser per run. Pointer lock may be unavailable
or behave differently headless; task 3 must check how movement and looking work without it
before writing walking steps (not verified yet).
