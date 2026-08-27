# Event And Queue Contracts: SPEC-BE-001

**Contract version**: 1.0.0  
**Queue**: `platform-events`  
**Delivery**: At least once

## Contract Boundary

SPEC-BE-001 owns the common queued-event envelope and four operational platform
events. Later Specs own their domain event names and payload schemas. A later
producer must call `private.enqueue_outbox_event` inside the same transaction as
its owned state change and register its schema in that Spec.

## Queued Event Envelope

Every message sent from an outbox row to `platform-events` has this exact shape:

```json
{
  "schemaVersion": 1,
  "eventId": "0198f79d-98f3-7bb4-a820-f43bb4d0e17f",
  "eventType": "namespace.event_name",
  "occurredAt": "2026-08-27T12:00:00.000Z",
  "producer": "masarifi-api",
  "aggregate": {
    "type": "aggregate_type",
    "id": "0198f79d-98f3-7bb4-a820-f43bb4d0e17e"
  },
  "correlationId": "01K3Q4W31E5FZ47XCMQCCN9TJW",
  "attempt": 1,
  "payload": {}
}
```

### Field Rules

| Field | Type | Required | Bounds and meaning |
|-------|------|----------|--------------------|
| `schemaVersion` | integer | yes | exactly `1` for this envelope version |
| `eventId` | UUID string | yes | equals `private.outbox_events.id`; idempotency identity |
| `eventType` | string | yes | 3..128; approved lower-case namespaced event |
| `occurredAt` | ISO 8601 UTC | yes | equals the immutable outbox `created_at` |
| `producer` | string | yes | approved process/service name, 1..64 |
| `aggregate.type` | string | yes | equals outbox `aggregate_type`, 1..64 |
| `aggregate.id` | UUID/null | yes | equals nullable outbox `aggregate_id` |
| `correlationId` | string | yes | 1..128 safe characters; never a token or user secret |
| `attempt` | integer | yes | current publication attempt, >=1 |
| `payload` | JSON object | yes | domain schema plus 64 KiB outbox payload ceiling |

Unknown top-level fields are rejected by strict consumers for major envelope
version 1. Additive payload fields follow each owning domain event's versioning
rules. Breaking envelope changes require a new `schemaVersion` and dual-read
compatibility during migration.

## Sensitive Data Rules

The envelope and payload must not contain:

- authorization/cookie headers, JWTs, API keys, passwords, signing material, or
  database/provider credentials;
- raw provider requests/responses or exception text;
- email, phone, full name, device token, account number, or other PII unless the
  owning event explicitly proves minimum necessity and approved protection;
- free-form financial descriptions or raw financial datasets;
- internal hosts, ports, filesystem paths, SQL, or stack traces.

The dispatcher logs only event ID/type, safe aggregate identifiers when allowed,
attempt, duration, and result code. It never logs `payload`.

## Producer Transaction Rule

```text
authorize and validate domain command
  -> mutate owned domain state
  -> call private.enqueue_outbox_event(...)
  -> commit once
```

If the transaction rolls back, the event row rolls back. Publishing before the
database commit is forbidden. Direct insertion into `private.outbox_events` is
forbidden for clients and domain code.

## Dispatcher State And Retry Contract

1. Claim 1..100 eligible rows using `private.claim_outbox_batch`.
2. Serialize and validate the envelope.
3. Send one message to the logged internal queue.
4. On queue acceptance, update the source row only where event ID and lease owner
   still match; set `published_at`, clear lease/error fields.
5. If the update affects zero rows, treat it as stale lease and do not report
   publication success for that worker.
6. On retryable failure, increment `attempt_count`, store one stable safe code,
   clear the lease, and set `available_at` using capped exponential backoff plus
   jitter.
7. On configured attempt exhaustion, retain the row, emit the operational
   `outbox.delivery_failed` contract, and trigger the owned alert/runbook.

Default planning values:

| Setting | Default | Allowed range |
|---------|---------|---------------|
| batch size | 50 | 1..100 |
| lease | 30 seconds | 1..300 seconds |
| base retry | 1 second | 1..60 seconds |
| max retry | 300 seconds | 1..3600 seconds |
| jitter ceiling | 1000 ms | 0..5000 ms |
| max attempts | 10 | 1..100 |

Backoff calculation:

```text
delay = min(maxRetry, baseRetry * 2^(attempt - 1)) + random(0, jitterCeiling)
```

Tests inject the random source so bounds are deterministic. Queue unavailability
never deletes or marks the source row published.

## Consumer Contract

- Consumer deduplication key is `eventId`.
- A consumer acknowledges/deletes a queue message only after its owned work
  commits.
- Duplicate delivery must produce the same result or a no-op, never a second
  financial mutation.
- Consumers must not rely on global order. Where ordering matters, they use the
  aggregate ID plus an owned version/sequence rule.
- Invalid envelope/payload fails closed, is not executed, and produces a safe
  schema-failure metric/alert under the consumer's owning Spec.
- No consumer can infer authorization from the event. It revalidates any
  privileged operation through its owned deterministic rules.

## Operational Events

These four events are structured operational signals sent to the logging/OTLP
pipeline. They are not inserted back into `private.outbox_events` and are not
published to `platform-events`; doing so would create recursive outbox events.

All operational events share:

```json
{
  "schemaVersion": 1,
  "eventType": "platform.started",
  "observedAt": "2026-08-27T12:00:00.000Z",
  "processKind": "api",
  "releaseVersion": "2026.08.27.1",
  "correlationId": "01K3Q4W31E5FZ47XCMQCCN9TJW",
  "payload": {}
}
```

### `platform.started`

**Producer**: API or worker after configuration validation and before accepting
work.

```json
{
  "startedAt": "2026-08-27T12:00:00.000Z"
}
```

`processKind` is `api` or `worker`. The event contains no environment values.

### `platform.ready`

**Producer**: API or worker only when readiness state changes.

```json
{
  "database": "up",
  "queue": "up"
}
```

Dependency values are only `up` or `down`. Hostnames, errors, ports, connection
strings, and provider details are forbidden.

### `outbox.published`

**Producer**: dispatcher after queue acceptance and successful lease-owner
completion.

```json
{
  "outboxEventId": "0198f79d-98f3-7bb4-a820-f43bb4d0e17f",
  "publishedEventType": "namespace.event_name",
  "aggregateType": "aggregate_type",
  "aggregateId": "0198f79d-98f3-7bb4-a820-f43bb4d0e17e",
  "attemptCount": 1
}
```

`aggregateId` may be null. The source payload is never included.

### `outbox.delivery_failed`

**Producer**: dispatcher after configured attempt exhaustion.

```json
{
  "outboxEventId": "0198f79d-98f3-7bb4-a820-f43bb4d0e17f",
  "failedEventType": "namespace.event_name",
  "attemptCount": 10,
  "errorCode": "QUEUE_PUBLISH_FAILED",
  "runbook": "outbox-delivery-failure"
}
```

`errorCode` is a stable allowlisted code, never exception text. `runbook` is an
internal stable reference, not a secret URL.

## Event Test Matrix

| Test | Required result |
|------|-----------------|
| Valid envelope | accepted and preserves event ID/type/time/aggregate/correlation |
| Unknown top-level field | rejected |
| Payload not object or >64 KiB | rejected before enqueue/publication |
| Forbidden sensitive key/value fixture | rejected or redacted according to schema |
| Queue accepts then worker crashes | duplicate may occur; same event ID retained |
| Queue outage | source remains unpublished and becomes retryable |
| Lease reassigned before completion | stale worker updates zero rows |
| Maximum attempts | source retained; one safe operational failure signal/alert |
| Duplicate consumer delivery | one owned effect or deterministic no-op |
| Shutdown with active lease | no new claim; unfinished row recovers after lease |
