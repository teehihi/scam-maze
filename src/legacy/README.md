# Legacy landing page pieces

These components come from the first landing page (light theme). They are no
longer mounted by `src/App.tsx` because the redesigned marketing site is not a
URL-checker or a quiz page. They are kept, typechecked, as reference for the
future game application:

- `ScenarioDemo.tsx` + `../data/scenario.ts`: a working two-step scenario state machine.
- `UrlChecker.tsx` + `../lib/urlCheck.ts`: string-only URL heuristics (never fetches).
- `Sections.tsx`, `Section.tsx`: old copy sections.

They use the old design tokens (`paper`, `ink`, `accent`), which no longer exist
in `src/index.css`, so they will not look right if mounted without porting.
