# SCAMMAZE deployment

> **Last reviewed:** 7 Nov 2026 · Status labels as defined in [OVERVIEW.md](OVERVIEW.md#1-status-legend).
>
> **Nothing in sections 3–6 has been deployed or provisioned.** No AWS resources exist for
> SCAMMAZE. **No custom domain has been purchased.** Do not deploy, provision or buy anything
> without the owner's explicit approval (see [AGENTS.md](../../AGENTS.md)).

## 1. Current deployment (`IMPLEMENTED`)

| Component | URL / endpoint | How it is deployed | Status |
|---|---|---|---|
| Landing page | <https://teehihi.github.io/scam-maze/> | GitHub Actions `.github/workflows/deploy.yml` on every push to `main`; build target `apps/landing/dist` with `VITE_BASE=/scam-maze/` | `IMPLEMENTED` |
| Pull request builds | Artifact `landing-dist` on each CI run | `.github/workflows/ci.yml` validates workspace `pnpm typecheck` and `pnpm build` | `IMPLEMENTED` |
| Game client (`apps/game`) | Independent client build in `apps/game/dist` (port 5174 in dev) | Ready for Vercel deployment project | `IMPLEMENTED` (local & build ready) |
| Backend API | `TBD` | — | `PLANNED` |
| Static asset CDN | `TBD` | — | `PLANNED` |

## 2. Environments and configuration

| Environment | Landing URL | Game URL | Status |
|---|---|---|---|
| Local development | `http://localhost:5173` (`pnpm dev:landing`) | `http://localhost:5174` (`pnpm dev:game`) | `IMPLEMENTED` |
| Pull request preview | CI artifact today; Vercel preview URL later | Vercel preview URL later | `IMPLEMENTED` |
| Production | GitHub Pages URL above; Vercel project later | Vercel project later (e.g. `play.*` subdomain when domain purchased) | Landing `IMPLEMENTED`; Game `DEPLOYMENT READY` |

### Environment variables

| Variable | Used by | Purpose | Status |
|---|---|---|---|
| `VITE_BASE` | `apps/landing/vite.config.ts` | Base path; `/scam-maze/` on GitHub Pages, `/` elsewhere (default) | `IMPLEMENTED` |
| `VITE_GAME_URL` | Landing page (`apps/landing/src/config/site.ts`) | Link target for "Enter the game"; empty shows coming-soon dialog | `IMPLEMENTED` |
| `VITE_LANDING_URL` | Game app (`apps/game/src/features/menu/MainMenuOverlay.tsx`) | Link back to marketing & documentation hub (`http://localhost:5173` in dev) | `IMPLEMENTED` |
| `VITE_API_BASE_URL` | Game client | Backend base URL (AWS-provided URL until custom domain exists) | `PROPOSED` |
| `VITE_ASSET_BASE_URL` | Game client | CloudFront base URL for heavy assets | `PROPOSED` |

## 3. Frontend on Vercel (`READY FOR DEPLOYMENT`)

The repository is structured as a pnpm monorepo ready for independent Vercel projects:

| Project | Root Directory | Build Command | Output Directory | Notes |
|---|---|---|---|---|
| **SCAMMAZE Landing** | `apps/landing` | `pnpm build` | `dist` | SPA rewrite configured in `apps/landing/vercel.json` |
| **SCAMMAZE Game** | `apps/game` | `pnpm build` | `dist` | SPA rewrite configured in `apps/game/vercel.json` |

Both projects can link to the same GitHub repository without interfering with each other's build outputs or deployment cycles. Neither application depends on the other's build output. Serving happens from `/` on each respective domain/hostname.
  can stay unset.
- **Preview deployments** for every pull request; production deploys from `main` only.
- **Environment variables** are set per environment (Preview / Production) in the Vercel project,
  never in the repository.
- **Plan limits:** the Vercel Hobby plan is for
  [personal, non-commercial use](https://vercel.com/docs/plans/hobby) and has usage caps.
  If SCAMMAZE becomes commercial, a paid plan is required. This cost is outside the AWS budget.
- **Migration from GitHub Pages:** `PENDING`. GitHub Pages works today at no cost. Moving the
  landing page is only worthwhile together with the game client split, so both share one
  workflow. Until then, GitHub Pages remains the production landing page.

## 4. Backend on AWS (`PLANNED`, nothing provisioned)

Region: `ap-southeast-1` (Singapore).

### 4.1 API Gateway HTTP API

- Use an **HTTP API**, not a REST API, unless a REST-only feature becomes necessary (for example
  request validation models or usage plans). HTTP APIs are cheaper per request.
- Routes are few and coarse: for example `GET /v1/me`, `PUT /v1/progress`,
  `POST /v1/missions/{id}/complete`, `POST /v1/coach` (optional AI), `GET /v1/health`.
  Route names are `PROPOSED`.
- **Throttling** on every stage and route, to cap abuse and cost.
- **CORS** limited to the frontend origins in `ALLOWED_ORIGINS`.
- JWT authorizer for user routes once authentication is chosen (`PENDING`).

### 4.2 Lambda

- Runtime language `PENDING` (Python with FastAPI/Pydantic per the master plan, or TypeScript).
- Small functions, low memory to start (for example 256–512 MB), short timeouts, Arm
  (Graviton) where the runtime supports it.
- **No VPC** unless the chosen database requires it. A Lambda inside a VPC needs a NAT gateway or
  VPC endpoints to reach the internet (for example an AI provider), and a NAT gateway has an
  hourly charge that would dominate this budget.
- Data access goes through a small storage interface so the database decision does not leak
  into handlers.

### 4.3 IAM (least privilege)

- One execution role per function, scoped to the exact table or bucket and actions it needs.
- No wildcard `*` actions or resources in production policies.
- Deployment credentials are short-lived (for example GitHub OIDC to an AWS role), never long-lived
  access keys in repository secrets, if CI deploys are approved later.

### 4.4 Secrets

- AI provider keys and database credentials live in AWS Systems Manager Parameter Store
  (`SecureString`) or AWS Secrets Manager. Secrets Manager has a monthly charge per secret;
  check pricing before choosing it.
- Never put secrets in Lambda environment variables in plain text in the repository, in logs or in
  the frontend.

### 4.5 Logging and monitoring

- CloudWatch Logs with a **retention of 7–14 days** on every log group (the default is "never
  expire").
- Structured, short log lines (`INFO` in production). **Never log** passwords, OTPs, tokens,
  credentials, request bodies with personal data, or full IP addresses unless required.
- A minimal set of alarms (errors, throttles, unusual invocation counts) instead of dashboards
  with many custom metrics. Tracing (X-Ray) only when debugging a specific problem.
- AWS Budgets alerts and Cost Anomaly Detection; see
  [Cost estimation](../finops/COST_ESTIMATION.md#8-promotional-credits-and-billing-controls).

### 4.6 Infrastructure as code (`PROPOSED`)

Use one infrastructure-as-code tool (for example AWS SAM or AWS CDK) so resources are
reviewable in pull requests and can be deleted in one step. The choice is `PENDING`. **No
infrastructure code should be applied without owner approval.**

## 5. Static assets on S3 and CloudFront (`PLANNED`)

- **S3:** one private bucket, block all public access, served only through CloudFront with
  origin access control. No direct public S3 URLs, so there is no second, uncached egress path.
- **CloudFront:** compression on, long `Cache-Control` for content-hashed files, short for
  manifests (for example the scenario index).
- **Optimization:** the game is a first-person 3D game (owner decision, 8 Nov 2026), so 3D
  models and textures are the main assets: glTF with mesh compression, compressed textures,
  compressed audio, loading per area and per chapter (see
  [OVERVIEW.md](OVERVIEW.md#42-game-client-planned)). Total download size is set after
  prototyping.
- Until the game client exists and assets outgrow the frontend build, assets stay in the
  frontend build and S3/CloudFront are not needed.

## 6. Domain and DNS — not purchased

> **SCAMMAZE does not own a custom domain.** No domain has been selected, purchased or
> configured. Names such as `scammaze.com`, `play.scammaze.com` and `api.scammaze.com` are
> **illustrative examples only**. They are not registered, not configured and not operational.

### 6.1 Proposed hostname pattern (examples only)

| Component | Proposed hostname | Status |
|---|---|---|
| Landing page | `TBD` (for example `<selected-domain>`, possibly `scammaze.com` if available) | Not purchased |
| Game client | `play.<selected-domain>` | Not configured |
| Backend API | `api.<selected-domain>` | Not configured |
| Static assets | `assets.<selected-domain>` or the CloudFront default domain | Not configured |

Until a domain exists, use the GitHub Pages or Vercel default URL for the frontend, the
AWS-provided endpoint for the API, and `localhost` in development, all through environment
variables.

### 6.2 How a domain would be connected later (high level, after purchase)

1. **Choose a DNS host:** the registrar's DNS, a separate DNS provider, or a Route 53 hosted zone
   (monthly charge per hosted zone; check pricing).
2. **Frontend on Vercel:** add the domain in the Vercel project; Vercel shows the DNS records to
   create; it issues the TLS certificate.
3. **API on API Gateway HTTP API:** create a public certificate in AWS Certificate Manager in
   `ap-southeast-1`, create a custom domain name for the API, map the stage, and point the
   `api.` record at the API Gateway domain.
4. **Assets on CloudFront:** CloudFront requires the certificate in `us-east-1`; add the
   alternate domain name and point the record at the distribution.
5. Update `VITE_API_BASE_URL`, `VITE_ASSET_BASE_URL`, `VITE_GAME_URL` and `ALLOWED_ORIGINS`.

Domain selection and costs: [Cost estimation, section 9](../finops/COST_ESTIMATION.md#9-domain-and-dns--optional--not-yet-purchased).

## 7. Deployment safety checklist (before any AWS deployment)

- [ ] Owner approval recorded in [Project progress](../PROJECT_PROGRESS.md).
- [ ] Credit terms, expiry and eligible services checked on the AWS Billing console.
- [ ] AWS Budgets alerts and Cost Anomaly Detection configured.
- [ ] Infrastructure defined as code and reviewed in a pull request.
- [ ] Log retention, throttling and least-privilege IAM in place.
- [ ] Database decision recorded (no longer `PENDING`).
- [ ] No VPC/NAT gateway, RDS instance or other always-on resource without a documented cost.
- [ ] Rollback and teardown steps written down.
