# Quickstart And Verification: SPEC-BE-001

**Purpose**: Required clean-clone and acceptance workflow after implementation  
**Current status**: Implemented commands are listed below. A command is not a
release pass until its output is recorded in the acceptance traceability checklist.

## Prerequisites

- Git checkout on `codex/backend-spec-be-001`.
- Node.js 24 LTS.
- Docker Desktop or another Docker-compatible runtime with at least 7 GB
  available for the official Supabase local stack.
- PostgreSQL `psql` 17 or newer on `PATH` for SQL performance runners.
- k6 with the SQL extension used by `outbox-dispatch.k6.js`.
- No global Supabase CLI is required; the package-pinned CLI is used.
- No Clerk, OpenRouter, Stripe, SMTP, or production Supabase secret is required
  for foundation development/tests.

Run commands from repository root unless a section says otherwise.

## 1. Confirm Scope And Install

```powershell
git branch --show-current
git status --short
npm --prefix apps/api ci
```

Expected branch: `codex/backend-spec-be-001`.

The branch may contain the user's unrelated `.agents/plugins/` work; verification
must ignore and preserve it. The feature diff must not contain Mobile/Admin
changes or resources owned by Specs 002-014.

## 2. Create Local Runtime Values

Implementation provides a secret-free `apps/api/.env.example`. Create a local
ignored environment file or inject variables through the terminal/runtime:

```text
NODE_ENV=development
MASARIFI_PROCESS_KIND=api
MASARIFI_RELEASE_VERSION=local
MASARIFI_HTTP_PORT=3000
MASARIFI_CORS_ORIGINS=http://localhost:3001
DATABASE_URL=<local Supabase database URL printed by the CLI>
```

Do not place production credentials in this file. Worker and migration commands
override `MASARIFI_PROCESS_KIND` through their command definitions.

## 3. Start Official Supabase

The package script executes the pinned CLI with `--workdir ../..`, so the root
`supabase/` directory remains canonical:

```powershell
npm --prefix apps/api run supabase:start
npm --prefix apps/api run db:reset
npm --prefix apps/api run db:lint
npm --prefix apps/api run test:db
```

Required outcomes:

- the official stack starts without custom Postgres/Auth/Storage/Queue services;
- migrations replay from a clean database in timestamp order;
- database lint exits zero at error level;
- pgTAP proves structure, grants/RLS, functions, queue/buckets, and outbox
  behavior;
- no production test teardown SQL is present in migrations.

Stop the local stack when finished:

```powershell
npm --prefix apps/api run supabase:stop
```

## 4. Run API And Worker Locally

Terminal 1:

```powershell
npm --prefix apps/api run start:dev
```

Terminal 2:

```powershell
npm --prefix apps/api run start:worker:dev
```

The API must bind only after configuration validation. The worker must not bind
an HTTP port or run migrations.

## 5. Verify HTTP Contracts

```powershell
Invoke-RestMethod -Uri 'http://localhost:3000/health/live'
Invoke-RestMethod -Uri 'http://localhost:3000/health/ready'
```

Expected liveness body:

```json
{
  "status": "ok",
  "version": "local",
  "startedAt": "2026-08-27T12:00:00.000Z"
}
```

Expected readiness body while PostgreSQL and Queue are healthy:

```json
{
  "status": "ready",
  "checks": {
    "database": "up",
    "queue": "up"
  }
}
```

`GET /api/v1/meta` must fail closed without the SPEC-BE-002 production verifier:

```powershell
try { Invoke-RestMethod -Uri 'http://localhost:3000/api/v1/meta' } catch { $_.Exception.Response.StatusCode.value__ }
```

Expected unauthenticated status: `401`. A correctly shaped token with no
configured production verifier returns the safe unavailable path, not `200`.
Contract tests use local signed JWT fixtures to prove the approved `200` schema.

Every response must return `X-Request-Id`; malformed caller IDs are replaced.
No health/error response may reveal host, port, SQL, stack, path, secret, or raw
dependency error.

## 6. Run Application Verification

```powershell
npm --prefix apps/api run typecheck
npm --prefix apps/api run lint
npm --prefix apps/api run test:unit
npm --prefix apps/api run test:contract
npm --prefix apps/api run test:integration
npm --prefix apps/api run test:e2e
npm --prefix apps/api run build
```

Required contract coverage includes configuration, request ID, strict DTOs,
content/body/time limits, CORS, security headers, safe errors, all three routes,
OpenAPI drift, outbox validation/retry, and shutdown.

## 7. Build And Test Containers

```powershell
docker build --file docker/backend.Dockerfile --tag masarifi-backend:spec-be-001 .
docker compose --file docker/local/compose.backend.yml up --build
npm --prefix apps/api run test:container
npm --prefix apps/api run test:release-image
```

The container test must prove:

- API, worker, and migration commands use the same image digest;
- production UID is non-root;
- root filesystem is read-only with only explicit temporary writable mounts;
- only the API process exposes the approved port;
- runtime contains no development dependency, source secret, default credential,
  shell, or package manager;
- liveness/readiness behave truthfully during dependency loss/recovery;
- SIGTERM stops new work and drains/releases within 30 seconds.

Stop local orchestration without deleting the official Supabase data unless the
test explicitly owns disposable state:

```powershell
docker compose --file docker/local/compose.backend.yml down
```

## 8. Run Security And Supply-Chain Gates

```powershell
npm --prefix apps/api run security:sast
npm --prefix apps/api run security:dependencies
npm --prefix apps/api run security:scope
npm --prefix apps/api run security:workflow-pins
```

Secret scanning, image scanning, SBOM generation, and provenance signing are
implemented as blocking jobs in `.github/workflows/backend-foundation.yml`.

Release is blocked by any sentinel secret leakage, exploitable Critical/High
finding, unsafe CORS/header/debug behavior, missing negative privilege test,
root/writable production runtime, public bucket, OpenAPI drift, or unsigned/
unprovenanced release artifact.

## 9. Run Performance Gates

Start the disposable performance profile, then run:

```powershell
$env:K6_DATABASE_URL='<local disposable performance database URL>'
npm --prefix apps/api run perf:seed:outbox
npm --prefix apps/api run perf:explain:outbox
npm --prefix apps/api run test:outbox:performance
npm --prefix apps/api run test:performance
npm --prefix apps/api run test:stress
npm --prefix apps/api run perf:clean:outbox
```

`perf:seed:outbox` truncates `private.outbox_events`; run it only against the
disposable local/CI database. `K6_DATABASE_URL` must never point at production.

Required dataset: one million total outbox rows, mostly published history, a
bounded active unpublished set, delayed retries, and active/expired leases.

Blocking budgets:

| Operation | Budget |
|-----------|--------|
| `/health/live` | constant work; no dependency I/O |
| readiness dependency check | <=1 second each; cache TTL <=5 seconds |
| `/api/v1/meta` | P95 <=250 ms, P99 <=500 ms, compressed body <=50 KB |
| indexed OLTP query | P95 <=50 ms |
| outbox claim | P95 <50 ms at one million rows |
| claim batch | maximum 100 |
| graceful drain | maximum 30 seconds |

Evidence must include P50/P95/P99, query plan and buffers, throughput, backlog
recovery, pool saturation, event-loop lag, CPU, memory, cold start, queue outage,
lease churn, and process restart. Average-only results do not pass.

Generated evidence is retained under `apps/api/test/performance/artifacts/`.

## 10. Verify Migration And Recovery

```powershell
npm --prefix apps/api run migration:checksums
npm --prefix apps/api run test:migration
npm --prefix apps/api run test:database:integration
npm --prefix apps/api run test:foundation:e2e
npm --prefix apps/api run test:outbox:logic
```

Required proof:

1. two migration jobs cannot apply concurrently;
2. changing an applied migration checksum fails before DDL;
3. failed pre-traffic migration leaves the prior image active;
4. a new forward corrective migration restores a passing state;
5. the previous immutable image remains N-1 compatible with the additive schema;
6. disposable backup/restore preserves owned object definitions, grants, and all
   outbox rows;
7. queue outage/restart/replay loses no outbox event and tolerates duplicates;
8. before/after object, privilege, queue, bucket, and outbox counts reconcile.

Production-wide RPO/RTO and disaster-recovery automation remain SPEC-BE-013,
but this foundation cannot pass without the local recovery evidence above.

## 11. Full Release Gate

```powershell
npm --prefix apps/api run verify
git diff --check
git status --short
```

`verify` aggregates the non-live application gates. Database, performance,
container, image, and release-signing gates in sections 3, 7, 9, and 10 remain
separate mandatory commands. Before completion review, confirm:

- AC-001 through AC-014 and SC-001 through SC-007 are all evidenced;
- `spec.md`, `plan.md`, and `tasks.md` are consistent and approved;
- no Mobile/Admin file or mock changed;
- no unowned table/API/RPC/function/trigger/queue/job/event/cache/bucket exists;
- no Redis, BullMQ, Prisma, microservice, Edge Function, or product cache exists;
- alert runbooks exist for readiness, restart loop, migration/checksum failure,
  pool saturation, outbox backlog/age, delivery exhaustion, and security gates;
- after local pre-PR gates pass, the branch is committed and pushed only to Draft
  PRs that list pending remote evidence;
- the PR remains Draft until CI, image scan, SBOM, signature/provenance, review,
  and every remaining acceptance gate pass; it is never auto-merged.

## Troubleshooting Boundaries

- If Supabase startup fails, inspect the pinned CLI/Docker output; do not create
  replacement database containers.
- If a migration differs remotely, stop and reconcile migration history; do not
  edit production schema in Dashboard or run `migration repair` casually.
- If an outbox claim misses the P95 budget, inspect EXPLAIN and table statistics;
  do not add Redis before measurement and ownership approval.
- If `/api/v1/meta` cannot authenticate in production, keep it unavailable until
  SPEC-BE-002 supplies the verifier; do not accept unsigned/unverified JWTs.
- If any security gate fails, preserve evidence and fix forward. Do not waive a
  release blocker through documentation alone.
