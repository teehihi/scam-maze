---
inclusion: fileMatch
fileMatchPattern: ["**/apps/**/*.ts", "**/apps/**/*.tsx", "**/packages/**/*.ts"]
---

# Coding standards (TypeScript, React, Three.js)

Match the code around you first; these rules describe what the repository already does.

## Language and types

- TypeScript strict, ES modules, no `any` in new code (use `unknown` and narrow). Prefer
  discriminated unions and `as const` id arrays (`game/narrative/chapter1/ids.ts`) over enums.
- Guard record lookups with `Object.hasOwn` (keys like `__proto__` must not leak).
- Pure logic returns new objects; never mutate inputs (`chapterReducer`, `applyEffect`).

## Organization and naming

- Feature folders under `src/features/<feature>/`; pure engine code under `src/game/<area>/`;
  shared UI under `src/components/ui/`; contracts in `packages/shared-types`.
- Components and classes `PascalCase.tsx` / `PascalCase.ts`; hooks `useThing.ts`; pure modules
  `camelCase.ts`; tests next to the code as `name.test.ts(x)`, properties as
  `name.property.test.ts` (or in a `properties/` folder).
- Asset URLs only in `config/assetPaths.ts`; translated text only in `i18n/locales/{en,vi}`.

## Errors and robustness

- Untrusted data (saves, scenario data, settings, URLs) is parsed, never trusted: return a
  result with a reason instead of throwing (`parseSavedGame`, `validateScenarioIssues`,
  rejected `ActionResult`s). Exceptions are for programmer errors only.
- WebGL can fail: keep the fallback screens and context-loss handling working.

## Reuse

- Before adding a loader, renderer setup, audio context, collider or HUD widget, search for the
  existing one (see `architecture.md`, "Known duplication"). Extend it, or explain in the PR why
  not.
- No new abstraction for a single caller. A shared module needs two real users.

## Dependencies

- pnpm only (`packageManager: pnpm@10.26.0`). Pin exact versions for new dependencies, justify
  each one in the PR and add licenses to `THIRD_PARTY_NOTICES.md`. Prefer what is installed.
- The narrative core may import only `@scammaze/shared-types` (enforced by a test).

## Tests

- Every behavior change ships with a test; bugs get a regression test.
- Property tests use the repo's seeded generators (`src/test/seededRandom.ts`,
  `src/test/chapterRuns.ts`): print the seed on failure, default 200 cases. No second PBT library
  without a documented reason.
- Run `pnpm typecheck` and the related tests (`pnpm --filter @scammaze/game exec vitest related --run <files>`)
  before calling work done; `pnpm build` before a PR.
