# SCAMMAZE

> *Every scam starts on an ordinary day.*

SCAMMAZE is an interactive, browser-based, first-person 3D narrative game, built for **Kiroween 2026** (category: Frankenstein). You live an ordinary life in a small fictional neighbourhood. Scams reach you the way they do in real life: through your in-game phone and the people around you. You explore, talk to people, investigate evidence across the world and your phone, and decide what to do. The scammer can argue back. Your choices have simulated consequences that carry into later chapters, and each chapter ends with a debrief that links every warning sign to where you could have found it.

It is not a phishing quiz, a chatbot or a URL scanner. Full product definition: [product positioning](docs/product/PRODUCT_POSITIONING.md).

**Live landing page:** <https://teehihi.github.io/scam-maze/>

**Who it's for:** young adults and everyday internet users in Vietnam and around the world, with equal weight. Scam tactics are universally identical; only the surface details change. SCAMMAZE teaches defensive reflexes and pattern recognition rather than abstract theory.

**Detective loop:** explore 3D scenarios → inspect suspicious signals → resolve and solve the scam.

## Current Progress & Status (Phase A Complete · Phase B In Progress)

| Area | Status |
|---|---|
| Landing page (cinematic gateway, 4 responsive sections, "Enter the game" entry point) | `IMPLEMENTED` (GitHub Pages) |
| Full-Page Knowledge Hub (Docs, License, Privacy, Terms, Disclaimer, Cookies, About, Credits, Contact) | `IMPLEMENTED` (`/#docs`, `/#privacy`, etc.) |
| Brand Identity & Favicons (Isometric `S` ribbon logo, multi-resolution favicons, `#171521` theme) | `IMPLEMENTED` |
| First-person 3D game: hub world, in-game smartphone, narrative engine, Chapter 1 "The Missing Parcel", debrief | `PLANNED` |
| Game stack: Three.js + React Three Fiber + Drei, Zustand, TypeScript engine + Zod, IndexedDB/Dexie | `PLANNED` (not installed); Rapier physics `PROPOSED` |
| AI layer (signature capability: bounded AI scam actor) | `PROPOSED`; no AI provider selected or integrated |
| Backend (API Gateway HTTP API + Lambda), static assets (S3 + CloudFront), monitoring | `PLANNED`, nothing provisioned on AWS |
| Database | `PENDING` decision ([database strategy](docs/architecture/DATABASE_STRATEGY.md)) |
| Authentication | `PENDING` |
| Custom domain | **Not purchased** ([deployment](docs/architecture/DEPLOYMENT.md#6-domain-and-dns--not-purchased)) |
| Tests | `pnpm build` (TypeScript + Vite) is the current quality gate |

Details and progress: [project progress](docs/PROJECT_PROGRESS.md) and [master plan](SCAMMAZE_KIROWEEN_2026_FULL_PLAN.md).

## Core experience (planned)

**Physical world → digital interaction → investigation → decision → consequence → learning.**

1. **3D world:** walk around a small neighbourhood in first person; interact with objects, places and people.
2. **In-game smartphone:** fictional messages, email, websites, bank and parcel apps, embedded in the world.
3. **Investigation:** evidence is spread across the phone and the world; a clue in one can contradict the other.
4. **Decisions with consequences:** deterministic branches; simulated consequences persist across chapters.
5. **Bounded AI scammer:** answers and pushes back within authored tactics; authored fallback when AI is off.
6. **Debrief:** replay of your decisions, missed warning signs and where they were, and the safer alternative.

Fictional brands and reserved domains only; no real credentials, codes or payments, ever. The game is designed to work without AI.

## Technology stack

**Landing page (verified, in this repository):** React 19 · TypeScript · Vite 8 · Tailwind CSS v4 · lucide-react · pnpm · GitHub Actions · GitHub Pages

**Game application (`PLANNED`, not installed):** React 19 · TypeScript · Vite · Three.js (3D engine) · React Three Fiber · Drei · Rapier (physics, `PROPOSED`) · Zustand · TypeScript scenario engine · Zod · IndexedDB/Dexie. Needs a performance benchmark on target devices ([OVERVIEW.md, section 3.1](docs/architecture/OVERVIEW.md#31-game-application-stack)).

**Other target additions** (`PLANNED`/`PENDING`): Vercel, AWS API Gateway HTTP API, Lambda, S3, CloudFront, CloudWatch, an AI provider, a database, authentication. See [architecture overview](docs/architecture/OVERVIEW.md).

## Architecture overview

Today: a static landing page on GitHub Pages; no backend, no API calls, no stored data. Target: the landing page plus a separate browser game (3D world, phone UI, deterministic narrative and scam rules running locally), a bounded AI layer behind a small serverless AWS backend in `ap-southeast-1`, and local saves. Full diagrams: [OVERVIEW.md](docs/architecture/OVERVIEW.md).

## Development

Requires Node.js >= 22.12 and pnpm (`corepack enable`).

```bash
pnpm install
pnpm dev         # http://localhost:5173
pnpm typecheck   # TypeScript only
pnpm build       # typecheck + production build into dist/
pnpm preview     # serve dist/
```

Environment variables (build time, both optional; see `.env.example`):

- `VITE_BASE`: base path, default `/`; CI sets `/scam-maze/` for GitHub Pages.
- `VITE_GAME_URL`: where "Enter the game" leads (`src/config/site.ts`). While it is empty, the button opens a "world is being prepared" dialog. When a game build is deployed, set it to that deployment's URL (today that would be a default hosting URL; **no custom domain has been purchased**, so names such as `play.scammaze.com` are examples only).

Planned variables are listed in [DEPLOYMENT.md](docs/architecture/DEPLOYMENT.md#environment-variables).

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
- `docs/positioning.md`: pointer to canonical product positioning
- `docs/product/PRODUCT_POSITIONING.md`: canonical product positioning and game design
- `SCAMMAZE_KIROWEEN_2026_FULL_PLAN.md`: full build plan and roadmap for the hackathon

## Deployment

`.github/workflows/deploy.yml` deploys the landing page to GitHub Pages on every push to `main`.
`.github/workflows/ci.yml` builds every pull request. No other deployments exist.
See [DEPLOYMENT.md](docs/architecture/DEPLOYMENT.md).

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
