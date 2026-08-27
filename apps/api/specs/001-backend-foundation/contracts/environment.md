# Runtime Environment Contract: SPEC-BE-001

**Contract version**: 1.0.0  
**Validation point**: Before API binds a port or worker/migration accepts work

## Rules

- Application-owned variables use the `MASARIFI_` prefix and are strictly
  allowlisted. An unknown `MASARIFI_*` key fails startup.
- Standard operating-system/container variables such as `PATH`, `HOSTNAME`, and
  `HOME` are ignored by application validation.
- Secrets are injected by the runtime secret store. They never receive defaults
  in source, Dockerfile, Compose, migrations, fixtures, or logs.
- Validation errors name only the safe variable name and reason category. They
  never echo the value.
- Numeric values are parsed as base-10 integers and range-checked. Boolean values
  accept only `true` or `false`.
- API and worker do not require future provider secrets. A provider feature may
  become enabled only in its owning Spec, which must make its required values
  fail closed.

## Required Foundation Variables

| Variable | Classification | Processes | Type / allowed values | Default |
|----------|----------------|-----------|-----------------------|---------|
| `NODE_ENV` | safe | all | `development`, `test`, `production` | none in production |
| `MASARIFI_PROCESS_KIND` | safe | all | `api`, `worker`, `migration` | none |
| `MASARIFI_RELEASE_VERSION` | safe | all | nonempty safe token, max 64 | none |
| `DATABASE_URL` | secret | all | PostgreSQL URL with TLS policy appropriate to environment | none |

`DATABASE_URL` is never returned, logged, placed in metrics, or exposed to
clients. Migration and worker credentials must have distinct least-privilege
bindings in production even when local development uses the local CLI database.

## API Variables

| Variable | Classification | Type / allowed values | Default |
|----------|----------------|-----------------------|---------|
| `MASARIFI_HTTP_PORT` | safe | integer 1024..65535 | `3000` outside production |
| `MASARIFI_CORS_ORIGINS` | safe-sensitive topology | comma-separated exact HTTPS origins; localhost HTTP allowed only outside production | none; empty denies browser origins |
| `MASARIFI_HTTP_BODY_LIMIT_BYTES` | safe | integer 1024..1048576 | `262144` |
| `MASARIFI_REQUEST_TIMEOUT_MS` | safe | integer 100..10000 | `10000` |
| `MASARIFI_READINESS_TIMEOUT_MS` | safe | integer 100..1000 | `1000` |
| `MASARIFI_READINESS_CACHE_TTL_MS` | safe | integer 0..5000 | `5000` |
| `MASARIFI_DATABASE_POOL_MAX` | safe | integer 1..50 | `10` |
| `MASARIFI_SHUTDOWN_TIMEOUT_MS` | safe | integer 1000..30000 | `30000` |
| `MASARIFI_META_MIN_MOBILE_VERSION` | safe client output | version token max 32; optional | absent/null |
| `MASARIFI_META_MIN_ADMIN_VERSION` | safe client output | version token max 32; optional | absent/null |

`MASARIFI_META_MIN_*` values are compatibility metadata, not feature flags or
security bypasses. They are omitted/null until an approved version policy exists.

## Worker Variables

| Variable | Classification | Type / allowed values | Default |
|----------|----------------|-----------------------|---------|
| `MASARIFI_WORKER_ID` | safe operational | safe token 1..128; unique per process instance | generated from process identity |
| `MASARIFI_OUTBOX_BATCH_SIZE` | safe | integer 1..100 | `50` |
| `MASARIFI_OUTBOX_LEASE_SECONDS` | safe | integer 1..300 | `30` |
| `MASARIFI_OUTBOX_POLL_MS` | safe | integer 100..10000 | `500` |
| `MASARIFI_OUTBOX_MAX_ATTEMPTS` | safe | integer 1..100 | `10` |
| `MASARIFI_OUTBOX_RETRY_BASE_SECONDS` | safe | integer 1..60 | `1` |
| `MASARIFI_OUTBOX_RETRY_MAX_SECONDS` | safe | integer 1..3600 | `300` |
| `MASARIFI_OUTBOX_RETRY_JITTER_MS` | safe | integer 0..5000 | `1000` |
| `MASARIFI_DATABASE_POOL_MAX` | safe | integer 1..50 | `10` |
| `MASARIFI_SHUTDOWN_TIMEOUT_MS` | safe | integer 1000..30000 | `30000` |

The queue name `platform-events` is an owned constant, not runtime
configuration. Making it configurable would permit publishing to an unreviewed
queue and is unnecessary in this Spec.

## Migration Variables

| Variable | Classification | Type / allowed values | Default |
|----------|----------------|-----------------------|---------|
| `MASARIFI_MIGRATION_CHECKSUM_FILE` | safe | repository-relative path under `supabase/` | `supabase/migration-checksums.sha256` |
| `MASARIFI_MIGRATION_STATEMENT_TIMEOUT_MS` | safe | integer 1000..600000 | `120000` |

The migration advisory-lock key is a fixed documented code constant rather than
runtime configuration. Tests isolate migration concurrency with a disposable
database, not a different lock key.

## Logging And Telemetry Variables

| Variable | Classification | Processes | Type / allowed values | Default |
|----------|----------------|-----------|-----------------------|---------|
| `MASARIFI_LOG_LEVEL` | safe | API/worker/migration | `debug`, `info`, `warn`, `error`; production excludes debug | `info` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | safe-sensitive topology | API/worker/migration | HTTPS URL in production; optional | absent disables export |
| `OTEL_EXPORTER_OTLP_HEADERS` | secret | API/worker/migration | collector authorization headers; optional | absent |
| `OTEL_RESOURCE_ATTRIBUTES` | safe allowlisted metadata | API/worker/migration | only service namespace/version/environment fields | derived values |

OTLP failure does not expose data and does not make readiness pass or fail. Logs
remain on stdout. Raw SQL, HTTP bodies, event payloads, headers, cookies, tokens,
PII, and financial descriptions are never telemetry attributes.

## Reserved Future Provider Names

These names are recognized for secret scanning and future configuration schema
extension but are not required, read, or injected into SPEC-BE-001 containers:

| Owning Spec | Safe configuration names | Secret names |
|-------------|--------------------------|--------------|
| SPEC-BE-002 | `CLERK_JWT_ISSUER`, `CLERK_JWT_AUDIENCE`, `CLERK_JWKS_URL` | `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET` |
| Later Supabase owner-scoped work | `SUPABASE_URL` | `SUPABASE_SERVICE_ROLE_KEY` |
| SPEC-BE-009 | approved OpenRouter model/routing IDs | `OPENROUTER_API_KEY` |
| SPEC-BE-010 | SMTP host/port/sender policy | `SMTP_USERNAME`, `SMTP_PASSWORD` |
| SPEC-BE-012 | Stripe public plan/price IDs | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |

Presence of a future secret in a SPEC-BE-001 API/worker/migration container is a
least-privilege failure unless explicitly required by a later owning release.

## Process Requirement Matrix

| Capability | API | Worker | Migration |
|------------|-----|--------|-----------|
| Bind HTTP port | required | forbidden | forbidden |
| Database connection | readiness and future requests | claim/publish lifecycle | advisory lock/migrations/smoke |
| Queue send/read | readiness check only | required dispatch operations | smoke only |
| Outbox claim | forbidden | required | forbidden |
| Run DDL | forbidden | forbidden | required |
| OTLP export | optional | optional | optional |
| Future provider secret | forbidden in this phase | forbidden in this phase | forbidden |

## Fail-Closed Cases

Startup exits nonzero before accepting work when any of the following occurs:

- required variable missing, blank, malformed, out of bounds, or duplicated with
  conflicting values;
- unknown `MASARIFI_*` key;
- production `NODE_ENV` with localhost/plain-HTTP CORS origin;
- production debug logging;
- API process with no explicit production port policy;
- invalid database URL or database credential outside the process role contract;
- worker backoff maximum below base, lease outside bounds, or batch above 100;
- migration checksum path escaping root `supabase/`;
- live meta authentication configured without all SPEC-BE-002 verifier values;
- a future provider marked enabled by its owning configuration without its
  required secret.

Dependency unavailability after valid startup affects readiness or worker retry;
it never causes the API to reveal the failed value or topology.

## Secret Verification

Implementation and CI must prove:

1. secret-pattern scans cover source, history, migrations, fixtures, OpenAPI,
   Compose, Docker layers, logs, SBOM, and generated artifacts;
2. container inspection shows secrets arrive only at runtime and are not image
   labels, build arguments, files, or command history;
3. log tests inject sentinel secrets into every trust boundary and assert that
   no sentinel appears;
4. Mobile/Admin bundles and environment files remain unchanged in this phase;
5. production failure messages include only safe variable names and stable codes.
