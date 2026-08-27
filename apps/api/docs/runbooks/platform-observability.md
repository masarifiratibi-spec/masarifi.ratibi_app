# Platform Observability

API, worker, and migration processes write one JSON object per stdout line.
Allowed correlation fields are context, request ID, event name, stable code,
process kind, release version, and bounded state. Request bodies, event payloads,
headers, cookies, tokens, PII, SQL, and database topology are excluded.

Central redaction replaces credential-bearing keys and strings. OTLP export is
optional; collector startup failure disables export and never changes readiness.
Resource attributes are limited to service name, release version, and deployment
environment.

`platform.started` records process kind/version once after successful startup.
`platform.ready` records bounded readiness transitions. During shutdown,
readiness becomes false before work drains. Investigate exporter failures from
collector health and stdout logs; never add provider credentials to diagnostics.

## Field Contract

Every log has UTC `timestamp`, `level`, and a message capped at 256 characters.
Optional fields are limited to `context`, `requestId`, `eventName`, stable
`code`, `processKind`, release `version`, and bounded `state`. Metric labels are
limited by `platform-metrics.ts`; IDs, raw SQL, payloads, users, and financial
descriptions are forbidden labels.

`platform.started` and `platform.ready` use schema version 1 and the fields in
the approved event contract. Consumers reject unknown schema versions and
unknown fields. Operational events are telemetry only: they never enqueue an
outbox row, authorize a request, mutate financial data, or alter readiness.

## Failure Handling

Platform Operations owns exporter and malformed-event alerts. A collector
failure leaves stdout JSON available and does not fail readiness; alert after
five consecutive export failures or five minutes without telemetry from a live
process. Restore or reroute the collector, then confirm a bounded test event and
normal export latency for ten minutes. If logs contain a suspected secret, stop
distribution, rotate the credential, preserve restricted evidence, and block
release until the redaction regression test passes.
