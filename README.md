# SCAMMAZE

**SCAMMAZE** is an interactive, browser-based, first-person 3D narrative game where players walk into everyday environments, investigate suspicious situations, and solve realistic online scam traps from a hands-on detective perspective. A **Kiroween 2026** entry.

**Live demo:** <https://teehihi.github.io/scam-maze/>

**Who it's for:** internet users aged 16+ in Vietnam and around the world, with equal weight. Scam tactics are universally identical; only the surface details change. SCAMMAZE teaches defensive reflexes and pattern recognition rather than abstract theory. See [docs/positioning.md](docs/positioning.md).

**Detective loop:** explore 3D scenarios → inspect suspicious signals → resolve and solve the scam.

## Current Progress & Status (Phase A Complete · Phase B In Progress)

- ✅ **Gate A Passed (09 Nov 2026):**
  - **Cinematic Gateway:** 4 responsive sections (Hero, The World of Scams, 4-Phase Progression, Halloween FAQ).
  - **Full-Page Knowledge Hub:** Dedicated pages for Documentation (`/#docs`), MIT License (`/#license`), Privacy Policy (`/#privacy`), Terms of Use (`/#terms`), Disclaimer (`/#disclaimer`), Cookie Policy (`/#cookies`), About (`/#about`), Credits (`/#credits`), and Contact (`/#contact`).
  - **Brand Identity & Favicons:** Custom isometric `S` ribbon logo, multi-resolution favicons, and Halloween dark design system (`#171521`).
  - **Build & CI Pipeline:** React 19, TypeScript, Vite 8, Tailwind CSS v4, automated GitHub Pages deployment workflow verified GREEN.
- 🔄 **Phase B In Progress:**
  - First-person 3D WebGL investigation game slice.
  - Branching narrative scenario state engine (`scenario.ts`).
  - Deterministic client-side URL heuristics (`urlCheck.ts`).

## Stack

React 19 · TypeScript · Vite 8 · Tailwind CSS v4 · WebGL/Three.js · pnpm

## Run locally

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # typecheck + production build into dist/
pnpm preview
```

Requires Node.js >= 22.12.

## Project structure

- `src/components/pages/InfoPage.tsx`: full-page Knowledge Hub (Docs, License, Legal, About)
- `src/components/sections/`:
  - `Hero.tsx`: cinematic entrance and gateway
  - `WorldOfScams.tsx`: three deception arts (Optical Illusions, Psychological Pressure, Social Engineering)
  - `InvestigateAndUncover.tsx`: 4-phase investigation progression
  - `FinalCallToAction.tsx`: interactive Halloween pumpkin FAQ and wave transition
- `src/components/Footer.tsx`: 4-column structured footer with `#171521` theme
- `src/components/Header.tsx`: responsive smart navigation header with custom branding
- `src/data/scenario.ts`: branching demo scenario (simulated data)
- `src/lib/urlCheck.ts`: deterministic URL heuristics; string analysis only, no network requests
- `src/assets/`: custom logos, character art, and Halloween visual assets
- `.kiro/steering/`: rules for Kiro and contributors
  - `safety.md`: never claim a URL is "safe"
  - `icons.md`: no emoji as icons
  - `language.md`: all repository content in English
  - `audience.md`: build for Vietnam and worldwide with equal weight
- `docs/positioning.md`: audiences, positioning, messaging and writing rules
- `SCAMMAZE_KIROWEEN_2026_FULL_PLAN.md`: full build plan and roadmap for the hackathon

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


## Game entry configuration

"ENTER THE GAME" is driven by one setting, `VITE_GAME_URL` (see `.env.example` and
`src/config/site.ts`). While it is empty, the button opens a "world is being
prepared" dialog. When the separately deployed game app is live, build the site
with `VITE_GAME_URL=https://play.scammaze.com` and every entry button becomes a link to it.
