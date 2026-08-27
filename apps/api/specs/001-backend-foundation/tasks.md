# Tasks: Backend, Docker & Supabase Foundation

**Phase / Spec**: Phase 01 / SPEC-BE-001  
**Branch**: `codex/backend-spec-be-001`  
**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, and `quickstart.md`  
**Scope**: Only resources in the SPEC-BE-001 ownership register  
**Execution model**: Tasks are intentionally small and explicit for a lower-cost implementation model

Every checklist item is ordered. Run the named verification before marking it
complete. A test-first task may pass by failing for the specifically stated
missing behavior; its paired implementation task must make it pass.

## Phase 1: Baseline And Contract Review

**Goal**: Prove the branch, source documents, ownership, and untouched client
baseline before any implementation file is created.

- [X] T001 Verify `codex/backend-spec-be-001` and base `b1ba259c6fbd0c3b6dc34615c50aae2a69a001a3` against `apps/api/specs/001-backend-foundation/spec.md` using `git branch --show-current` and `git rev-parse HEAD`; stop if either differs
- [X] T002 [P] Compare the 17 owned resources in `apps/api/specs/001-backend-foundation/spec.md` with `plan.md`, `data-model.md`, and `contracts/`; verify every resource appears once and record no ownership discrepancy before continuing
- [X] T003 [P] Inspect `apps/api`, `supabase`, and `docker` against the baseline in `apps/api/specs/001-backend-foundation/spec.md`; verify there is no pre-existing backend implementation that must be preserved or integrated
- [X] T004 [P] Capture the untouched client baseline using `git status --short -- apps/mobile apps/admin-web` and verify the result against `apps/api/specs/001-backend-foundation/quickstart.md`; do not edit either client tree
- [X] T005 [P] Validate relative links and absence of unresolved placeholders in `apps/api/specs/001-backend-foundation/plan.md`, `research.md`, `data-model.md`, `contracts/`, and `quickstart.md` using `rg`; verify the search returns no unresolved `TODO`, `TBD`, or template marker
- [X] T006 Verify the runtime decisions in `apps/api/specs/001-backend-foundation/research.md` still match official Node, NestJS, and Supabase documentation; record any breaking change in `research.md` before package installation
- [X] T007 Review the Constitution gates in `apps/api/.specify/memory/constitution.md` against this task list and verify no task implements another Backend Spec, live provider behavior, Redis, Prisma, BullMQ, an Edge Function, or client cutover

**Gate**: T001-T007 pass with no unresolved ownership, branch, source, or client
conflict.

---

## Phase 2: Blocking Package And Test Foundations

**Goal**: Create the independent NestJS package, strict configuration boundary,
and test harness required by every user story.

- [X] T008 Create `apps/api/.nvmrc` containing the selected Node 24 LTS major; verify `node --version` is Node 24 before dependency installation
- [X] T009 Create the minimal independent NestJS 11 package and baseline scripts in `apps/api/package.json`; verify it has no workspace declaration and contains only dependencies approved by `plan.md`
- [X] T010 Run `npm --prefix apps/api install` to generate `apps/api/package-lock.json`; verify `npm --prefix apps/api ls --all` exits zero and the lockfile contains no unresolved dependency
- [X] T011 [P] Create strict compiler settings and API/worker/migration build entries in `apps/api/tsconfig.json` and `apps/api/tsconfig.build.json`; verify `npm --prefix apps/api run typecheck` reaches source compilation
- [X] T012 [P] Configure the three Nest entry points in `apps/api/nest-cli.json`; verify the config names `main`, `worker`, and `migration` without adding another package
- [X] T013 [P] Configure TypeScript-aware lint and formatting rules in `apps/api/eslint.config.mjs`; verify `npm --prefix apps/api run lint` can load the configuration
- [X] T014 [P] Configure Jest projects for unit, contract, integration, and E2E suites in `apps/api/jest.config.ts`; verify `npm --prefix apps/api exec jest -- --listTests` exits zero
- [X] T015 Create deterministic test environment setup and cleanup in `apps/api/test/setup.ts`; verify it sets `NODE_ENV=test`, never embeds a secret, and closes timers/database handles after suites
- [X] T016 Add failing tests for valid, missing, malformed, out-of-range, unknown `MASARIFI_*`, and redacted configuration in `apps/api/test/unit/config/environment.schema.spec.ts`; verify the targeted Jest command fails only because the schema is not implemented
- [X] T017 Implement the strict Joi environment schema from `contracts/environment.md` in `apps/api/src/platform/config/environment.schema.ts`; verify T016 passes with `npm --prefix apps/api run test:unit -- environment.schema.spec.ts`
- [X] T018 Define parsed immutable configuration types and safe getters in `apps/api/src/platform/config/environment.types.ts` and `apps/api/src/platform/config/platform-config.service.ts`; verify TypeScript rejects access to an undeclared environment key
- [X] T019 Create `apps/api/src/app.module.ts` with only platform configuration registration and no product module; verify `npm --prefix apps/api run typecheck` passes
- [X] T020 Create the API bootstrap shell in `apps/api/src/main.ts` so configuration validation completes before socket binding; verify a missing `DATABASE_URL` exits nonzero without printing its value
- [X] T021 Create the non-HTTP worker bootstrap shell in `apps/api/src/worker.ts`; verify it creates no listener and exits nonzero on invalid worker configuration
- [X] T022 Create the one-off migration bootstrap shell in `apps/api/src/migration.ts`; verify it creates no HTTP listener and exits after its command completes or fails
- [X] T023 Add a compile-only smoke test for all three entry points in `apps/api/test/unit/bootstrap/entrypoints.spec.ts`; verify `npm --prefix apps/api run build` produces API, worker, and migration outputs and no product-domain output
- [X] T172 Run `speckit-analyze` against `apps/api/specs/001-backend-foundation/spec.md`, `plan.md`, and `tasks.md`; record and resolve every critical/high inconsistency before continuing

**Gate**: Package install, typecheck, lint configuration, Jest discovery, strict
configuration tests, and all three entry-point builds pass.

---

## Phase 3: User Story 1 - Start A Reproducible Backend Environment (P1)

**Goal**: Start API and worker from a clean clone against the official local
Supabase stack without duplicating Supabase services.

**Independent test**: Run `npm --prefix apps/api run test:e2e -- local-foundation.e2e-spec.ts`; it must start official Supabase plus API/worker, return healthy liveness/readiness, and prove custom Compose contains no Supabase service.

### Tests

- [X] T024 [P] [US1] Add database connection success, timeout, safe failure, and pool-close tests in `apps/api/test/integration/database/pool.service.spec.ts`; verify the targeted suite fails for the missing pool service
- [X] T025 [P] [US1] Add queue health success, timeout, and safe failure tests in `apps/api/test/integration/health/queue-health.spec.ts`; verify no test expects queue details beyond `up` or `down`
- [X] T026 [P] [US1] Add readiness-cache hit, miss, success expiry, failure expiry, zero-TTL, and five-second maximum tests in `apps/api/test/unit/health/readiness-cache.spec.ts`; verify the targeted suite fails for the missing cache
- [X] T027 [P] [US1] Add `/health/live` and `/health/ready` success/failure/request-ID contract tests in `apps/api/test/contract/health.contract-spec.ts`; verify liveness tests assert zero dependency calls and readiness asserts one-second dependency timeouts

### Implementation

- [X] T028 [US1] Add pinned Supabase CLI start/stop/reset/lint/test scripts using `--workdir ../..` in `apps/api/package.json`; verify `npm --prefix apps/api run supabase:start -- --help` resolves the package-local CLI
- [X] T029 [US1] Initialize only the official local Supabase project in `supabase/config.toml`; verify `npm --prefix apps/api run supabase:start` starts the official stack and no custom Supabase container is introduced
- [X] T030 [US1] Implement bounded PostgreSQL pool creation and shutdown in `apps/api/src/platform/database/pool.service.ts`; verify T024 passes and failure logs contain no URL/host/credential
- [X] T031 [US1] Register the pool once in `apps/api/src/platform/database/database.module.ts`; verify API and worker resolve the same provider contract without opening a pool at module import time
- [X] T032 [US1] Implement the internal `platform-events` queue existence/availability probe in `apps/api/src/platform/health/queue-health.indicator.ts`; verify T025 passes with a one-second maximum timeout
- [X] T033 [US1] Implement the process-local readiness result cache in `apps/api/src/platform/health/readiness-cache.ts`; verify T026 passes and no user/request data enters the cache key or value
- [X] T034 [US1] Implement constant-work liveness and bounded parallel database/queue readiness checks in `apps/api/src/platform/health/health.service.ts`; verify database and queue failures produce safe names only
- [X] T035 [US1] Implement exact `/health/live` and `/health/ready` response DTOs/controllers in `apps/api/src/platform/health/health.controller.ts`; verify T027 passes with no extra response fields or dependency details
- [X] T036 [US1] Wire the database and health modules into `apps/api/src/app.module.ts`; verify application startup performs no migration and readiness fails when either dependency is unavailable
- [X] T037 [P] [US1] Create a secret-free local variable template matching `contracts/environment.md` in `apps/api/.env.example`; verify secret scanning finds no credential-like value
- [X] T038 [P] [US1] Create API/worker-only local orchestration in `docker/local/compose.backend.yml`; verify service names contain no Postgres, Auth, Storage, Studio, Queue, or other duplicate Supabase service
- [X] T039 [P] [US1] Create disposable API/worker test orchestration in `docker/test/compose.backend.yml`; verify it uses isolated test state and cannot point at a production-like database URL
- [X] T040 [US1] Document exact clean-clone install, official Supabase startup, migration, API, worker, health, and shutdown commands in `apps/api/docs/runbooks/local-development.md`; verify every command matches `apps/api/package.json` or a committed Compose file
- [X] T041 [US1] Add the clean-clone startup E2E scenario in `apps/api/test/e2e/local-foundation.e2e-spec.ts`; verify it asserts official Supabase reuse, API/worker startup, liveness, readiness, and safe dependency failure
- [X] T042 [US1] Run the complete US1 path from an empty disposable Supabase state using `apps/api/test/e2e/local-foundation.e2e-spec.ts`; retain command output and verify AC-001 plus the startup portion of AC-003 pass

**Checkpoint**: A new engineer can reproduce the foundation with one documented
workflow, no provider account, and no duplicated Supabase service.

---

## Phase 4: User Story 2 - Operate API And Worker Safely (P1)

**Goal**: Make API and worker state, shutdown, logs, and platform telemetry safe
and truthful.

**Independent test**: Run `npm --prefix apps/api run test:e2e -- graceful-shutdown.e2e-spec.ts`; API and worker must stop new work, fail readiness, drain for at most 30 seconds, and leave active leases retryable.

### Tests

- [X] T043 [P] [US2] Add JSON field, level, correlation, and sentinel-secret redaction tests in `apps/api/test/unit/observability/logger.spec.ts`; verify the targeted suite fails for the missing logger
- [X] T044 [P] [US2] Add optional OTLP success/failure and bounded-attribute tests in `apps/api/test/unit/observability/telemetry.spec.ts`; verify exporter failure is not expected to fail readiness
- [X] T045 [P] [US2] Add `platform.started` and `platform.ready` schema tests in `apps/api/test/unit/observability/platform-events.spec.ts`; verify raw environment/dependency errors are rejected
- [X] T046 [P] [US2] Add idle, active HTTP, active worker lease, and forced 30-second deadline tests in `apps/api/test/unit/bootstrap/graceful-shutdown.spec.ts`; verify the targeted suite fails for the missing coordinator

### Implementation

- [X] T047 [US2] Implement structured stdout JSON logging and central redaction in `apps/api/src/platform/observability/platform-logger.ts`; verify T043 passes and no request/event body is logged by default
- [X] T048 [US2] Implement optional OpenTelemetry OTLP startup/shutdown with bounded resource attributes in `apps/api/src/platform/observability/telemetry.ts`; verify T044 passes with exporter unavailable
- [X] T049 [US2] Define process, HTTP, database, readiness, and shutdown metric names/label allowlists in `apps/api/src/platform/observability/platform-metrics.ts`; verify a unit assertion rejects arbitrary IDs, raw SQL, payloads, or user data as labels
- [X] T050 [US2] Implement versioned safe operational event formatting for `platform.started` and `platform.ready` in `apps/api/src/platform/observability/platform-events.ts`; verify T045 passes
- [X] T051 [US2] Implement one 30-second maximum shutdown coordinator in `apps/api/src/platform/observability/graceful-shutdown.ts`; verify T046 passes and timeout leaves unfinished worker work retryable
- [X] T052 [US2] Wire logger, telemetry, platform-started event, readiness transition, signal handling, and stop-accepting behavior into `apps/api/src/main.ts`; verify startup emits once and readiness fails during drain
- [X] T053 [US2] Wire logger, telemetry, platform-started event, signal handling, and stop-claiming behavior into `apps/api/src/worker.ts`; verify the worker never starts an HTTP listener
- [X] T054 [US2] Add readiness transition and shutdown assertions to `apps/api/test/contract/health.contract-spec.ts`; verify ready becomes `not_ready` before API drain begins
- [X] T055 [US2] Update `apps/api/src/platform/health/health.service.ts` to include shutdown state without adding dependency details; verify T054 passes
- [X] T056 [P] [US2] Add API `SIGTERM` drain/rejection E2E coverage in `apps/api/test/e2e/graceful-shutdown.e2e-spec.ts`; verify active requests finish or receive the documented safe failure within 30 seconds
- [X] T057 [P] [US2] Add worker `SIGTERM` active-lease integration coverage in `apps/api/test/integration/outbox/worker-shutdown.spec.ts`; verify no new claim starts and an unfinished lease becomes recoverable
- [X] T058 [US2] Add process metric and redacted-log integration assertions in `apps/api/test/integration/observability/process-observability.spec.ts`; verify startup/readiness/shutdown fields exist and sentinel secrets do not
- [X] T059 [P] [US2] Document readiness diagnosis, thresholds, mitigation, owner, escalation, and safe recovery in `apps/api/docs/runbooks/readiness-failure.md`; verify it never advises exposing readiness publicly
- [X] T060 [US2] Document logging/telemetry fields, redaction, exporter failure, and platform event handling in `apps/api/docs/runbooks/platform-observability.md`; run all US2 targeted suites and verify AC-003 and AC-011 process evidence passes

**Checkpoint**: Operators can trust process health and shutdown without seeing a
secret or losing leased work.

---

## Phase 5: User Story 3 - Apply Canonical Database Changes (P1)

**Goal**: Make immutable SQL migrations, checksums, locking, privileges,
Storage foundations, and recovery deterministic.

**Independent test**: Run `npm --prefix apps/api run test:migration`; two clean
applications pass, concurrent jobs serialize, checksum tampering fails before
DDL, and owned objects/grants reconcile after backup/restore.

### Tests

- [X] T061 [P] [US3] Add ordered filename, SHA-256, missing file, extra file, and changed applied checksum tests in `apps/api/test/unit/database/migration-checksums.spec.ts`; verify the targeted suite fails for the missing verifier
- [X] T062 [P] [US3] Add advisory-lock acquisition, contention, release-on-error, and safe timeout tests in `apps/api/test/integration/database/migration-lock.spec.ts`; verify only one test job may enter the apply section
- [X] T063 [P] [US3] Add CLI invocation, clean history, schema-ahead, failed apply, and smoke-check tests in `apps/api/test/unit/database/migration-runner.spec.ts`; verify commands never include a secret in output
- [X] T064 [P] [US3] Add failing pgTAP structure assertions for schemas, roles, table columns/checks/indexes, queue, and buckets in `supabase/tests/001_foundation_structure.test.sql`; verify `npm --prefix apps/api run test:db` reports the expected missing objects through the pinned CLI
- [X] T065 [P] [US3] Add failing pgTAP negative/positive privilege assertions for PUBLIC, anon, authenticated, API, worker, and migration roles in `supabase/tests/002_foundation_privileges.test.sql`; verify forbidden access assertions are explicit
- [X] T066 [P] [US3] Add failing pgTAP function owner, signature, fixed-search-path, execute-grant, and bound assertions in `supabase/tests/003_outbox_functions.test.sql`; verify all three owned functions are covered

### Implementation

- [X] T067 [US3] Implement immutable migration discovery and SHA-256 verification in `apps/api/src/platform/database/migration-checksums.ts`; verify T061 passes without adding a custom migration-history table
- [X] T068 [US3] Create `supabase/migration-checksums.sha256` covering every production SQL migration and no test SQL; verify `npm --prefix apps/api run migration:checksums` detects a one-byte temporary tamper
- [X] T069 [US3] Implement advisory lock, applied-history comparison, pinned Supabase CLI execution, safe result codes, and smoke-check orchestration in `apps/api/src/platform/database/migration-runner.ts`; verify T062 and T063 pass
- [X] T070 [US3] Wire only the guarded one-off runner into `apps/api/src/migration.ts`; verify API/worker startup paths contain no import or call that applies DDL
- [X] T071 [US3] Create approved extensions, `private`/`audit` schemas, NOLOGIN privilege roles, and hardened default privileges in `supabase/migrations/20260827000100_foundation_schemas_extensions.sql`; verify no password, login secret, or product table exists
- [X] T072 [US3] Create `private.outbox_events`, exact constraints/indexes/RLS, three owned functions, and logged internal `platform-events` queue in `supabase/migrations/20260827000200_outbox_queue_functions.sql`; verify no public view, domain trigger, or client queue exposure exists
- [X] T073 [US3] Create only the three private bucket records and deny-by-default baseline in `supabase/migrations/20260827000300_private_storage_buckets.sql`; verify there is no client upload/read policy or public bucket
- [X] T074 [US3] Apply final minimum schema/table/function/queue privileges in `supabase/migrations/20260827000400_foundation_grants.sql`; verify PUBLIC, anon, authenticated, and API cannot directly read/write outbox rows
- [X] T075 [US3] Update `supabase/migration-checksums.sha256` with the final four migration hashes; verify a second checksum run is byte-for-byte stable
- [X] T076 [US3] Add exact Supabase reset/lint/pgTAP/migration test scripts to `apps/api/package.json`; verify every script executes from `apps/api` while targeting root `supabase/`
- [X] T077 [US3] Run the pgTAP structure suite in `supabase/tests/001_foundation_structure.test.sql`; fix only owned migration objects and verify all assertions pass
- [X] T078 [US3] Run the pgTAP privilege suite in `supabase/tests/002_foundation_privileges.test.sql`; verify all negative access cases pass and no test uses the service role as proof of client safety
- [X] T079 [US3] Run the pgTAP function suite in `supabase/tests/003_outbox_functions.test.sql`; verify fixed search paths, bounded arguments, ownership, and grants pass
- [X] T080 [US3] Add clean-reset, second-apply, smoke inventory, and no-unmanaged-object E2E coverage in `apps/api/test/e2e/migration-apply.e2e-spec.ts`; verify only the registered schemas/table/functions/queue/buckets are created
- [X] T081 [US3] Add historical-checksum tamper and no-DDL failure coverage in `apps/api/test/e2e/migration-checksum.e2e-spec.ts`; verify the release remains pre-traffic on mismatch
- [X] T082 [US3] Add two-job contention coverage in `apps/api/test/e2e/migration-concurrency.e2e-spec.ts`; verify exactly one job applies and both exit safely
- [X] T083 [US3] Implement compatible migration-range inspection in `apps/api/src/platform/database/schema-compatibility.ts`; verify a schema ahead of the release makes readiness fail safely
- [X] T084 [US3] Add disposable owned-object/outbox backup and restore rehearsal in `apps/api/test/e2e/backup-restore.e2e-spec.ts`; verify object definitions, grants, bucket/queue presence, and row counts reconcile
- [X] T085 [US3] Document failed migration preservation, forward corrective migration, N-1 image rollback, reconciliation, and prohibited production teardown in `apps/api/docs/runbooks/migration-and-recovery.md`; run all US3 suites and verify AC-005, AC-006, and the migration portion of AC-012 pass

**Checkpoint**: A disposable database reaches one deterministic, least-privilege
state only through immutable SQL, and failure/restore evidence is reproducible.

---

## Phase 6: User Story 4 - Deliver Domain Events Reliably (P1)

**Goal**: Publish transaction-compatible outbox events at least once with
bounded claims, safe retries, no lost rows, and measurable performance.

**Independent test**: Run `npm --prefix apps/api run test:outbox`; concurrent
workers, lease expiry, queue outage, duplicate delivery, terminal exhaustion,
restart, and one-million-row claim performance all pass without row loss.

### Tests

- [X] T086 [P] [US4] Add queued envelope version, field bounds, unknown field, payload size, and sensitive-key tests in `apps/api/test/unit/outbox/event-envelope.spec.ts`; verify invalid envelopes fail before publication
- [X] T087 [P] [US4] Add outbox event/aggregate name, object payload, size, and safe error validation tests in `apps/api/test/unit/outbox/outbox-validation.spec.ts`; verify boundary values 1/64/128/65536 and their first invalid values are covered
- [X] T088 [P] [US4] Add capped exponential backoff, jitter bounds, maximum attempts, and deterministic random-source tests in `apps/api/test/unit/outbox/retry-policy.spec.ts`; verify no delay exceeds configured maximum plus jitter
- [X] T089 [P] [US4] Add parameterized claim/complete/fail SQL contract tests in `apps/api/test/unit/outbox/outbox.repository.spec.ts`; verify stale completion requires both event ID and worker ID and affects zero rows
- [X] T090 [P] [US4] Add queue acceptance, timeout, safe error mapping, and payload redaction tests in `apps/api/test/unit/outbox/queue-publisher.spec.ts`; verify no test exposes `pgmq_public` or a client credential
- [X] T091 [P] [US4] Add happy publication, crash-after-acceptance, retry, terminal exhaustion, and shutdown tests in `apps/api/test/unit/outbox/outbox-dispatcher.spec.ts`; verify source rows are never deleted

### Implementation

- [X] T092 [US4] Implement strict queued envelope construction from an outbox row in `apps/api/src/platform/outbox/event-envelope.ts`; verify T086 passes and `payload` is never logged
- [X] T093 [US4] Implement application-side outbox/event validation matching database constraints in `apps/api/src/platform/outbox/outbox-validation.ts`; verify T087 passes without authorizing a domain mutation
- [X] T094 [US4] Implement capped exponential backoff plus injectable jitter in `apps/api/src/platform/outbox/retry-policy.ts`; verify T088 passes for attempts 1, maximum-1, maximum, and overflow input
- [X] T095 [US4] Implement bounded claim, lease-owner completion, retry scheduling, and terminal-state SQL in `apps/api/src/platform/outbox/outbox.repository.ts`; verify T089 passes and immutable columns are absent from update sets
- [X] T096 [US4] Implement database-only publication to the logged `platform-events` queue in `apps/api/src/platform/outbox/queue-publisher.ts`; verify T090 passes and no Redis/BullMQ/Supabase-JS dependency is added
- [X] T097 [US4] Implement the single dispatcher flow in `apps/api/src/platform/outbox/outbox-dispatcher.ts`; verify T091 happy-path and crash-after-acceptance cases pass with at-least-once semantics
- [X] T098 [US4] Add lease-owner zero-row handling to `apps/api/src/platform/outbox/outbox-dispatcher.ts`; verify the stale worker does not report or overwrite another worker's completion
- [X] T099 [US4] Add retry scheduling, stable error codes, attempt increments, and retained-row handling to `apps/api/src/platform/outbox/outbox-dispatcher.ts`; verify queue exception text never reaches the database or logs
- [X] T100 [US4] Add terminal `outbox.delivery_failed` operational signal and alert call to `apps/api/src/platform/outbox/outbox-dispatcher.ts`; verify the signal contains only the contract fields and does not recurse into the outbox
- [X] T101 [US4] Add `outbox.published` operational signal after queue acceptance plus successful lease completion in `apps/api/src/platform/outbox/outbox-dispatcher.ts`; verify stale/failed completions emit no published signal
- [X] T102 [US4] Implement the bounded poll/claim/dispatch loop and stop-claiming hook in `apps/api/src/platform/outbox/outbox-worker.service.ts`; verify batch size never exceeds 100 and shutdown returns control within 30 seconds
- [X] T103 [US4] Wire only the outbox worker service into `apps/api/src/worker.ts`; verify one process instance uses one worker ID and no API controller is instantiated
- [X] T104 [US4] Add enqueue commit/rollback and exactly-one-row integration tests in `apps/api/test/integration/outbox/enqueue.spec.ts`; verify caller rollback removes the outbox row
- [X] T105 [P] [US4] Add multi-worker disjoint claim and 1/100/101 bound tests in `apps/api/test/integration/outbox/concurrent-claim.spec.ts`; verify 101 is rejected and active leases never overlap
- [X] T106 [P] [US4] Add lease expiry, reassignment, and stale completion tests in `apps/api/test/integration/outbox/lease-recovery.spec.ts`; verify only the current lease owner can complete
- [X] T107 [P] [US4] Add queue outage, slowdown, recovery, restart, and retained terminal failure tests in `apps/api/test/integration/outbox/queue-recovery.spec.ts`; verify every source ID remains queryable
- [X] T108 [P] [US4] Add duplicate-delivery idempotent consumer contract fixture in `apps/api/test/contract/outbox-consumer.contract-spec.ts`; verify the same `eventId` produces one effect or a deterministic no-op
- [X] T109 [US4] Add outbox metric names, bounded labels, and publication/claim/retry observations in `apps/api/src/platform/observability/platform-metrics.ts`; verify depth, oldest age, claim P95 inputs, lease expiry, retry, failure, and throughput are emitted without payload labels
- [X] T110 [US4] Create deterministic one-million-row outbox performance data in `apps/api/test/performance/outbox-seed.sql`; verify total/published/unpublished/leased row counts match documented fixtures
- [X] T111 [US4] Create the required claim `EXPLAIN (ANALYZE, BUFFERS)` runner and budget assertion in `apps/api/test/performance/outbox-explain.sql`; verify it fails when execution P95 is not below 50 ms or the approved index path is absent
- [X] T112 [US4] Add concurrent claim, queue slowdown/outage, backlog recovery, lease churn, memory, and throughput load scenarios in `apps/api/test/performance/outbox-dispatch.k6.js`; verify output records P50/P95/P99 rather than averages only
- [X] T113 [US4] Add package scripts for outbox unit/integration/performance suites in `apps/api/package.json`; verify `npm --prefix apps/api run test:outbox` invokes every US4 test and no unrelated provider suite
- [X] T114 [US4] Document outbox backlog/oldest-age/terminal-failure thresholds, diagnosis, replay, escalation, owner, and closure evidence in `apps/api/docs/runbooks/outbox-delivery-failure.md`; verify no step deletes a failed source row
- [X] T115 [US4] Run `npm --prefix apps/api run test:outbox` and retain the EXPLAIN/load artifacts referenced by `apps/api/docs/runbooks/outbox-delivery-failure.md`; verify AC-007 and AC-008 pass with zero lost rows

**Checkpoint**: Outbox delivery is transaction-compatible, at least once,
bounded, observable, recoverable, and below its measured query budget.

---

## Phase 7: User Story 5 - Produce A Secure Release Artifact (P1)

**Goal**: Build, scan, identify, sign, and run one minimal production image for
API, worker, and migration commands.

**Independent test**: Run `npm --prefix apps/api run test:release-image`; the
same digest must run all three commands as non-root/read-only, expose only the API
port, contain no secret/dev dependency/shell/package manager, pass scans, and
produce SBOM plus provenance.

### Tests

- [X] T116 [P] [US5] Add production image user, filesystem, port, dependency, source, shell/package-manager, and secret assertions in `apps/api/test/container/image-contract.spec.ts`; verify the targeted suite fails before the Dockerfile exists
- [X] T117 [P] [US5] Add same-digest API/worker/migration command and healthcheck assertions in `apps/api/test/container/image-commands.spec.ts`; verify each command has a distinct expected process behavior
- [X] T118 [P] [US5] Add sentinel secret layer/history/environment inspection in `apps/api/test/container/image-secrets.spec.ts`; verify the test detects a deliberately injected disposable sentinel image

### Implementation

- [X] T119 [US5] Create one digest-pinned Node 24 build/test and distroless non-root production image in `docker/backend.Dockerfile`; verify it copies only compiled output and production dependencies
- [X] T120 [US5] Implement the shell-free Node container healthcheck client in `apps/api/src/platform/health/container-healthcheck.ts`; verify it exits zero only for live API and never queries readiness dependencies itself
- [X] T121 [US5] Add deterministic image build and API/worker/migration run scripts to `apps/api/package.json`; verify every command uses `docker/backend.Dockerfile` and the same image tag/digest
- [X] T122 [US5] Define production probe, secret injection, read-only filesystem, writable temp mount, resource limit, pre-traffic migration, and termination requirements in `docker/production/README.md`; verify no credential/example secret value is present
- [X] T123 [US5] Run `apps/api/test/container/image-contract.spec.ts`; fix only `docker/backend.Dockerfile` until non-root/minimal/read-only/port/dependency assertions pass
- [X] T124 [US5] Run `apps/api/test/container/image-commands.spec.ts`; verify API, worker, and migration commands execute from one immutable digest and only API exposes a port
- [X] T125 [US5] Run `apps/api/test/container/image-secrets.spec.ts`; verify no source/runtime sentinel appears in layers, labels, history, files, or process arguments
- [X] T126 [US5] Create the backend CI workflow trigger, concurrency, least-permission defaults, immutable action references, and artifact naming in `.github/workflows/backend-foundation.yml`; verify pull requests cannot publish or deploy
- [X] T127 [US5] Add install, typecheck, lint, unit, contract, integration, E2E, and build jobs to `.github/workflows/backend-foundation.yml`; verify each job uses `apps/api/package-lock.json` with `npm ci`
- [X] T128 [US5] Add official Supabase start/reset/lint/pgTAP/migration plus outbox EXPLAIN/load/stress budget jobs to `.github/workflows/backend-foundation.yml`; verify test SQL is not applied as production migration and any P95/P99/query budget breach blocks release
- [X] T129 [US5] Add secret scanning and sentinel-redaction jobs to `.github/workflows/backend-foundation.yml`; verify any finding blocks downstream release jobs
- [X] T130 [US5] Add SAST and locked-dependency vulnerability scanning to `.github/workflows/backend-foundation.yml`; verify exploitable Critical/High findings are blocking
- [X] T131 [US5] Add CycloneDX SBOM generation and retention to `.github/workflows/backend-foundation.yml`; verify the SBOM identifies the release commit and production dependencies
- [X] T132 [US5] Add image build, Trivy scan, runtime contract tests, and immutable digest capture to `.github/workflows/backend-foundation.yml`; verify an unscanned tag cannot reach signing
- [X] T133 [US5] Add keyless or approved-key Cosign signature and provenance generation/verification to `.github/workflows/backend-foundation.yml`; verify signing runs only on approved release events and never auto-deploys
- [X] T134 [US5] Add an immutable workflow-action reference validator in `apps/api/test/security/workflow-pins.spec.ts`; verify a floating action tag causes failure
- [X] T135 [US5] Add release-gate tests for secret, scan, SBOM, provenance, root, and writable-filesystem failures in `apps/api/test/security/release-gates.spec.ts`; verify every listed finding blocks the release decision
- [X] T136 [US5] Document scanner triage, zero exploitable Critical/High policy, SBOM, signature/provenance verification, rollback, owner, and no-auto-merge rule in `apps/api/docs/runbooks/security-release-gates.md`; verify there is no waiver-by-checkbox path
- [X] T137 [US5] Run `npm --prefix apps/api run test:release-image` plus all locally executable security checks referenced by `.github/workflows/backend-foundation.yml`; verify AC-002 and the local image-scan portion of AC-010 pass, retain the digest/scan evidence, and defer remote SBOM/signature/provenance evidence only to T180

**Checkpoint**: One immutable image is minimal, non-root, scanned, identified,
signed, and blocked from release on any mandatory failure.

---

## Phase 8: User Story 6 - Consume Stable Platform Contracts (P2)

**Goal**: Publish stable request ID, validation, safe error, meta, CORS, headers,
timeouts, and OpenAPI contracts without activating client cutover.

**Independent test**: Run `npm --prefix apps/api run test:contract`; all three
owned endpoints and every safe failure path match `contracts/openapi.yaml`, and
generated OpenAPI drift is zero.

### Tests

- [X] T138 [P] [US6] Add valid, absent, malformed, oversized, and propagated `X-Request-Id` tests in `apps/api/test/unit/http/request-id.spec.ts`; verify output is always bounded to 128 safe characters
- [X] T139 [P] [US6] Add stable error envelope, bounded field errors, and SQL/stack/path/provider/secret sentinel tests in `apps/api/test/unit/http/safe-exception-filter.spec.ts`; verify every sentinel is absent
- [X] T140 [P] [US6] Add content type, body/decompression size, unknown property, mass assignment, and DTO allowlist tests in `apps/api/test/contract/http-validation.contract-spec.ts`; verify rejected inputs return stable codes and request IDs
- [X] T141 [P] [US6] Add hard timeout and aborted-request cleanup tests in `apps/api/test/unit/http/request-timeout.spec.ts`; verify the maximum configured timeout cannot exceed 10 seconds
- [X] T142 [P] [US6] Add exact-origin CORS allow/deny, credentialed wildcard rejection, Helmet, and production Swagger policy tests in `apps/api/test/contract/http-security.contract-spec.ts`; verify no origin substring matching is accepted
- [X] T143 [P] [US6] Add meta `401`, fail-closed `503`, local signed JWT fixture `200`, request ID, UTC time, nullable minimum versions, and response-size tests in `apps/api/test/contract/meta.contract-spec.ts`; verify no test accepts an unsigned token

### Implementation

- [X] T144 [US6] Implement bounded request-ID creation/propagation in `apps/api/src/platform/http/request-id.middleware.ts`; verify T138 passes and request IDs continue into logs/database/outbox context
- [X] T145 [US6] Implement the stable safe error envelope and central exception mapping in `apps/api/src/platform/http/safe-exception.filter.ts`; verify T139 passes and production responses contain no stack or internal topology
- [X] T146 [US6] Configure global DTO transform/whitelist/forbid-unknown behavior and approved JSON content/body limits in `apps/api/src/platform/http/http-validation.ts`; verify T140 passes
- [X] T147 [US6] Implement the bounded interactive request timeout and cleanup interceptor in `apps/api/src/platform/http/request-timeout.interceptor.ts`; verify T141 passes
- [X] T148 [US6] Configure exact CORS allowlist, Helmet headers, production debug/Swagger policy, and global HTTP limits in `apps/api/src/platform/http/http-security.ts`; verify T142 passes
- [X] T149 [US6] Define strict meta success DTO and safe error documentation in `apps/api/src/platform/meta/meta.dto.ts`; verify generated schema has no unknown/additional property
- [X] T150 [US6] Implement API version, UTC server time, and nullable approved minimum-version values in `apps/api/src/platform/meta/meta.service.ts`; verify no database/provider call occurs
- [X] T151 [US6] Implement the fail-closed meta authentication guard contract in `apps/api/src/platform/meta/meta-auth.guard.ts`; verify unsigned/unverified tokens return `401` and missing SPEC-BE-002 verifier returns safe `503`
- [X] T152 [US6] Implement only `GET /api/v1/meta` in `apps/api/src/platform/meta/meta.controller.ts`; verify T143 passes with the local signed fixture and no live Clerk network call
- [X] T153 [US6] Wire all global HTTP controls and the meta controller into `apps/api/src/main.ts` and `apps/api/src/app.module.ts`; verify health bodies remain exact and every response returns `X-Request-Id`
- [X] T154 [US6] Generate OpenAPI from runtime DTO/controller metadata in `apps/api/src/platform/http/openapi.ts`; verify production Swagger UI is disabled/protected while CI generation remains available
- [X] T155 [US6] Add runtime-generated versus approved snapshot comparison in `apps/api/test/contract/openapi-drift.contract-spec.ts`; verify an undocumented route/property/status change fails against `apps/api/specs/001-backend-foundation/contracts/openapi.yaml`
- [X] T156 [US6] Add OpenAPI generation/drift and contract-test jobs to `.github/workflows/backend-foundation.yml`; verify drift blocks image signing/release
- [X] T157 [US6] Add meta/health P95/P99, timeout, concurrency, and compressed-payload scenarios in `apps/api/test/performance/platform-http.k6.js`; verify meta P95 <=250 ms, P99 <=500 ms, and compressed body <=50 KB
- [X] T158 [US6] Add shared HTTP/meta/security/performance scripts to `apps/api/package.json`; verify `npm --prefix apps/api run test:contract` includes health, meta, validation, security, and OpenAPI drift tests
- [X] T159 [US6] Run `npm --prefix apps/api run test:contract` and `npm --prefix apps/api run test:performance:platform`; verify AC-004 and AC-009 pass without changing Mobile/Admin or enabling live Clerk

**Checkpoint**: Later modules can consume one stable platform contract, while
meta authentication remains fail-closed until SPEC-BE-002 and client mocks remain.

---

## Phase 9: Hardening, Recovery, And Acceptance

**Goal**: Assemble fresh release evidence for every requirement and prove the
branch contains only SPEC-BE-001 work.

- [X] T160 Create requirement-to-test/command evidence mapping for FR-001 through FR-041, AC-001 through AC-014, and SC-001 through SC-007 in `apps/api/specs/001-backend-foundation/checklists/acceptance-traceability.md`; verify every row has one owner and one concrete evidence source
- [X] T161 Create OWASP ASVS 5.0 L2/applicable L3, API Security Top 10:2023, Top 10:2025, and MASVS 2.1 traceability in `apps/api/specs/001-backend-foundation/checklists/owasp-traceability.md`; verify every applicable control maps to a test or blocking CI gate
- [X] T162 Add an owned-resource allowlist diff test for tables, schemas, functions, queue, buckets, endpoints, jobs, and event names in `apps/api/test/security/ownership-boundary.spec.ts`; verify a fixture unowned resource causes failure
- [X] T163 Add a client-untouched and forbidden-technology diff test in `apps/api/test/security/scope-boundary.spec.ts`; verify Mobile/Admin edits or Redis/BullMQ/Prisma/Edge Function/product resources cause failure while unrelated `.agents/plugins/` remains untouched
- [X] T164 Complete alert thresholds/windows/severity/owners/runbook links for readiness, restart loop, pool saturation, migration/checksum failure, outbox backlog/age/exhaustion, and security gates in `apps/api/docs/runbooks/platform-alerts.md`; verify every metric defined in `platform-metrics.ts` has bounded labels and an operations decision
- [X] T165 Run `npm --prefix apps/api run typecheck`, `lint`, `test:unit`, `test:contract`, `test:integration`, `test:e2e`, and `build`; record exact fresh results in `apps/api/specs/001-backend-foundation/checklists/acceptance-traceability.md`
- [X] T166 Run `npm --prefix apps/api run db:reset`, `db:lint`, `test:db`, and `test:migration`; record migration checksum, pgTAP, privilege, advisory-lock, and smoke results in `apps/api/specs/001-backend-foundation/checklists/acceptance-traceability.md`
- [X] T167 Run `npm --prefix apps/api run test:outbox`, `test:performance`, and `test:stress`; record one-million-row EXPLAIN plus P50/P95/P99, throughput, CPU, memory, pool, event-loop, and recovery evidence in `apps/api/specs/001-backend-foundation/checklists/acceptance-traceability.md`
- [X] T168 Run `npm --prefix apps/api run test:container` and `test:release-image`; record image digest, UID, ports, read-only filesystem, dependency, health, drain, and same-image-command evidence in `apps/api/specs/001-backend-foundation/checklists/acceptance-traceability.md`
- [X] T169 Run all locally executable secret/SAST/dependency/image/OWASP gates represented by `.github/workflows/backend-foundation.yml`; record zero exploitable Critical/High and no-secret evidence in `apps/api/specs/001-backend-foundation/checklists/acceptance-traceability.md`, with remote SBOM/signature/provenance evidence explicitly deferred to T180
- [X] T170 Rehearse failed migration, forward corrective migration, previous-image rollback, queue outage/replay, worker restart, and disposable backup/restore using `apps/api/docs/runbooks/migration-and-recovery.md`; record reconciled object/grant/bucket/queue/outbox counts in `apps/api/specs/001-backend-foundation/checklists/acceptance-traceability.md`
- [X] T171 Update `apps/api/specs/001-backend-foundation/quickstart.md` only where actual implemented script names differ; verify every documented command executes and remove no security/performance/recovery requirement
- [X] T173 Re-run all commands affected by T172 fixes and update `apps/api/specs/001-backend-foundation/checklists/acceptance-traceability.md`; verify no stale pass result remains
- [X] T174 Add one aggregate `verify` script in `apps/api/package.json` that invokes all required non-destructive local gates in dependency order; verify a deliberately failing child command makes `verify` exit nonzero
- [X] T175 Run `npm --prefix apps/api run verify`, `git diff --check`, and `git status --short`; verify no required session remains running and no unowned/client change appears
- [X] T176 Review every checkbox in `apps/api/specs/001-backend-foundation/checklists/requirements.md` and mark only items supported by fresh evidence; verify no release blocker is waived by prose
- [X] T177 Review every locally executable pre-PR gate in `apps/api/specs/001-backend-foundation/spec.md` against `acceptance-traceability.md`; stop if any local implementation, migration, test, security, performance, observability, rollback/recovery, or acceptance item lacks passing evidence
- [X] T178 Commit only SPEC-BE-001 owned files with a clear message after T177 passes; verify unrelated `.agents/plugins/` is not staged and `git show --stat --oneline HEAD` contains no Mobile/Admin change
- [ ] T179 Push `codex/backend-spec-be-001` without force to `abdullah-zordok/MASREFY_Final` and the explicitly approved `masarifiratibi-spec/masarifi.ratibi_app` mirror; open Draft PRs to `main` per the user's latest instruction, list pending remote gates, and do not merge until T180 and T181 pass
- [ ] T180 Collect both Draft PR CI results plus required image scan, SBOM, signature, and provenance evidence in `apps/api/specs/001-backend-foundation/checklists/acceptance-traceability.md`; fix failures on this branch and rerun affected gates
- [ ] T181 Review the complete Definition of Done after T180; mark PRs ready only when AC-001 through AC-014 and SC-001 through SC-007 pass, and leave merge for explicit approval

---

## Dependencies

### Phase Order

```text
Phase 1 Baseline
  -> Phase 2 Package Foundations
    -> US1 Reproducible Environment
      -> US2 Safe Operations
      -> US3 Canonical Database
        -> US4 Reliable Outbox
    -> US5 Secure Release Artifact (after US2, US3, and US4)
    -> US6 Stable Contracts (after US1 and Phase 2; finish before release signing)
      -> Phase 9 Hardening And Acceptance
```

### Story Dependencies

| Story | Requires | Why |
|-------|----------|-----|
| US1 | Phases 1-2 | Needs package/config/test harness |
| US2 | US1 | Uses health/database/queue foundation and local runtime |
| US3 | US1 | Uses official local Supabase and migration entry shell |
| US4 | US3 and US2 shutdown hooks | Uses canonical outbox SQL/functions/queue and safe worker lifecycle |
| US5 | US2, US3, US4; US6 before signing | Packages and verifies complete runtime/contracts |
| US6 | US1 and Phase 2 | Uses health/bootstrap; otherwise can proceed beside US2/US3 after foundations |
| Final | All stories | Aggregates fresh acceptance evidence |

US6 implementation may run in parallel with US2/US3 after US1, but T156-T159
must complete before the final US5 signing/release run and Phase 9.

## Parallel Execution Examples

Only tasks marked `[P]` are safe to dispatch together after their prerequisites:

- Baseline: T002, T003, T004, and T005 after T001.
- Package config: T011, T012, T013, and T014 after T010.
- US1 tests: T024, T025, T026, and T027 after T023; T037, T038, and T039 after their referenced contracts exist.
- US2 tests: T043, T044, T045, and T046 after US1; T056, T057, and T059 after T051-T055.
- US3 tests: T061-T066 after official local Supabase and Jest are working.
- US4 tests: T086-T091 after US3; T105-T108 after T095-T103.
- US5 tests: T116-T118 after build scripts exist.
- US6 tests: T138-T143 after the shared test harness and US1 health contracts exist.

Do not parallelize tasks that edit `apps/api/package.json`,
`.github/workflows/backend-foundation.yml`, `apps/api/src/main.ts`,
`apps/api/src/worker.ts`, `apps/api/src/app.module.ts`, or the same migration.

## Implementation Strategy

### First Runnable Increment

Complete Phases 1-2 and US1. This yields a reproducible local foundation with
truthful basic health and no product behavior. It is the smallest useful
increment, but it is not a complete SPEC-BE-001 release.

### Incremental Order

1. Establish package/config/test boundaries.
2. Make local Supabase/API/worker startup reproducible.
3. Add safe process lifecycle and observability.
4. Establish canonical migrations and least privilege.
5. Add outbox reliability and performance evidence.
6. Produce and secure the production image/CI chain.
7. Finalize shared HTTP/meta/OpenAPI contracts.
8. Run complete hardening, recovery, acceptance, commit, and push gates.

### Lower-Cost Model Rules

- Read the task's referenced source documents before editing.
- Change only the exact path(s) named by the task unless a compile error proves a
  directly required adjacent change; document that dependency before editing it.
- Run the task's targeted verification immediately, not only at phase end.
- Preserve unrelated tracked/untracked work and never use destructive reset,
  clean, checkout, force-push, or production teardown commands.
- Never replace a failing security, authorization, financial, migration,
  performance, or recovery test with a weaker assertion.
- Do not add an abstraction, dependency, endpoint, table, function, trigger,
  queue, job, event, bucket, cache, or provider not named in this task list.
- Stop on a Constitution/ownership conflict; update approved planning artifacts
  before code rather than guessing.

## Completion Rule

SPEC-BE-001 is complete only after T001-T181 are checked with fresh evidence,
all acceptance/Definition-of-Done gates pass, the dedicated branch is pushed for
review, and no merge has occurred.
