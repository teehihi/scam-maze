# SCAMMAZE

> *A safe, interactive Internet where people learn to spot scams before facing them in real life.*

SCAMMAZE is an interactive scam-awareness experience, built for **Kiroween 2026**. Players
investigate a fictional Internet (chat apps, emails, notifications, websites, marketplaces),
meet simulated scam tactics across several steps, make decisions, see the consequences, and
learn which warning signs gave the scam away. It is not a phishing quiz, a chatbot or a URL
scanner.

**Live landing page:** <https://teehihi.github.io/scam-maze/>

**Who it's for:** internet users aged 16+ in Vietnam and around the world, with equal weight
([positioning](docs/positioning.md)).

## Current status

| Area | Status |
|---|---|
| Landing page with a small branching demo and a string-only URL checker | `IMPLEMENTED` (GitHub Pages) |
| Game client: simulated Internet, scenarios S1–S3 and holdout H1, Consequence Replay, Risk DNA Graph, transfer test | `PLANNED` |
| Backend (API Gateway HTTP API + Lambda), static assets (S3 + CloudFront), monitoring | `PLANNED`, nothing provisioned on AWS |
| Database | `PENDING` decision ([database strategy](docs/architecture/DATABASE_STRATEGY.md)) |
| Authentication | `PENDING` |
| Optional AI | `PROPOSED`; the demo's "AI explanation" shows pre-written sample text |
| Custom domain | **Not purchased** ([deployment](docs/architecture/DEPLOYMENT.md#6-domain-and-dns--not-purchased)) |
| Tests | None yet; `pnpm build` is the current quality gate |

Details and progress: [project progress](docs/PROJECT_PROGRESS.md).

## Core experience (planned)

1. **Interactive Internet simulation** with fictional brands and reserved domains (`.test`, `.invalid`).
2. **Branching decision graph**: safe, unsafe and ambiguous routes with deterministic outcomes.
3. **Consequence Replay**: replay your choices, see missed warning signs and alternatives, all labelled as simulated.
4. **Risk DNA Graph**: links evidence, tactics, decisions, consequences and safe actions to real scenario content.
5. **Transfer test**: an unseen scenario to check whether the skill carries over.

The game runs locally and deterministically; AI is optional; no real credentials, OTPs or payments, ever.

## Technology stack (verified)

React 19 · TypeScript · Vite 8 · Tailwind CSS v4 · pnpm · GitHub Actions · GitHub Pages

Target additions (`PLANNED`/`PENDING`): Vercel, AWS API Gateway HTTP API, Lambda, S3,
CloudFront, CloudWatch, a database, authentication. See [architecture overview](docs/architecture/OVERVIEW.md).

## Architecture overview

Today: a static single-page app on GitHub Pages; no backend, no API calls, no stored data.
Target: a static landing page and a separate game client (Vercel), a local scenario engine with
IndexedDB progress, and a small serverless AWS backend in `ap-southeast-1` used only for opt-in
persistence and optional AI. Full diagrams: [OVERVIEW.md](docs/architecture/OVERVIEW.md).

## Development

Requires Node.js >= 22.12 and pnpm (`corepack enable`).

```bash
pnpm install
pnpm dev         # http://localhost:5173
pnpm typecheck   # TypeScript only
pnpm build       # typecheck + production build into dist/
pnpm preview     # serve dist/
```

Environment variables: only `VITE_BASE` (optional build-time base path, default `/`; CI sets
`/scam-maze/` for GitHub Pages). Planned variables are listed in
[DEPLOYMENT.md](docs/architecture/DEPLOYMENT.md#environment-variables).

## Deployment

`.github/workflows/deploy.yml` deploys the landing page to GitHub Pages on every push to `main`.
`.github/workflows/ci.yml` builds every pull request. No other deployments exist.
See [DEPLOYMENT.md](docs/architecture/DEPLOYMENT.md).

## Budget

AWS plan: $200 in promotional credits for a 3-month evaluation; baseline estimate $28.68
(not an invoice). Domain cost `TBD`, tracked separately. See
[cost estimation](docs/finops/COST_ESTIMATION.md).

## Documentation

| Document | Content |
|---|---|
| [Master plan](SCAMMAZE_KIROWEEN_2026_FULL_PLAN.md) | Full hackathon build plan |
| [Architecture overview](docs/architecture/OVERVIEW.md) | Current vs target architecture |
| [Deployment](docs/architecture/DEPLOYMENT.md) | Hosting, environments, domain status |
| [Database strategy](docs/architecture/DATABASE_STRATEGY.md) | Options and pending decision |
| [Cost estimation](docs/finops/COST_ESTIMATION.md) | AWS FinOps baseline and risks |
| [Project progress](docs/PROJECT_PROGRESS.md) | Status, decisions, task history |
| [Positioning](docs/positioning.md) | Audiences, messaging, writing rules |
| [AGENTS.md](AGENTS.md) | Instructions for AI coding agents |
| `.kiro/steering/` | Kiro rules: safety, icons, language, audience |

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md) · [Code of conduct](CODE_OF_CONDUCT.md) ·
[Security policy](SECURITY.md) · [Accessibility](ACCESSIBILITY.md)

The site and documentation are in English; Vietnamese is planned.

## License

[MIT](LICENSE) © 2026 SCAMMAZE contributors


## Game entry configuration

"ENTER THE GAME" is driven by one setting, `VITE_GAME_URL` (see `.env.example` and
`src/config/site.ts`). While it is empty, the button opens a "world is being
prepared" dialog. When the separately deployed game app is live, build the site
with `VITE_GAME_URL=https://play.scammaze.com` and every entry button becomes a link to it.
