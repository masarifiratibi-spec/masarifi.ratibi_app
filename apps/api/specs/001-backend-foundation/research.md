# Phase 0 Research: SPEC-BE-001 Backend Foundation

**Date**: 2026-08-27  
**Branch**: `codex/backend-spec-be-001`  
**Status**: Complete for planning

## Research Boundary

This research resolves only decisions needed to implement SPEC-BE-001. It does
not select product-domain providers, create live Clerk behavior, add Redis, or
change Mobile/Admin. Current repository contracts, the Backend Constitution,
and the Master Plan remain authoritative.

## Decision 1: Runtime And Framework

**Decision**: Use Node.js 24 LTS, TypeScript strict mode, and NestJS 11. Pin the
exact Node patch image and image digest during implementation, and pin all npm
dependencies through `apps/api/package-lock.json`.

**Rationale**:

- Node.js lists v24 as LTS and recommends Active or Maintenance LTS for
  production applications.
- NestJS 11 is the current stable major line and supports the required modular
  monolith, API/worker entry points, validation, OpenAPI, and shutdown hooks.
- Node 24 satisfies the Supabase CLI requirement of Node 20 or later.

**Alternatives rejected**:

- Node 26 is Current, not LTS, so it is not the production baseline.
- Node 22 is supported LTS but has less remaining support runway than Node 24.
- A non-Nest framework would violate the Master Plan.

**Sources**:

- https://nodejs.org/en/about/previous-releases
- https://github.com/nestjs/nest/releases

## Decision 2: Package And Repository Layout

**Decision**: Keep `apps/api` as an independent npm package. Do not convert the
repository into a root workspace. Use one package and one production build with
separate `api`, `worker`, and `migration` commands.

**Rationale**: Mobile and Admin already use independent package management, the
API is currently empty, and FR-001 explicitly forbids requiring a workspace
conversion. One package avoids duplicated lockfiles and shared-library
scaffolding inside the backend.

**Alternatives rejected**:

- A root npm/pnpm workspace changes unrelated packages and is not required.
- Separate API and worker packages duplicate configuration and build output.
- Microservices violate the Master Plan and add deployment failure modes.

## Decision 3: HTTP Adapter And Shared Request Controls

**Decision**: Use NestJS with the standard Express adapter. Apply one global
request pipeline for request IDs, strict CORS, Helmet headers, JSON content type,
compressed/uncompressed body limits, a 10-second hard request timeout, DTO
allowlisting, unknown-property rejection, and safe error envelopes.

**Rationale**: The latency budgets do not require a second HTTP adapter, while
Express is the default Nest path and minimizes integration code for Swagger,
Terminus, Supertest, and security middleware.

**Alternatives rejected**:

- Fastify is not justified by measured throughput and would add adapter-specific
  behavior before a bottleneck exists.
- Per-controller middleware would duplicate trust-boundary logic.

## Decision 4: Validation And Configuration

**Decision**: Use Nest DTOs with `class-validator` and `class-transformer` for
HTTP contracts. Use `@nestjs/config` with a single Joi schema for runtime
configuration, with `allowUnknown: false` and redacted startup errors.

Configuration is divided into:

- required platform values: process kind, environment, release version, port,
  database URL, queue name, allowed origins, timeout/limit values, OTLP target;
- optional future-provider values: Clerk, OpenRouter, Stripe, and SMTP names,
  rejected from client-visible output and required only by their owning feature;
- secrets: injected at runtime and never accepted through Compose defaults.

**Rationale**: These are established Nest integrations and avoid a custom
validation framework. One schema is the only configuration authority.

**Alternatives rejected**:

- Ad hoc environment reads cannot reliably reject unknown or malformed values.
- Adding a second DTO schema system would duplicate runtime and OpenAPI models.

## Decision 5: PostgreSQL Access And Supabase Workflow

**Decision**: Use the official Supabase CLI as a pinned `apps/api` development
dependency and run it from the repository root where the canonical `supabase/`
directory lives. Use `pg` connection pools for API readiness, migration lock
checks, and worker/outbox operations. Do not add Prisma or Supabase JS in this
Spec.

The canonical workflow is:

1. `npx supabase start` starts the official local stack.
2. Immutable SQL files live under root `supabase/migrations/`.
3. `npx supabase db reset` proves clean replay locally/CI.
4. `npx supabase test db` runs pgTAP from root `supabase/tests/`.
5. `npx supabase db push` is the underlying remote deployment operation, called
   only by the guarded one-off migration job after checksum/order validation.

**Rationale**: Supabase documents that its CLI is project-scoped, its local
stack includes the platform services, and remote changes must flow through SQL
migrations. Direct `pg` access is enough for the three foundation operations.

**Alternatives rejected**:

- Custom Postgres/Auth/Storage containers duplicate the official stack.
- Prisma creates a second schema authority and violates FR-037.
- Supabase JS is not needed until owner-scoped JWT/RLS client behavior exists.

**Sources**:

- https://supabase.com/docs/guides/local-development/cli/getting-started
- https://supabase.com/docs/guides/deployment/database-migrations
- https://supabase.com/docs/guides/database/testing

## Decision 6: Migration Integrity

**Decision**: Keep Supabase's `supabase_migrations.schema_migrations` as the
applied-history authority and add a repository checksum manifest for immutable
SQL files. The `migration.apply` command:

1. validates filename order and SHA-256 checksums;
2. acquires one PostgreSQL advisory lock with a fixed documented key;
3. compares local and applied migration history;
4. invokes the pinned Supabase CLI deployment command;
5. runs schema, privilege, function, bucket, queue, and health smoke checks;
6. emits safe duration/status evidence and exits nonzero on any mismatch.

No custom migration-history table is added because it would duplicate the
platform mechanism. A checksum change to an applied migration fails closed.

**Alternatives rejected**:

- API startup migrations can race across replicas.
- Rewriting historical SQL destroys reproducibility.
- Dashboard changes bypass migration history and are explicitly forbidden by
  Supabase guidance and the Constitution.

## Decision 7: Outbox And Queue Topology

**Decision**: Create one durable, logged Supabase Queue named
`platform-events`. It is internal PostgreSQL infrastructure, not exposed through
`pgmq_public` or the Data API. The worker uses PostgreSQL functions to publish
the versioned event envelope after claiming `private.outbox_events`.

The delivery contract is at least once:

- claim with `FOR UPDATE SKIP LOCKED`, maximum 100;
- publish to `platform-events`;
- mark the row published only after queue acceptance and lease-owner validation;
- on failure increment attempts and schedule bounded exponential backoff with
  jitter;
- on attempt exhaustion retain the row, emit `outbox.delivery_failed`, and alert.

**Rationale**: Supabase Queues is PostgreSQL-native, durable, and based on
`pgmq`. Its default database-only access is the narrowest security boundary.
The outbox remains the recoverable source for publication and consumers remain
idempotent.

**Alternatives rejected**:

- Redis/BullMQ has no measured justification and is forbidden by this Spec.
- An unlogged queue can lose active messages and is inappropriate here.
- Client-exposed queues expand privileges without a valid use case.
- One queue per future domain is speculative and belongs to later owning Specs.

**Sources**:

- https://supabase.com/docs/guides/queues
- https://supabase.com/docs/guides/queues/quickstart
- https://supabase.com/docs/guides/queues/api

## Decision 8: `/api/v1/meta` Authentication Boundary

**Decision**: SPEC-BE-001 owns the route, response DTO, OpenAPI contract, and a
fail-closed authentication guard contract. Its contract tests use locally signed
Clerk-shaped JWT fixtures to prove `401`, `403`, and success behavior without a
live provider. Production registration remains unavailable with safe `503`
until SPEC-BE-002 supplies the approved Clerk verifier and issuer/audience/JWKS
configuration.

**Rationale**: The Master Plan simultaneously assigns the endpoint to
SPEC-BE-001 and live Clerk behavior to SPEC-BE-002. A fail-closed boundary keeps
ownership intact, proves the route contract, and avoids silently moving Clerk
integration into this phase. Clients do not depend on the endpoint before
SPEC-BE-014.

**Alternatives rejected**:

- Accepting an unverified bearer token violates deny-by-default security.
- Implementing live Clerk/JWKS behavior here violates SPEC-BE-002 ownership.
- Making the endpoint public violates the explicit API contract.

**Sequencing note**: The authenticated production success path cannot be
enabled until SPEC-BE-002. This is a documented cross-Spec dependency, not a
reason to weaken authentication in SPEC-BE-001.

## Decision 9: Storage Foundation

**Decision**: SQL migrations create `support-attachments`, `report-exports`, and
`voice-temp` as private buckets. No client insert/select policy and no domain
retention or upload workflow is added. Object paths are server-generated by the
later owning service.

**Rationale**: The buckets are explicitly owned foundations, while validation,
quarantine, retention, and business access belong to Specs 009, 010, and 011.

**Alternatives rejected**:

- Public buckets violate the security baseline.
- Generic authenticated policies would grant access before domain authorization
  exists.

## Decision 10: Container Strategy

**Decision**: Build one multi-stage image:

- build/test stages use the exact pinned Node 24 LTS slim image;
- production uses a digest-pinned distroless Node 24 non-root image;
- compiled output and production dependencies only are copied to runtime;
- `api`, `worker`, and `migration` are commands of the same image;
- a Node-based healthcheck executable avoids requiring a shell;
- the runtime supports a read-only root filesystem and explicit temporary mount;
- termination drains for at most 30 seconds.

Development Compose starts only the API and worker and connects them to the
official Supabase CLI network/endpoints. Testing uses disposable project state.
Production deployment definitions inject secrets at runtime and do not reuse
development Compose settings.

**Rationale**: Distroless provides the requested minimal, non-root, no-shell
runtime. One artifact gives API/worker/migration release parity.

**Alternatives rejected**:

- A full Node runtime image retains package-manager and shell attack surface.
- Separate images can drift and triple scanning/signing work.
- Custom Compose Supabase services duplicate official local infrastructure.

## Decision 11: Observability Without A New API

**Decision**: Emit structured JSON logs to stdout using Nest's structured
logger and centralized redaction. Emit metrics and traces through OpenTelemetry
OTLP when configured. Instrumentation failure is logged safely but does not make
financial data incorrect or expose a new HTTP route. No `/metrics` endpoint is
created because it is not in this Spec's ownership register.

Use bounded attributes only: route template, process kind, release, result code,
dependency name, and event type. Never attach IDs with unbounded cardinality,
raw SQL, payloads, tokens, PII, or financial descriptions to metrics.

**Alternatives rejected**:

- A new metrics endpoint would be an undocumented API resource.
- Raw request/payload logging violates the security requirements.
- Making OTLP availability a readiness dependency creates an avoidable outage.

## Decision 12: Test And Release Toolchain

**Decision**:

- Jest and Supertest for unit, contract, integration, and shutdown tests;
- pgTAP through `npx supabase test db` for database shape and privileges;
- k6 for HTTP/outbox load and stress evidence, run from a version-pinned CI
  container rather than added to runtime dependencies;
- `EXPLAIN (ANALYZE, BUFFERS)` SQL fixtures for the one-million-row outbox plan;
- ESLint, TypeScript, and Prettier checks;
- GitHub Actions security gates using secret scan, SAST, dependency audit,
  CycloneDX SBOM, Trivy image scan, and Cosign signature/provenance verification.

Every tool version is pinned in the lockfile, workflow action SHA, or container
digest. Zero exploitable Critical/High findings is release-blocking.

**Rationale**: This covers the required evidence with common tools and keeps
security/performance tooling outside the production image.

**Alternatives rejected**:

- A second JavaScript test runner adds no coverage.
- Average-only benchmarks do not prove P95/P99 requirements.
- Floating action tags or unpinned scanner images weaken supply-chain evidence.

## Decision 13: Caching

**Decision**: Add no Redis and no product cache. Readiness may keep only one
per-process dependency result for at most five seconds. Its key is the fixed
dependency-set/config revision, its scope is one process, and restart clears it.
Failure and success results both expire within five seconds; the cache cannot
authorize requests or contain user data.

**Rationale**: This is the only cache explicitly allowed by the Spec. It bounds
health-check pressure without risking financial or cross-user staleness.

## Decision 14: No Additional Features

**Decision**: Do not create product tables, domain modules, generic repository
frameworks, a plugin system, feature-flag service, Admin operations API, client
adapters, or speculative queue consumers. Later Specs add their owned behavior
against the platform contracts defined here.

**Rationale**: The ownership register is exhaustive. Extra scaffolding would be
undocumented scope and would violate FR-038.

## Resolved Unknowns

All implementation-affecting unknowns for Phase 0 are resolved. The only
sequenced capability is live Clerk verification for `/api/v1/meta`, explicitly
deferred to SPEC-BE-002 with a fail-closed SPEC-BE-001 boundary. There are no
open `NEEDS CLARIFICATION` items.
