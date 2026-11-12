# SCAMMAZE

> *Every scam starts on an ordinary day.*

SCAMMAZE is an interactive, browser-based, first-person 3D narrative game, built for **Kiroween 2026** (category: Frankenstein). You live an ordinary life in a small fictional neighbourhood. Scams reach you the way they do in real life: through your in-game phone and the people around you. You explore, talk to people, investigate evidence across the world and your phone, and decide what to do. The scammer can argue back. Your choices have simulated consequences that carry into later chapters, and each chapter ends with a debrief that links every warning sign to where you could have found it.

It is not a phishing quiz, a chatbot or a URL scanner. Full product definition: [product positioning](docs/product/PRODUCT_POSITIONING.md).

**Live landing page:** <https://teehihi.github.io/scam-maze/>

**Who it's for:** young adults and everyday internet users in Vietnam and around the world, with equal weight. Scam tactics are universally identical; only the surface details change. SCAMMAZE teaches defensive reflexes and pattern recognition rather than abstract theory.

**Detective loop:** explore 3D scenarios → inspect suspicious signals → resolve and solve the scam.

## Current Progress & Status (Monorepo & 3D Main Menu Implemented)

| Area | Status | Notes |
|---|---|---|
| Monorepo Architecture | `IMPLEMENTED` | pnpm workspace (`apps/landing`, `apps/game`, `packages/shared-types`) |
| Landing page (marketing site & gateway) | `IMPLEMENTED` | Preserved in `apps/landing`; builds to GitHub Pages |
| Full-Page Knowledge Hub | `IMPLEMENTED` | 9 sections (`/#docs`, `/#privacy`, `/#terms`, `/#license`, etc.) |
| Brand Identity & Favicons | `IMPLEMENTED` | Isometric `S` ribbon logo, multi-resolution favicons, `#171521` theme |
| First-person 3D Main Menu | `IMPLEMENTED` | Three.js r174 + R3F + Drei cinematic street scene with low-poly city and cars |
| 3D Scene Controls & Parallax | `IMPLEMENTED` | Human eye-level camera with subtle breathing motion, mouse parallax, and customizable FOV |
| Menu UI & Modals | `IMPLEMENTED` | Start Prologue modal, Settings dialog (Graphics quality, FOV, Sound), Verified Credits modal |
| In-game smartphone & NPC interaction | `PLANNED` | Chapter 1 narrative milestone |
| Deterministic Scenario Engine | `PLANNED` | Pure TypeScript engine (independent from rendering) |
| Backend & AI Layer | `PROPOSED` | AWS API Gateway + Lambda in `ap-southeast-1` (no AI provider selected) |
| Database | `PENDING` | Decision pending ([database strategy](docs/architecture/DATABASE_STRATEGY.md)) |
| Custom Domain | `PENDING` | **Not purchased** (subdomains like `play.scammaze.com` are illustrative) |
| Quality Gates | `IMPLEMENTED` | Root & per-app `pnpm typecheck`, `pnpm test` (Vitest, game app) and `pnpm build` |

Details and progress: [project progress](docs/PROJECT_PROGRESS.md) and [master plan](SCAMMAZE_KIROWEEN_2026_FULL_PLAN.md).

## Core experience

**Physical world → digital interaction → investigation → decision → consequence → learning.**

1. **3D world:** walk around a small neighbourhood in first person; interact with objects, places and people.
2. **In-game smartphone:** fictional messages, email, websites, bank and parcel apps, embedded in the world.
3. **Investigation:** evidence is spread across the phone and the world; a clue in one can contradict the other.
4. **Decisions with consequences:** deterministic branches; simulated consequences persist across chapters.
5. **Bounded AI scammer:** answers and pushes back within authored tactics; authored fallback when AI is off.
6. **Debrief:** replay of your decisions, missed warning signs and where they were, and the safer alternative.

Fictional brands and reserved domains only; no real credentials, codes or payments, ever. The game is designed to work without AI.

## Technology stack

- **Landing page (`apps/landing`):** React 19 · TypeScript · Vite 8 · Tailwind CSS v4 · lucide-react · GitHub Pages
- **Game application (`apps/game`):** React 19 · TypeScript · Vite 8 · Three.js r174 · React Three Fiber v9 · Drei v10 · Tailwind CSS v4 · lucide-react
- **Shared contracts (`packages/shared-types`):** Pure TypeScript contracts for scene state, settings, scenarios, and metadata
- **Workspace:** pnpm v10 workspaces

## Development & Commands

Requires Node.js >= 22.12 and pnpm (`corepack enable`).

```bash
pnpm install

# Run applications locally
pnpm dev:landing       # http://localhost:5173 (Landing page & Knowledge Hub)
pnpm dev:game          # http://localhost:5174 (First-Person 3D Game & Main Menu)

# Build applications independently
pnpm build:landing     # Builds apps/landing into apps/landing/dist
pnpm build:game        # Builds apps/game into apps/game/dist

# Workspace-wide validation
pnpm typecheck         # Typechecks all packages and apps
pnpm test              # Runs Vitest tests (game loading pipeline)
pnpm build             # Full workspace build (shared-types, landing, game)
```

Environment variables (build time):

- In `apps/landing`:
  - `VITE_BASE`: Base path, default `/` (CI sets `/scam-maze/` for GitHub Pages).
  - `VITE_GAME_URL`: URL of the game application (e.g. `http://localhost:5174` in dev).
- In `apps/game`:
  - `VITE_LANDING_URL`: URL back to landing portal (e.g. `http://localhost:5173` in dev).

## Project Structure

```text
scam-maze/
├── apps/
│   ├── landing/                  # Marketing portal & Full Knowledge Hub
│   │   ├── public/               # Favicons, logos, Halloween assets
│   │   ├── src/                  # React components, sections, pages
│   │   ├── vite.config.ts        # Landing build configuration
│   │   ├── vercel.json           # Landing SPA rewrites
│   │   └── package.json          # @scammaze/landing
│   │
│   └── game/                     # First-Person 3D Narrative Game
│       ├── public/assets/3d/     # 3D models (modular city pack, vehicle pack)
│       ├── src/
│       │   ├── app/              # Root App & settings state
│       │   ├── components/ui/    # BrandLogo, MenuButton, ModalDialog, WebGLFallback
│       │   ├── features/menu/    # MainMenuOverlay, SettingsModal, CreditsModal
│       │   ├── game/core/        # GameCanvas with WebGL context detection
│       │   ├── game/scenes/      # MainMenuScene (Camera, Lighting, StreetEnvironment)
│       │   ├── styles/           # Tailwind CSS v4 setup & custom tokens
│       │   └── main.tsx          # Game entry point
│       ├── vite.config.ts        # Game build configuration (port 5174)
│       ├── vercel.json           # Game SPA rewrites
│       └── package.json          # @scammaze/game
│
├── packages/
│   └── shared-types/             # Framework-agnostic contracts & shared types
│       ├── src/index.ts
│       └── package.json          # @scammaze/shared-types
│
├── docs/                         # Architecture, product positioning & progress
├── .kiro/steering/               # Steering rules (safety, icons, language, audience)
├── .github/workflows/            # CI & GitHub Pages deployment workflows
├── pnpm-workspace.yaml           # pnpm workspace definition
├── THIRD_PARTY_NOTICES.md        # Verified licenses for 3D assets, fonts & libraries
├── AGENTS.md                     # Instructions for AI agents
└── README.md
```

## Verified 3D Asset Attribution

Detailed licensing and provenance are recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md):
- **Low Poly City Asset Pack:** By Calipo (Sketchfab, CC-BY 4.0).
- **Low Poly Cars Pack:** By matisosanimation (Sketchfab, CC-BY 4.0).

## License

The source code is released under the [MIT License](LICENSE). Third-party assets keep their own
licenses, listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The music in
`apps/game/public/reality/` is by Lê Quốc Khánh (Men Le), all rights reserved, and is not covered
by the MIT License.
