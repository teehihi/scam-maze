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
- **English only** for UI copy, docs, comments, commits and PRs.
  Multi-language support comes later; do not add other languages or an i18n
  library yet. Details: [`.kiro/steering/language.md`](.kiro/steering/language.md).

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](LICENSE).
