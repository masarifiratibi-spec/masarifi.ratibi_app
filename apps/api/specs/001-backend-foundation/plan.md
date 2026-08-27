# Implementation Plan: Backend, Docker & Supabase Foundation

**Phase / Spec**: Phase 01 / SPEC-BE-001  
**Branch**: `codex/backend-spec-be-001`  
**Base Revision**: `b1ba259c6fbd0c3b6dc34615c50aae2a69a001a3`  
**Date**: 2026-08-27  
**Spec**: [spec.md](./spec.md)  
**Input**: SPEC-BE-001, the Backend Constitution, and `docs/Back end/BACKEND_MASTER_PLAN.md`

## Summary

Build the smallest secure backend platform that every later Masarifi Backend
Spec can extend: one independently managed NestJS package, one immutable image
with API/worker/migration commands, the official local Supabase stack, canonical
SQL migrations and pgTAP tests, private Storage foundations, a durable
PostgreSQL outbox-to-Supabase-Queue bridge, three platform endpoints, shared HTTP
contracts, structured observability, and release-blocking CI controls.

This phase creates no product domain and performs no Mobile/Admin cutover.
PostgreSQL/Supabase remains durable truth. Redis, Prisma, BullMQ, Edge Functions,
microservices, and product caches are deliberately absent.

## Technical Context

**Language / Runtime**: TypeScript strict mode on Node.js 24 LTS; exact patch and
container digest pinned during implementation  
**Framework**: NestJS 11 with the standard Express adapter  
**Primary Dependencies**: Nest core/platform/config/swagger/terminus, Express,
Helmet, Joi, class-validator/class-transformer, `pg`, OpenTelemetry SDK and OTLP
exporters, reflect-metadata, RxJS  
**Storage**: Supabase PostgreSQL, `pgmq` durable queue, and private Supabase
Storage; SQL migrations are the only schema authority  
**Testing**: Jest, Supertest, pgTAP via Supabase CLI, k6, PostgreSQL EXPLAIN,
container runtime checks, and supply-chain scanners  
**Target Platform**: Linux OCI containers; one digest-pinned distroless Node 24
runtime image, orchestrator-managed secrets and health checks  
**Project Type**: NestJS modular monolith with separate API, worker, and
one-off migration entry points  
**Performance Goals**: meta P95 <=250 ms and P99 <=500 ms; compressed meta <=50
KB; indexed OLTP P95 <=50 ms; outbox claim P95 <50 ms at one million rows;
readiness dependency timeout <=1 second; bounded batch <=100  
**Constraints**: deny by default; non-root/read-only runtime; 30-second shutdown;
no direct client outbox/queue/bucket access; no live provider integration; no
client changes; no schema object outside the ownership register  
**Scale / Scope**: one API package, one worker process type, one owned table,
three functions, one internal queue, three private buckets, three endpoints,
two jobs, four event contracts, and production-like one-million-row outbox tests

## Constitution Check

*GATE: Every item passes before Phase 0 and is rechecked after Phase 1.*

- [x] The branch `codex/backend-spec-be-001` is dedicated to SPEC-BE-001 only.
- [x] `spec.md` is complete; this plan is derived from it and `tasks.md` will be
  generated only by the next Spec Kit workflow.
- [x] Every proposed table, function, queue, endpoint, job, event, bucket,
  cache, and business rule appears in the SPEC-BE-001 ownership register.
- [x] The empty API baseline, root Supabase/Docker placeholders, and current
  Mobile/Admin mock boundaries were reviewed.
- [x] Architecture, API, database, Docker, performance, observability,
  migration, rollback/recovery, and testing rules are represented below.
- [x] No financial mutation is owned. The outbox provides atomic event enqueue
  for later domain transactions and assumes at-least-once delivery.
- [x] Deny-by-default authorization, private schemas/buckets, RLS/grants,
  secrets, OWASP traceability, resource limits, and blocking gates are explicit.
- [x] No AI behavior is implemented; OpenRouter remains deferred to SPEC-BE-009.
- [x] Mobile/Admin source and mocks remain unchanged.
- [x] Evidence commands, environments, thresholds, rollback, and recovery
  procedures are defined in this plan and `quickstart.md`.

**Pre-design gate result**: PASS. No Constitution deviation is required.

## Project Structure

### Feature Documentation

```text
apps/api/specs/001-backend-foundation/
|-- spec.md
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   |-- openapi.yaml
|   |-- events.md
|   `-- environment.md
`-- tasks.md                    # generated later by speckit-tasks
```

### Planned API Package

```text
apps/api/
|-- package.json
|-- package-lock.json
|-- nest-cli.json
|-- tsconfig.json
|-- tsconfig.build.json
|-- eslint.config.mjs
|-- src/
|   |-- main.ts                 # API entry point
|   |-- worker.ts               # outbox worker entry point
|   |-- migration.ts            # guarded one-off migration entry point
|   |-- app.module.ts
|   `-- platform/
|       |-- config/
|       |-- database/
|       |-- health/
|       |-- http/
|       |-- meta/
|       |-- observability/
|       `-- outbox/
|-- test/
|   |-- unit/
|   |-- contract/
|   |-- integration/
|   |-- e2e/
|   `-- performance/
`-- docs/runbooks/
```

### Planned Shared Infrastructure

```text
supabase/
|-- config.toml
|-- migrations/
|   |-- 20260827000100_foundation_schemas_extensions.sql
|   |-- 20260827000200_outbox_queue_functions.sql
|   |-- 20260827000300_private_storage_buckets.sql
|   `-- 20260827000400_foundation_grants.sql
|-- tests/
|   |-- 001_foundation_structure.test.sql
|   |-- 002_foundation_privileges.test.sql
|   `-- 003_outbox_behavior.test.sql
`-- migration-checksums.sha256

docker/
|-- backend.Dockerfile
|-- local/compose.backend.yml
|-- test/compose.backend.yml
`-- production/README.md

.github/workflows/backend-foundation.yml
```

**Structure decision**: Reuse the existing independent-package convention and
root Supabase/Docker locations. Keep platform code under one bounded Nest module
tree. Do not introduce shared packages, repository frameworks, or domain module
folders before their owning Specs exist.

## Ownership And Boundaries

### Owned Resources

- Table: `private.outbox_events`.
- Schemas/baseline: `private`, `audit`, public-schema hardening, required
  extensions, and NOLOGIN privilege roles for migration/API/worker boundaries.
- Functions: `private.set_updated_at_and_version`,
  `private.enqueue_outbox_event`, `private.claim_outbox_batch`.
- Queue: durable internal `platform-events` queue and its platform event envelope.
- Buckets: private `support-attachments`, `report-exports`, `voice-temp`.
- Endpoints: `GET /health/live`, `GET /health/ready`, `GET /api/v1/meta`.
- Jobs: `outbox.dispatch`, `migration.apply`.
- Events: `platform.started`, `platform.ready`, `outbox.published`,
  `outbox.delivery_failed`.
- Shared contracts: request ID, error envelope, validation, body/content limits,
  timeouts, CORS, headers, OpenAPI generation/drift, logs, metrics, image, and CI.
- Cache: one process-local readiness result, maximum TTL five seconds.

### Consumed Contracts

- Official Supabase CLI local/deployment workflow.
- Supabase PostgreSQL, Storage, and `pgmq` platform objects.
- Deployment-provided secret store, internal health routing, registry, OTLP
  collector, one-off jobs, and immutable image support.
- A future Clerk JWT verifier supplied by SPEC-BE-002 to activate the production
  success path of `/api/v1/meta`.

### Explicit Exclusions

- No profile, RBAC, reference, account, ledger, sync, planning, import, AI,
  report, notification, support, billing, or operations-governance domain.
- No live Clerk, OpenRouter, Stripe, SMTP, push, or email provider call.
- No durable job-run/incident table, backup scheduler, production DR automation,
  Admin operations API, maintenance mode, or feature-flag service.
- No Mobile/Admin file, mock, adapter, environment, route, or behavior change.

### Client Contract Impact

There is no client cutover. The OpenAPI meta contract is available for future
parity checks, but clients remain on existing mocks through SPEC-BE-014. Only
safe public API URL and Clerk publishable configuration may eventually enter a
client bundle; this phase does not write client configuration.

## Phase 0: Research

[research.md](./research.md) fixes the runtime, framework, package layout,
Supabase workflow, migration integrity, queue topology, storage baseline,
container runtime, observability transport, test toolchain, and cache policy.
It also records the only sequencing issue: SPEC-BE-001 owns `/api/v1/meta`,
while SPEC-BE-002 owns live Clerk verification. The route therefore has a
fail-closed production boundary and local signed-JWT contract tests until
SPEC-BE-002 supplies the verifier.

No `NEEDS CLARIFICATION` item remains.

## Phase 1: Design And Contracts

- [data-model.md](./data-model.md) defines the complete outbox table, functions,
  state transitions, privilege roles, internal queue, and private buckets.
- [contracts/openapi.yaml](./contracts/openapi.yaml) is the approved HTTP
  contract snapshot for the three owned endpoints and shared errors.
- [contracts/events.md](./contracts/events.md) defines versioned event envelopes,
  payloads, delivery, retry, and consumer rules.
- [contracts/environment.md](./contracts/environment.md) defines runtime
  configuration, secret classification, process-specific requirements, and
  fail-closed rules.
- [quickstart.md](./quickstart.md) names the clean-clone, test, container,
  security, performance, migration, and recovery verification procedures that
  must work after implementation.

## Implementation Strategy

### Workstream 1: Package And Build Foundation

Initialize only `apps/api` with npm, Node 24, NestJS 11, strict TypeScript, one
lockfile, API/worker/migration entry points, and deterministic build scripts.
Keep imports within `src/platform` and reject a repository workspace conversion.

Exit condition: all three entry points compile from one package and no product
module or client dependency exists.

### Workstream 2: Configuration And HTTP Boundary

Create one strict environment schema and fail startup on missing, malformed, or
unknown platform keys. Add request-ID propagation, safe JSON errors, DTO
allowlisting, body/content limits, strict CORS, secure headers, request timeout,
and production Swagger policy before route modules.

Implement liveness as constant in-memory state. Implement readiness as bounded
database and queue checks with one-second per-dependency timeouts and a five-second
maximum process-local cache. Implement the meta DTO/controller behind the
fail-closed verifier contract described in research.

Exit condition: contract tests prove all status/error/header/CORS/request-ID
paths and the generated OpenAPI file matches the approved snapshot.

### Workstream 3: Canonical Supabase Foundation

Initialize the root official Supabase project without duplicating its services.
Add immutable ordered migrations for schemas/extensions/roles, outbox and
functions, durable internal queue, private buckets, and final least-privilege
grants. Enable and force RLS on the private outbox with no client policies;
access occurs only through tightly granted security-definer functions with fixed
search paths.

Add a SHA-256 manifest and a one-off migration command that obtains an advisory
lock, verifies history/checksums, applies pending SQL transactionally through
`pg`, records Supabase-compatible history, runs smoke checks, and never runs
from API/worker startup. Keep the pinned Supabase CLI in development/CI only.

Exit condition: clean reset, migration replay, database lint, pgTAP structure,
positive worker behavior, and negative anon/authenticated/API/worker privilege
tests pass.

### Workstream 4: Outbox Worker

Implement bounded claims through `private.claim_outbox_batch`, publish safe
versioned messages to `platform-events`, and complete only with matching lease
ownership. Failures use stable codes, capped exponential backoff plus jitter,
retained rows, metrics, and terminal alert events. Shutdown stops new claims and
leaves unfinished leases retryable within 30 seconds.

Exit condition: commit/rollback, concurrent disjoint claims, stale lease,
duplicate publication, queue outage/recovery, terminal failure, restart, and
graceful shutdown tests show no lost row.

### Workstream 5: Containers And Local Orchestration

Create one multi-stage Dockerfile with pinned builder/runtime digests. Copy only
compiled output and production dependencies to a distroless non-root runtime.
Expose only the API port; run API, worker, and migration commands from the same
image; prove read-only root filesystem operation and Node-based health checks.

Local Compose starts API/worker only and consumes official Supabase CLI
endpoints. Test Compose uses disposable state. Production documentation defines
runtime secrets, immutable tags, resource limits, probes, pre-traffic migration,
termination, and rollback without embedding platform-specific credentials.

Exit condition: build, inspect, scan, API/worker/migration command, health,
resource, and SIGTERM tests pass from the same image.

### Workstream 6: Observability And Operations Evidence

Add structured JSON logging with centralized redaction and OTLP metrics/traces
with bounded labels. Define platform/outbox metrics, thresholds, owners, and
runbooks. Observability exporter failure must not expose data or become an API
authorization/readiness bypass.

Exit condition: test logs contain required correlation fields and no fixture
secrets/payloads; alerts cover readiness, restart loops, migration mismatch,
pool saturation, outbox age/growth, terminal delivery failure, and scan gates.

### Workstream 7: CI And Release Evidence

Create one backend workflow with immutable action references. Run install,
typecheck, lint, unit/contract/integration/E2E, Supabase reset/lint/pgTAP,
OpenAPI drift, SAST, secret/dependency scans, SBOM, image build/scan, non-root
runtime checks, k6/EXPLAIN budgets, and signature/provenance. Keep performance
fixtures and scanners outside the production image.

Exit condition: every AC-001 through AC-014 result has a named artifact and any
exploitable Critical/High finding, secret, privilege regression, contract drift,
or budget breach blocks release.

## Security Design

- Trust boundaries are HTTP input, environment input, PostgreSQL calls,
  migrations, event payloads, queue messages, Storage metadata, container
  runtime, CI inputs/artifacts, and observability export.
- Authorization is deny by default. No bearer token is trusted without a
  verifier, no client role reaches `private`/`audit`/`pgmq`, and no readiness
  state grants application authority.
- Security-definer functions are owned by the migration owner, use fixed
  `search_path`, revoke PUBLIC execute, validate bounded arguments, avoid caller
  dynamic SQL, and expose only required worker/domain operations.
- Secrets are runtime-only and redacted from startup errors, logs, traces,
  OpenAPI, images, Compose, fixtures, source maps, and clients.
- Resource controls cover body/decompression/query/header limits, timeouts,
  queue batch/lease bounds, connection pool bounds, backoff caps, and bounded
  metric labels.
- OWASP evidence maps ASVS 5.0 L2 plus applicable L3, API Security Top 10:2023,
  Top 10:2025, and MASVS 2.1 client-secret boundaries to tests/workflow output.

## Performance And Caching Design

- No Redis, distributed cache, product cache, materialized view, or background
  aggregation is introduced.
- Liveness performs no I/O. Readiness performs parallel bounded checks and may
  cache the complete result in one process for no more than five seconds.
- Meta is a fixed bounded response with no database query. Its auth verifier is
  the only external work after SPEC-BE-002 activation.
- Outbox claim uses the partial unpublished index, deterministic order, batch
  <=100, `FOR UPDATE SKIP LOCKED`, bounded lease, and no N+1 query.
- Tests use one million rows with mostly published history, active leases, and
  an unpublished working set. Evidence stores P50/P95/P99, buffers, rows,
  selected index, CPU/memory, pool saturation, and throughput.
- Performance regressions on meta, health, claim, startup, drain, or backlog
  recovery block release; averages alone do not pass a budget.

## Migration, Rollback, And Recovery Design

- Apply additive migrations in order: foundation, outbox/queue/functions,
  Storage buckets, grants. Test SQL stays outside production migrations.
- Verify immutable SHA-256 checksums before deployment and compare applied
  history. One advisory lock prevents concurrent migration jobs.
- Keep API/worker startup free of DDL and shift traffic only after migration and
  smoke success.
- A failure before traffic keeps the previous image active. Repair schema with a
  new forward migration, rerun pgTAP/smoke, reconcile object/grant/outbox counts,
  then retry.
- Application rollback uses the previous immutable image only when N-1 schema
  compatibility passes. Production teardown and migration rewriting are
  forbidden.
- SPEC-BE-001 proves local/disposable backup and restore of its objects and
  outbox rows as rollback evidence; production-wide RPO/RTO and DR ownership
  remains SPEC-BE-013.

## Evidence Plan

| Gate | Planned evidence | Blocking threshold |
|------|------------------|--------------------|
| Requirements/contracts | `npm run test:contract`, OpenAPI snapshot/drift, ownership diff | Any contract drift or unowned resource |
| Database/RLS | `npx supabase db reset`, `npx supabase db lint --level error`, `npx supabase test db` | Any migration, lint, pgTAP, grant, RLS, or checksum failure |
| Security | SAST, secret/dependency scans, OWASP matrix, container scan/runtime assertions | Any secret or exploitable Critical/High; any missing negative privilege test |
| Performance | k6 endpoint suites and outbox EXPLAIN/load suite | Any stated P95/P99/query/payload/timeout budget breach |
| Containers/operations | image build/inspect/scan, same-image commands, health and SIGTERM tests | Root runtime, dev dependency, writable/unbounded root, secret, probe, or drain failure |
| Rollback/recovery | failed migration, previous-image, forward-fix, queue outage/replay, backup/restore rehearsal | Lost outbox row, incompatible rollback, unreconciled object/grant/count, or missing evidence |

## Post-Design Constitution Check

| Gate | Result | Design evidence |
|------|--------|-----------------|
| Dedicated branch and single Spec | PASS | Branch/base recorded; ownership list is SPEC-BE-001 only |
| Artifact consistency | PASS | Spec, plan, research, model, contracts, and quickstart share one scope; tasks intentionally pending |
| Exact resource ownership | PASS | Ownership section and data model enumerate every object; no extra endpoint/table/job/event |
| Repository/client review | PASS | Empty API and placeholder infrastructure recorded; no client change planned |
| Global architecture and operations | PASS | Seven workstreams plus evidence and recovery designs cover all global gates |
| Financial integrity | PASS | No financial table/mutation; outbox is atomic and at least once for later owners |
| Security and OWASP | PASS | Deny-by-default design, negative tests, secret isolation, and release gates are explicit |
| AI isolation | PASS | No AI scope; OpenRouter deferred to SPEC-BE-009 |
| Client cutover boundary | PASS | Contract-only; clients and mocks remain untouched |
| Named verification and recovery | PASS | Evidence table and quickstart name commands, thresholds, environments, and owners |

**Post-design gate result**: PASS. The plan is ready for `speckit-tasks` after
planning artifact validation. Live Clerk activation remains an explicit
SPEC-BE-002 dependency and cannot be bypassed.

## Complexity Tracking

| Violation | Why Required | Approved By | Follow-up |
|-----------|--------------|-------------|-----------|
| None | N/A | N/A | N/A |
