# SCAMMAZE

Landing page for **SCAMMAZE**: practice spotting online scam traps through interactive scenarios, then apply a checklist before you act in real life. A **Kiroween 2026** entry.

**Live demo:** <https://teehihi.github.io/scam-maze/>

**Who it's for:** internet users aged 16+ in Vietnam and around the world, with equal weight. Scam tactics are the same everywhere; only the details change, so SCAMMAZE teaches the pattern, not the brand. See [docs/positioning.md](docs/positioning.md).

**Learning loop:** learn the scenario → spot the signals → apply the checklist.

## Stack

React 19 · TypeScript · Vite 8 · Tailwind CSS v4 · pnpm

## Run locally

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # typecheck + production build into dist/
pnpm preview
```

Requires Node.js >= 22.12.

## Project structure

- `src/data/scenario.ts`: branching demo scenario (simulated data)
- `src/lib/urlCheck.ts`: deterministic URL heuristics; string analysis only, no network requests
- `src/components/`: landing page sections
- `.kiro/steering/`: rules for Kiro and contributors
  - `safety.md`: never claim a URL is "safe"
  - `icons.md`: no emoji as icons
  - `language.md`: all repository content in English
  - `audience.md`: build for Vietnam and worldwide with equal weight
- `docs/positioning.md`: audiences, positioning, messaging and writing rules
- `SCAMMAZE_KIROWEEN_2026_FULL_PLAN.md`: full build plan for the hackathon

## Deploy

The `.github/workflows/deploy.yml` workflow builds and deploys to GitHub Pages on every push to `main`
(Settings → Pages → Source: GitHub Actions). The `ci.yml` workflow builds every pull request.

## Safety note

Every domain in the demo is fictional and is never visited. The URL checker only reports signals; "no warning signs found" does not mean a link is safe.

## Contributing

- [CONTRIBUTING.md](CONTRIBUTING.md): setup, branch and PR workflow, safety rules for writing scenarios
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md): code of conduct
- [SECURITY.md](SECURITY.md): reporting security vulnerabilities (do not open a public issue)
- [ACCESSIBILITY.md](ACCESSIBILITY.md): accessibility commitments and known limitations

## Localization

The site and documentation are in English. Multi-language support (English and Vietnamese) is planned.

## License

[MIT](LICENSE) © 2026 SCAMMAZE contributors
