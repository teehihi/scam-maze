# SCAMMAZE database strategy

> **Last reviewed:** 7 Nov 2026 · Status labels as defined in [OVERVIEW.md](OVERVIEW.md#1-status-legend).

```text
DATABASE_DECISION = PENDING
```

**No database has been selected, provisioned or integrated.** The cost spreadsheet uses
DynamoDB On-Demand as a planning assumption only; that is **not** an architecture decision.
Do not add a database dependency, schema, migration or infrastructure until the owner records a
decision in [Project progress](../PROJECT_PROGRESS.md).

## 1. What the database is for

The game runs locally (see [OVERVIEW.md](OVERVIEW.md#5-data-flow-and-ownership)). A server
database is only needed for **optional, opt-in** features:

- user profile and preferences (only for users who create an account);
- completed mission summaries and learning progress, for cross-device sync;
- transfer test results;
- achievements and inventory/customization, **if** those features are approved;
- anonymized, aggregated results for the evaluation (plan section 6), if consent is given.

The master plan (section 4.1) states that the **core guest demo must not require a backend**, and
that server storage of identifiable results is optional and disabled in the public demo.

## 2. Expected access patterns

| # | Access pattern | Frequency (baseline, per month) | Notes |
|---|---|---|---|
| A1 | Get profile and settings by user ID | Once per signed-in session | Small item. |
| A2 | Upsert progress snapshot for a user | At milestones, batched | Not per click. |
| A3 | Record mission completion summary | Once per completed mission | Write-once summary. |
| A4 | List mission summaries for a user | Once per session or on demand | Bounded list. |
| A5 | Record transfer test result | Rare | Write-once. |
| A6 | Delete all data for a user | Rare | Required for privacy. |
| A7 | Aggregate anonymized results across users | Occasional, admin only | Relational-friendly. |

Illustrative volume at the baseline (300 monthly active users, 1,200 sessions): if every session is
signed in and does A1 + A4 once and two A2/A3 writes, that is about **2,400 reads and 2,400 writes
per month**. This is far below the 300,000 API requests in the spreadsheet; see
[Cost estimation, section 6.2](../finops/COST_ESTIMATION.md#62-api-request-volume).

## 3. Options

### Option A — Amazon DynamoDB (On-Demand)

**Advantages**

- Fully managed, serverless, no server to provision or patch.
- Natural fit for API Gateway + Lambda (IAM-based access, no connection pooling, no VPC).
- On-Demand billing scales to zero throughput cost when idle.
- Cheap for the key-value access patterns A1–A6.
- Eligible for AWS promotional credits like other AWS services (check your credit terms).

**Considerations**

- Requires access-pattern-first modelling; joins and ad-hoc queries are not natural.
- A7 (cross-user aggregates) needs pre-computed counters, an export, or a separate analytics step.
- Cost depends on read/write request units, item size, consistency, and optional features:
  - reads are charged per 4 KB, writes per 1 KB; strongly consistent reads cost twice as much as
    eventually consistent reads;
  - point-in-time recovery, on-demand backups and streams are billed separately when enabled.
- Moving later to a relational database is a data migration and a rewrite of the storage layer,
  not an engine switch.

Spreadsheet assumption: **$2.52 for 3 months**, with 2 GB of storage. Storage alone is not
enough to estimate DynamoDB cost; validate with the AWS Pricing Calculator using the counts in
section 2 and real item sizes.

### Option B — Amazon RDS for PostgreSQL

**Advantages**

- Relational modelling, SQL, transactions, foreign keys and constraints.
- Natural relationships between users, missions, progress, inventory and learning reports.
- Good for A7 and for evaluation analytics.

**Considerations**

- The instance is billed for every hour it is provisioned, used or not.
- Storage, backups beyond the free allowance, and data transfer add cost.
- A public IPv4 address on the instance has an hourly charge.
- Lambda needs a connection-management strategy (for example RDS Proxy, which has its own
  hourly charge, or a small pool with careful limits).
- Placing Lambda in a VPC to reach a private instance means outbound internet access (for
  example to an AI provider) needs a NAT gateway or VPC endpoints, which can cost more than the
  database itself.

**Illustrative compute cost** (secondary-source rate of about $0.025/hour for a small
Single-AZ instance in Singapore, **not an official quote**):

```text
$0.025 × 730 hours ≈ $18.25 per month
$18.25 × 3 months  ≈ $54.75 (compute only)
```

Storage, backups, public IPv4, RDS Proxy and data transfer are extra. For comparison, a
third-party price list shows `db.t4g.micro` PostgreSQL Single-AZ at $0.016/hour in US East
(N. Virginia); Singapore is usually higher. Verify with the AWS Pricing Calculator.

### Option C — Neon PostgreSQL

**Advantages**

- Managed, serverless PostgreSQL with scale-to-zero compute; billed by active compute hours and
  storage rather than a 24/7 instance.
- Relational model, SQL, transactions; good for A7.
- Branching makes development and preview databases cheap and easy.
- Reachable from Lambda over the internet without a VPC or NAT gateway; supports pooled
  connections and an HTTP/WebSocket driver suited to serverless.

**Considerations**

- External provider, not an AWS service: **AWS promotional credits cannot be assumed to cover
  Neon charges.** Any paid usage is out-of-pocket.
- One more vendor, account, and set of credentials to manage.
- Cold start: a suspended compute resumes on the first query (a short delay).
- Free plan limits (as published by Neon in Nov 2026): 100 CU-hours of compute per project per
  month, **1 GB storage per project**, 5 GB public network transfer per project per month. The
  spreadsheet's 2 GB storage assumption would exceed the free storage limit; paid storage is
  listed at $0.35 per GB-month and Launch compute at $0.106 per CU-hour.
  Sources: [Neon pricing](https://neon.com/pricing),
  [Free plan limits](https://neon.com/faqs/free-plan-limits-and-quotas). Re-check before use.
- Confirm that a Singapore region is available and that data residency is acceptable.

### Baseline for comparison — no server database in the MVP

Keep all progress in IndexedDB (master plan section 4.1) and add a server database only when
sync or accounts are approved. Cost $0, no new dependency, fully aligned with the plan's
privacy-first default. Limitation: no cross-device sync and no server-side reports.

## 4. Comparison matrix

| Criterion | DynamoDB On-Demand | RDS PostgreSQL | Neon PostgreSQL |
|---|---|---|---|
| Architecture fit (API Gateway + Lambda) | Very good: IAM access, no VPC, no pooling | Fair: VPC and connection management needed | Good: no VPC; pooled or HTTP driver |
| Estimated cost (baseline, 3 months) | Spreadsheet: $2.52; likely lower at local-first volumes (validate) | Compute alone ≈ $54.75 (illustrative), plus storage, IPv4, proxy | $0 within free limits; paid if storage > 1 GB or compute exceeds limits |
| Cost predictability | High at low volume; scales with requests | High (fixed hourly), but always-on | Medium: usage-based, plan limits |
| Operational complexity | Low | Medium–high (VPC, patching window, backups, proxy) | Low |
| Data modelling flexibility | Low–medium: design per access pattern | High | High |
| Scaling | Automatic | Manual instance sizing | Automatic within plan limits |
| Lambda integration | Native SDK, no connection limits | Connection limits; RDS Proxy recommended | Pooled connection string or serverless driver |
| Migration complexity later | High to a relational model | Low between PostgreSQL hosts | Low between PostgreSQL hosts |
| AWS promotional credit eligibility | Yes, subject to credit terms | Yes, subject to credit terms | **No** (external provider) |
| Suitability for SCAMMAZE | Good for A1–A6; A7 needs extra work | Over-provisioned for MVP traffic | Good if relational reports (A7) matter early |

## 5. Recommendation (not an approved decision)

> This is a **recommendation** for the owner. `DATABASE_DECISION` stays `PENDING` until the
> owner records a decision.

1. **For the hackathon MVP: no server database.** Ship local progress in IndexedDB first, as the
   master plan specifies. It costs nothing and protects privacy.
2. **When opt-in sync or accounts are approved: DynamoDB On-Demand** is the recommended default.
   It matches the serverless backend, has no idle compute cost, needs no VPC, and is covered by
   AWS credits subject to their terms. Access patterns A1–A6 are simple and user-keyed.
3. **Choose Neon PostgreSQL instead** if cross-user relational reporting (A7) or evaluation
   analytics become a core requirement early, and the team accepts an external, non-credit
   provider.
4. **Do not provision RDS for the MVP.** Its always-on instance cost, VPC requirements and
   connection management are not justified at the expected traffic.

Whichever option is chosen, keep the decision reversible: see section 6.

## 6. Avoiding lock-in until the decision

- Backend handlers call a small storage interface, not a database SDK directly. Illustrative
  (TypeScript shown; the runtime language is also `PENDING`):

  ```ts
  interface ProgressStore {
    getProfile(userId: string): Promise<Profile | null>;
    saveProgress(userId: string, snapshot: ProgressSnapshot): Promise<void>;
    recordMissionCompletion(userId: string, summary: MissionSummary): Promise<void>;
    listMissionSummaries(userId: string): Promise<MissionSummary[]>;
    recordTransferResult(userId: string, result: TransferResult): Promise<void>;
    deleteUserData(userId: string): Promise<void>;
  }
  ```

- Store **summaries**, not raw event streams; this keeps every option cheap.
- Include `scenarioId` and `scenarioVersion` in every record, because offline progress must not
  mix scenario versions (plan section 4.4).
- Illustrative models (not a schema to implement):
  - DynamoDB single table: partition key `USER#<userId>`; sort keys `PROFILE`,
    `PROGRESS`, `MISSION#<scenarioId>#<version>`, `TRANSFER#<testId>`.
  - PostgreSQL: tables `users`, `progress_snapshots`, `mission_completions`,
    `transfer_results`, with foreign keys to `users` and `ON DELETE CASCADE`.

## 7. Privacy, retention and deletion

These rules apply whatever database is chosen and must be in place before storing personal data.

- **Minimize:** no raw behavioural analytics by default; summaries only; no free-text personal
  content; never real credentials, OTPs or banking data (the game only uses fictional values).
- **Consent:** sync is opt-in. Evaluation data is anonymized and collected only with consent;
  no data from minors in the user study (plan section 5.2).
- **Retention:** define a retention period for inactive accounts and for evaluation data before
  launch (`PENDING`). Logs follow the 7–14 day retention in [DEPLOYMENT.md](DEPLOYMENT.md#45-logging-and-monitoring).
- **Deletion:** a user-triggered "delete my data" that removes every record for that user
  (access pattern A6), and clears local data on the device.
- **Backups:** if backups or point-in-time recovery are enabled, document how long deleted data
  can remain in backups.
- **Location:** keep data in `ap-southeast-1` unless a decision says otherwise; for an external
  provider, record its region.

## 8. Decision record

| Field | Value |
|---|---|
| Decision | `PENDING` |
| Options considered | DynamoDB On-Demand, RDS PostgreSQL, Neon PostgreSQL, no server database |
| Recommendation | Section 5 (not approved) |
| Owner | Project owner |
| Needed before | Any backend persistence work, any database infrastructure or migration |
| Inputs still missing | Final list of synced features; real item sizes; whether A7 is required for the hackathon; credit terms |
