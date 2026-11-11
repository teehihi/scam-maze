# Contributing to SCAMMAZE

Thanks for helping people spot scams before they face them for real.
Please read the [Code of Conduct](CODE_OF_CONDUCT.md) first.

## Safety rules (non-negotiable)

These rules also live in [`.kiro/steering/safety.md`](.kiro/steering/safety.md),
so Kiro follows them too:

1. **Never say a URL, message or site is "safe".** "No bad signals found" is not
   "safe".
2. **URL analysis is string-only.** Never fetch, load, embed or redirect to a
   user-entered or scenario URL.
3. **No live malicious content.** Scenario domains must be fictional and must
   never be clickable. Defang URLs in issues (`hxxps://example[.]top`).
4. **The core works without AI and offline.** AI is an optional layer.
5. **No real personal data**, credentials or OTPs anywhere — in code, fixtures,
   issues or screenshots.

Security problems go through [SECURITY.md](SECURITY.md), not public issues.

## Getting started

Requirements: Node.js **22.12+** (CI uses Node 24) and **pnpm** (version pinned in
`package.json` → `packageManager`; enable it with `corepack enable`).

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm typecheck    # TypeScript only
pnpm test         # Vitest tests (game app)
pnpm build        # typecheck + production build into dist/
pnpm preview      # serve dist/
```

There is no automated test suite or linter yet; until there is, `pnpm build` must
pass and you must check your change manually in the browser. The **CI** workflow
runs `pnpm build` on every pull request and uploads the built site as a `dist`
artifact for review.

## Workflow

1. Open or pick an issue first, so work is not duplicated.
2. Create a branch from `main`:
   - `feat/<short-name>` — new feature
   - `fix/<short-name>` — bug fix
   - `scenario/<short-name>` — new or updated scenario
   - `docs/<short-name>`, `chore/<short-name>`, `ci/<short-name>`
3. Commit using [Conventional Commits](https://www.conventionalcommits.org/):
   `feat: add marketplace scenario`, `fix(url-check): handle IPv6 hosts`.
4. Open a pull request into `main` and fill in the template.
   Do not push directly to `main`; it deploys the live site.
5. For every meaningful change, add an entry to
   [`docs/PROJECT_PROGRESS.md`](docs/PROJECT_PROGRESS.md) in the same pull request, and update
   the architecture, deployment, database or cost documents in `docs/` if they become
   inaccurate.

Never provision cloud resources, buy a domain, or add a database without owner approval; see
[AGENTS.md](AGENTS.md) and [docs/architecture/](docs/architecture/OVERVIEW.md).

### Working with Kiro

This project is built with [Kiro](https://kiro.dev). AI agents follow [AGENTS.md](AGENTS.md),
which Kiro loads automatically. For non-trivial features:

- write or update a spec in `.kiro/specs/` (requirements → design → tasks)
  before coding, and link it in the PR;
- keep `.kiro/` committed — it is part of the project's evidence;
- when an AI agent helped write a commit, keep the human as author and add a
  trailer, for example:

  ```text
  Co-authored-by: Kiro Agent <244629292+kiro-agent@users.noreply.github.com>
  ```

## Writing scenarios

Scenarios live in `src/data/`. A good scenario:

- uses **fictional brands and reserved domains** (`.test`, `.example`,
  `.invalid`, `example.com`, documentation IPs such as `192.0.2.x`); no real
  company logos or names;
- works for **people in Vietnam and worldwide**: built on a tactic that exists
  everywhere, with no country-specific currency, phone format or payment
  method (see [product positioning](docs/product/PRODUCT_POSITIONING.md));
- reflects a real, current tactic, and cites a public source in the PR;
- has at least one safe path and one risky path, and **no dead ends**;
- explains every red flag with concrete evidence from the message;
- gives an independent way to verify (official app, hotline, typed URL);
- never shames the player.

Propose a scenario with the **Scenario proposal** issue template first.

## Code style

- TypeScript strict mode; no `any` without a comment explaining why.
- React function components; keep scenario logic pure and testable.
- Tailwind CSS utility classes; reuse theme colors from `src/index.css`.
- Accessibility is required, not optional — see [ACCESSIBILITY.md](ACCESSIBILITY.md).
- **No emoji as icons**, anywhere. Use an installed icon library (preferred:
  `lucide-react`), a PNG/SVG asset chosen by the developer, or a hand-written
  SVG component. Details: [`.kiro/steering/icons.md`](.kiro/steering/icons.md).
- **English** for docs, code, comments, identifiers, commits and PRs.
  The game (`apps/game`) ships in English and Vietnamese. Its user-facing text
  lives in locale dictionaries under `apps/game/src/i18n/`, with English as the
  source and the fallback. The landing page (`apps/landing`) stays English-only.
  Details: [`.kiro/steering/language.md`](.kiro/steering/language.md).

## Adding a language

The game uses i18next with dictionaries bundled in the app; no backend loads
translations. English (`en`) is the source text and the fallback for any missing
key. Translation changes display text only: it never changes IDs, game state,
evidence, decisions, outcomes or saves. Do not translate identifiers, and do not
put language checks in game logic.

To add a language (the example uses a locale code `xx`):

1. **Register the locale.**
   - Add `'xx'` to the `GameLocale` type in `packages/shared-types/src/index.ts`.
   - Add `"xx"` to `SUPPORTED_LOCALES` in `apps/game/src/i18n/locales.ts`, and add
     its label to `LOCALE_LABELS`. Write the label in the language itself (for
     example `vi: "Tiếng Việt"`); labels are not translated.
2. **Add the UI dictionaries.**
   - Copy `apps/game/src/i18n/locales/en/` to `apps/game/src/i18n/locales/xx/`,
     keeping the same file names, including the area files in `chapter1/` and
     `worlds/`.
   - Type each dictionary with `LocaleShape<typeof en>` from
     `apps/game/src/i18n/types.ts`, as the `vi` files do. TypeScript then reports
     missing or extra keys.
   - Translate the text. Keep every `{{variable}}` unchanged, and add the plural
     forms (`_one`, `_other`, and so on) that the language needs.
   - Import the dictionaries in `apps/game/src/i18n/resources.ts`, add an
     `xxResources` object for every namespace in `NAMESPACES`, and add it to
     `resources`.
3. **Add the narrative overlay.** Chapter text (scenario, dialogue, evidence,
   phone content, endings) comes from a narrative overlay, not from the
   dictionaries.
   - Create `apps/game/src/i18n/narrative/chapter1.xx.ts`, with one part per area
     in `apps/game/src/i18n/narrative/chapter1.xx/`, following
     `chapter1.vi.ts`. The parts must use disjoint keys.
   - Register the overlay for the locale in `NARRATIVE_OVERLAYS` in
     `apps/game/src/i18n/narrative.ts`.
4. **Run and extend the tests.**
   - Extend the key consistency test (`apps/game/src/i18n/resources.test.ts`)
     and the overlay test (`apps/game/src/i18n/narrative.test.ts`) to cover the
     new locale. They check that keys, plural keys and `{{variables}}` match
     English, that no text is empty, and that the overlay covers every
     narrative text key.
   - Write a content lint for the new language, similar to
     `apps/game/src/i18n/content.vi.test.ts`. It must enforce the content
     rules: no emoji, never call a URL, message or site "safe", keep fictional
     brand names, character names, phone numbers, domains and numbers
     unchanged.
   - Run `pnpm typecheck`, `pnpm test` and `pnpm build`.
5. **Ask for a native-speaker review** of the new text before merging, and
   mention it in the pull request.

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](LICENSE).
