# SCAMMAZE cost estimation (AWS FinOps)

> **Last reviewed:** 7 Nov 2026
>
> **These are planning estimates, not AWS invoices or guaranteed prices.** The figures in
> sections 3–6 were supplied by the project owner as the planning baseline. They are preserved
> exactly; this document adds their assumptions, what must be validated, and the risks.
> **No AWS resources exist yet**, so there is no actual spend to compare against.
>
> Related: [Architecture overview](../architecture/OVERVIEW.md) ·
> [Deployment](../architecture/DEPLOYMENT.md) ·
> [Database strategy](../architecture/DATABASE_STRATEGY.md)

## 1. Summary

| Item | Value |
|---|---|
| AWS promotional credits | **$200.00** |
| Region | `ap-southeast-1` — Asia Pacific (Singapore) |
| Evaluation period | **3 months** |
| Estimated 3-month AWS cost (baseline, incl. contingency) | **$28.68** |
| Of which estimated service cost | $21.18 |
| Of which contingency and testing reserve | $7.50 |
| Estimated remaining credits | **$171.32** |
| Credit utilization | **14.34%** |
| Domain & DNS | **`TBD`** — not purchased, tracked separately, not covered by AWS credits |
| Database | `PENDING` — DynamoDB On-Demand is a cost assumption only |

Currency assumption for this document: **1 USD = 26,000 VND** (internal estimate, not a
guaranteed exchange rate).

## 2. Scope of the estimate

Included: the planned AWS services in [OVERVIEW.md](../architecture/OVERVIEW.md#3-target-architecture).
Not included unless stated: domain registration and DNS (section 9), Vercel, any AI provider,
external database providers (for example Neon), taxes, and AWS services that are not part of the
plan (for example NAT gateways, RDS, WAF, Secrets Manager); see section 11.

## 3. Monthly cost breakdown (baseline, supplied)

| AWS service / category | Month 1 | Month 2 | Month 3 | 3-month total |
|---|---:|---:|---:|---:|
| AWS Lambda | $0.34 | $0.57 | $0.80 | $1.71 |
| API Gateway HTTP API | $0.18 | $0.30 | $0.42 | $0.90 |
| DynamoDB On-Demand | $0.59 | $0.84 | $1.09 | $2.52 |
| Amazon S3 Standard | $0.14 | $0.17 | $0.20 | $0.51 |
| CloudFront CDN egress | $1.09 | $1.82 | $2.55 | $5.46 |
| CloudWatch Logs & Metrics | $2.91 | $2.91 | $2.91 | $8.73 |
| Amazon Cognito | $0.00 | $0.00 | $0.00 | $0.00 |
| AWS Data Transfer | $0.27 | $0.45 | $0.63 | $1.35 |
| Contingency & Testing Buffer | $3.00 | $2.50 | $2.00 | $7.50 |
| **Total** | **$8.52** | **$9.56** | **$10.60** | **$28.68** |

| Total | Month 1 | Month 2 | Month 3 | 3 months |
|---|---:|---:|---:|---:|
| VND (at 26,000) | 221,520 | 248,560 | 275,600 | 745,680 |

Every row and column total was re-calculated and matches (see section 13).

## 4. Financial overview

| Metric | Value | VND (at 26,000) |
|---|---:|---:|
| AWS promotional credits | $200.00 | 5,200,000 |
| Estimated 3-month cost | $28.68 | 745,680 |
| Estimated remaining credits | $171.32 | 4,454,320 |
| Credit utilization | 14.34% | — |

```text
$200.00 − $28.68 = $171.32
$28.68 / $200.00 × 100 = 14.34%
```

| Split of the 3-month estimate | Amount | Nature |
|---|---:|---|
| Estimated service costs (all rows except contingency) | $21.18 | Estimated charges |
| Contingency & testing reserve | $7.50 | **Planning reserve, not a guaranteed AWS charge** |
| **Total** | **$28.68** | |

## 5. Growth scenarios (supplied)

These are **scenarios, not traffic forecasts**.

| Scenario | Estimated scale | Monthly cost | 3-month cost | Remaining credits |
|---|---|---:|---:|---:|
| Internal Demo | 50–100 MAU, 50k requests | $3.35 | $10.05 | $189.95 |
| MVP Public Launch | 300 MAU, 300k requests | $9.56 | $28.68 | $171.32 |
| Viral Growth Spike | 2,000–3,000 MAU, 2.5M requests | $45.89 | $137.67 | $62.33 |
| Extreme Stress Test | 10,000 MAU, 10M requests | $138.62 | $415.86 | **−$215.86** |

- The **MVP Public Launch** monthly figure ($9.56) is the average of the baseline ramp in
  section 3 ($28.68 / 3); the 3-month totals are identical.
- **The Extreme Stress Test exceeds the $200 credit budget.** Sustained for three months it
  would need about **$215.86 (≈ 5,612,360 VND) of additional funding**, before taxes and before
  any cost outside these rows. It must not run without a budget decision.
- The Viral Growth Spike would use about 69% of the credits in three months.

## 6. Usage assumptions (supplied)

| Parameter | Assumption |
|---|---:|
| Registered users | 500 |
| Monthly active users | 300 |
| Sessions per user per month | 4 |
| Monthly sessions | 1,200 |
| Estimated API requests per month | 300,000 |
| Estimated requests per session | 250 |
| DynamoDB storage | 2 GB |
| S3 asset storage | 5 GB |
| Outbound CDN traffic | 15 GB |
| Evaluation period | 3 months |

These are **assumptions, not production measurements**. Consistency checks:
`300 MAU × 4 = 1,200 sessions`; `1,200 × 250 = 300,000 requests`.

### 6.1 Ramp implied by the baseline

The usage-driven rows grow as **60% → 100% → 140%** of month 2 (Lambda, API Gateway, CloudFront,
Data Transfer exactly; DynamoDB and S3 less, because part of their cost is storage). Month 2
therefore represents the 300 MAU / 300,000 request baseline; month 1 is about 180,000 requests
and month 3 about 420,000. CloudWatch is flat at $2.91 per month.

### 6.2 API request volume

The 300,000 requests per month assume **250 backend requests per session**. That conflicts with
the architecture: gameplay (choices, evidence inspection, graph interactions, replay) runs in
the browser and must not call the backend (see
[OVERVIEW.md](../architecture/OVERVIEW.md#44-backend-planned)).

An illustrative local-first estimate, to be replaced with real numbers when endpoints exist:

| Backend operation per signed-in session | Requests |
|---|---:|
| Token refresh / session start | 1–2 |
| Load profile and progress | 2 |
| Milestone sync (mission completed, batched) | 2–6 |
| Transfer test result (occasional) | 0–1 |
| Optional AI explanations (capped) | 0–5 |
| **Total** | **≈ 5–16** |

At 1,200 sessions that is roughly **6,000–19,200 requests per month**, about 2–6% of the
baseline. Static assets go through CloudFront and are counted there, not as API requests.
**The baseline is kept unchanged as a conservative upper bound** until real request counts are
measured. Guest sessions that never sign in make no API requests at all.

## 7. Line-item assumptions and validation

The spreadsheet's unit assumptions are not itemized. The table below records what each line
represents, which published free allowances **may** apply (eligibility depends on the account
and its plan; verify on the [AWS Free Tier page](https://aws.amazon.com/free/)), and what to
validate in the [AWS Pricing Calculator](https://calculator.aws/).

| Line | 3-month estimate | What it represents | Free allowances that may apply | To validate |
|---|---:|---|---|---|
| Lambda | $1.71 | Requests + GB-seconds for backend functions | Always-free 1M requests and 400,000 GB-seconds per month | Memory size, average duration, Arm vs x86, real request count (6.2) |
| API Gateway HTTP API | $0.90 | API calls; the figures imply about $1.00 per million | Possibly a 12-month offer on older accounts only | Singapore HTTP API rate; request count; payload size (metered per 512 KB) |
| DynamoDB On-Demand | $2.52 | Storage (2 GB) + read/write request units | Always-free 25 GB storage (Standard table class) | Read and write counts, item sizes, consistency, backups, PITR, streams (section 10 and [Database strategy](../architecture/DATABASE_STRATEGY.md)) |
| S3 Standard | $0.51 | 5 GB of assets + requests | Possibly a 12-month offer on older accounts only | Singapore storage rate; GET/PUT counts (mostly absorbed by CloudFront caching) |
| CloudFront egress | $5.46 | 15 GB/month CDN to internet (implies ≈ $0.12/GB) | Always-free 1 TB transfer and 10M requests per month; a $0 flat-rate plan also exists with smaller allowances | Whether the free allowance applies; cache hit ratio; asset sizes |
| CloudWatch | $8.73 | Logs and metrics; composition not itemized | Free allowances for basic metrics, some log ingestion and storage, a few alarms and dashboards | Log GB ingested per month, retention days, custom metric count, alarms, dashboards, tracing |
| Cognito | $0.00 | User pool sign-ins | Lite and Essentials tiers: 10,000 MAU free for direct and social sign-in; 50 MAU for SAML/OIDC federation; no free tier on Plus | Chosen tier and features; SMS messages are billed separately |
| Data Transfer | $1.35 | Internet egress **not** via CloudFront (for example API responses) | Always-free 100 GB per month to the internet, aggregated across services | That it does not double-count the CloudFront 15 GB |
| Contingency | $7.50 | Testing, mistakes, repeated deploys | — | Keep as a reserve; do not treat as spend |

### 7.1 Database cost (A)

The $2.52 assumes a specific request pattern that is not documented. Storage alone does not
determine DynamoDB cost. Validate read request units, write request units, item sizes,
strongly vs eventually consistent reads, backups, point-in-time recovery and streams. DynamoDB
is **not** the final choice; see section 10.

### 7.2 API requests (B)

See section 6.2. Recalculate from the real list of endpoints once they exist.

### 7.3 CloudWatch (C)

CloudWatch is the **largest single service line** ($8.73). Its composition is unknown; it must be
itemized. For the MVP:

- log retention of 7–14 days on every log group;
- short, structured logs at `INFO`; no request or response bodies;
- never log passwords, OTPs, tokens, credentials or personal data;
- a handful of alarms, no paid dashboards or high-cardinality custom metrics;
- tracing only while debugging.

### 7.4 CloudFront vs Data Transfer (D)

| Traffic | Billed as | Notes |
|---|---|---|
| Static assets to players | CloudFront egress | Should be the only path for assets. |
| API responses to players | Data transfer out (API Gateway/Lambda) | Small JSON responses. |
| Direct S3 internet downloads | S3 data transfer out | Should be zero: bucket private, CloudFront only. |
| CloudFront to internet | CloudFront egress | Same as "static assets". |
| S3 to CloudFront (origin fetch) | Not charged for data transfer | Requests still count. |

Make sure the 15 GB of CDN traffic is not also counted under "AWS Data Transfer".

### 7.5 Cognito (E)

The $0 is plausible only for the Lite or Essentials tier within the free MAU allowance, with no
SMS. Authentication is still `PENDING`; mark this line as an estimate pending verification.

### 7.6 Promotional credits (F)

See section 8.

## 8. Promotional credits and billing controls

**The $200 credit is not a universal $200 spending cap.**

| Topic | What to check |
|---|---|
| Source of the credit | `PENDING`: the brief does not say which program issued it. Check **Billing and Cost Management → Credits**. |
| If it is the AWS Free Tier new-account credit | Since 15 Jul 2025 new accounts can receive up to $200 in credits. On the **Free account plan**, the plan ends after 6 months or when credits are used up, whichever comes first, and some services are restricted ([AWS announcement](https://aws.amazon.com/about-aws/whats-new/2025/07/aws-free-tier-credits-month-free-plan), [AWS blog](https://aws.amazon.com/blogs/aws/aws-free-tier-update-new-customers-can-get-started-and-explore-aws-with-up-to-200-in-credits/)). Plan an upgrade decision **before** the end date so the account and data are not lost. |
| Expiry | Read the expiry date on the Credits page; record it in [Project progress](../PROJECT_PROGRESS.md). |
| Eligible services | As listed in the credit terms. |
| Excluded charges | AWS promotional credit terms exclude, among others, **Route 53 domain registration and transfer**, AWS Marketplace, some AWS Support plans, training and certification, and upfront fees for Savings Plans or Reserved Instances. AWS documentation states that credits cannot pay for [registering a domain with Route 53](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/domain-register.html). |
| Taxes | Check whether tax is charged on top of usage in your billing country and whether the credit covers it. |
| Non-AWS services | Vercel, Neon, any AI provider and any domain registrar are **not** covered. |

**Billing controls (recommended before the first deployment):**

- AWS Budgets with alerts, for example at $10, $25 and $50 of actual and forecasted cost.
- Free Tier usage alerts and AWS Cost Anomaly Detection.
- A monthly review of **Bills** and **Credits** pages, recorded in the progress file.
- AWS Budgets and alerts are **monitoring tools, not hard spending caps**; charges can exceed a
  budget before an alert is acted on.

## 9. Domain and DNS — Optional / Not Yet Purchased

| Cost category | Estimated cost | Status |
|---|---|---|
| **Domain & DNS — Optional / Not Yet Purchased** | **`TBD`** | No domain selected or purchased |

- This category is **separate from AWS infrastructure costs** and is **not** `$0`: no domain
  has been chosen, so the cost is unknown.
- **Do not assume AWS credits can pay for it.** Route 53 domain registration is explicitly
  excluded from promotional credits.
- If DNS is hosted in Route 53, a hosted zone has its own monthly charge (see
  [Route 53 pricing](https://aws.amazon.com/route53/pricing/)).

### 9.1 Extensions to evaluate

Prices below are **reported by third parties or registrars on or before Nov 2026, not verified
quotes**. Re-check on the registrar's site before any purchase.

| Extension | Reported price | Notes | Sources |
|---|---|---|---|
| `.com` | At-cost registrars charge the registry wholesale fee plus the ICANN fee; Verisign's wholesale `.com` fee was reported to rise from $10.26 to $10.97 on 1 Nov 2026. Route 53 `.com` reported at about $16/year by a third-party list. A Vietnamese registrar lists `.com` from 309,000 VND for the first year. | Global audience; renewals follow wholesale changes | [Cloudflare Registrar prices](https://pricing.registrar.cloudflare.com/), [report on Verisign increase](https://dev.to/301st/the-com-price-rises-on-1-november-lock-todays-for-up-to-ten-years-2epn), [tenten.vn price list](https://tenten.vn/en/bang-gia-ten-mien) |
| `.vn` | A Vietnamese registrar lists `.vn` from about 550,000–558,000 VND for the first year; an international registrar lists about €54/year | Managed by VNNIC; check registrant information requirements and the **renewal** price, which can differ from the first year | [tenten.vn price list](https://tenten.vn/en/bang-gia-ten-mien), [EuroDNS `.vn`](https://www.eurodns.com/es/dominios/dominio-vn) |
| `.com.vn` | An international registrar lists about €54/year for registration and renewal | Signals Vietnam; less natural for the international audience | [EuroDNS `.com.vn`](https://www.eurodns.com/domain-extensions/com.vn-domain-registration) |
| Others (for example `.app`, `.dev`, `.org`) | `TBD` | Consider only if `.com` is unavailable; `.app` and `.dev` require HTTPS | — |

### 9.2 Comparison criteria

1. First-year registration price.
2. **Annual renewal price** (prioritize transparent renewal over a low first-year price).
3. DNS management features (records needed by Vercel, API Gateway and CloudFront).
4. Registrar reputation and support.
5. Transfer policy and transfer-out fees or locks.
6. Privacy protection (WHOIS redaction) and any extra fees.

Positioning note: SCAMMAZE targets Vietnam **and** worldwide with equal weight
([positioning](../positioning.md)); a generic extension such as `.com` fits both audiences,
while `.vn` or `.com.vn` signal Vietnam only.

## 10. Database cost comparison

Details and recommendation: [Database strategy](../architecture/DATABASE_STRATEGY.md).
`DATABASE_DECISION = PENDING`.

| Option | 3-month estimate | Basis | Credit-eligible |
|---|---|---|---|
| No server database (IndexedDB only) | $0 | Master plan default for the MVP | n/a |
| DynamoDB On-Demand | $2.52 (spreadsheet); likely lower at local-first volumes | Requests + storage | Yes, subject to terms |
| RDS PostgreSQL, small Single-AZ | ≈ $54.75 compute only (illustrative $0.025/h × 730 h × 3) + storage, backups, public IPv4, proxy | Secondary-source rate, not a quote | Yes, subject to terms |
| Neon PostgreSQL | $0 within the free plan (1 GB storage per project); paid beyond | Neon published pricing, Nov 2026 | **No** |

If RDS replaced DynamoDB in the baseline, the 3-month estimate would rise by at least
`$54.75 − $2.52 = $52.23`, to about **$80.91** before storage and other RDS charges.

## 11. Cost risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| NAT gateway | Hourly charge plus per-GB processing; needed if Lambda runs in a VPC and calls the internet | Keep Lambda out of a VPC; avoid RDS for the MVP |
| Always-on database instance | Billed every hour | Prefer serverless options; stop or delete unused instances |
| Public IPv4 addresses | Hourly charge per address | Avoid public instances and Elastic IPs |
| CloudWatch growth | Verbose logs, no retention, custom metrics, dashboards | Retention 7–14 days; minimal metrics and alarms |
| Unthrottled API | Abuse can multiply Lambda, API and log costs | Route throttling; authentication on user routes |
| Large assets / 3D | CDN egress and storage scale with asset size | Compression, lazy loading; 3D only if approved |
| Direct S3 access | Uncached egress outside CloudFront | Private bucket with origin access control |
| AI provider calls | Paid per token; not covered by AWS credits | Optional, capped, cached, never in the core loop |
| Cognito add-ons | SMS messages and the Plus tier are not free | No SMS; stay on Lite/Essentials unless justified |
| Secrets Manager, KMS keys, X-Ray, WAF | Monthly or per-request charges not in the baseline | Use only with a documented need |
| Backups, PITR, streams | Extra charges per GB or request | Enable deliberately and document |
| Forgotten resources after the evaluation | Charges continue after the demo | Infrastructure as code; teardown step in the release checklist |
| Free account plan end date | Account closure after 6 months if not upgraded (if the credit is the Free Tier credit) | Track the end date; decide on upgrade in advance |

## 12. Cost optimization recommendations

1. Keep gameplay interactions local; no backend call per click or decision.
2. Use Lambda for event-driven backend work only.
3. Use API Gateway HTTP API, not REST API, unless a REST-only feature is needed.
4. Evaluate DynamoDB On-Demand against real access patterns and item sizes before choosing it.
5. Compress and optimize static assets (images, audio, any 3D).
6. Use CloudFront caching with content-hashed file names and long cache lifetimes.
7. Avoid large logs: short, structured, no bodies.
8. Set CloudWatch log retention on every log group.
9. Monitor data transfer and CDN usage monthly.
10. Avoid always-on infrastructure during development; deploy only what is being tested.
11. Do not provision RDS without approving its ongoing instance cost.
12. Keep paid AI calls out of the core gameplay loop.
13. Keep development and demo environments small; tear them down when not needed.
14. Configure AWS Budgets alerts, Cost Anomaly Detection and Free Tier alerts, and review actual
    charges and credits regularly.

**There is no guarantee the system stays within $200 under all traffic conditions.** The
estimate applies only to the assumptions in section 6.

## 13. Pricing validation checklist

- [x] Re-calculate every row, column and scenario total in this document (done 7 Nov 2026; all
      match).
- [ ] Confirm the source, expiry date and eligible services of the $200 credit.
- [ ] Rebuild the baseline in the AWS Pricing Calculator for `ap-southeast-1`.
- [ ] Itemize CloudWatch (log GB, retention, metrics, alarms, dashboards).
- [ ] Confirm whether always-free allowances apply to the account (Lambda, CloudFront, data
      transfer, DynamoDB storage).
- [ ] Replace the 250 requests/session assumption with counts from the real endpoint list.
- [ ] Validate DynamoDB read/write units and item sizes (if DynamoDB is chosen).
- [ ] Confirm the Cognito tier and that no SMS features are enabled (if Cognito is chosen).
- [ ] Check that CloudFront egress and data transfer are not double-counted.
- [ ] Get current domain prices, including renewal, from at least two registrars.
- [ ] After deployment: compare the estimate with the Bills page monthly and update this file.

## 14. Sources

Official pricing pages (check current rates for `ap-southeast-1`):
[AWS Pricing Calculator](https://calculator.aws/) ·
[AWS Free Tier](https://aws.amazon.com/free/) ·
[AWS Lambda](https://aws.amazon.com/lambda/pricing/) ·
[Amazon API Gateway](https://aws.amazon.com/api-gateway/pricing/) ·
[DynamoDB On-Demand](https://aws.amazon.com/dynamodb/pricing/on-demand/) ·
[Amazon S3](https://aws.amazon.com/s3/pricing/) ·
[Amazon CloudFront](https://aws.amazon.com/cloudfront/pricing/) ·
[Amazon CloudWatch](https://aws.amazon.com/cloudwatch/pricing/) ·
[Amazon Cognito](https://aws.amazon.com/cognito/pricing/) ·
[Amazon RDS for PostgreSQL](https://aws.amazon.com/rds/postgresql/pricing/) ·
[Amazon Route 53](https://aws.amazon.com/route53/pricing/) ·
[AWS Credits](https://aws.amazon.com/awscredits/)

Other sources used in this document:
[AWS: Free Tier credits announcement (Jul 2025)](https://aws.amazon.com/about-aws/whats-new/2025/07/aws-free-tier-credits-month-free-plan) ·
[AWS blog: Free Tier update](https://aws.amazon.com/blogs/aws/aws-free-tier-update-new-customers-can-get-started-and-explore-aws-with-up-to-200-in-credits/) ·
[AWS docs: Route 53 domain registration and credits](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/domain-register.html) ·
[AWS docs: CloudFront flat-rate plans](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/flat-rate-pricing-plan.html) ·
[AWS blog: data transfer free tier expansion](https://aws.amazon.com/blogs/aws/aws-free-tier-data-transfer-expansion-100-gb-from-regions-and-1-tb-from-amazon-cloudfront-per-month/) ·
[AWS re:Post: Cognito free tier for Lite and Essentials](https://repost.aws/questions/QUNgiwTkr6QsWIkyBN_6MLzg/new-cognito-plans) ·
[Neon pricing](https://neon.com/pricing) ·
[Vercel Hobby plan](https://vercel.com/docs/plans/hobby)

Third-party price reports are marked as such where used; they are not authoritative.
