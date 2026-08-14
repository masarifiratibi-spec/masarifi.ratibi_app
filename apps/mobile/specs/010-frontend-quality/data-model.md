# Data Model: Frontend Quality and Delivery

SPEC-010 introduces shared validation concepts and hardens existing domain records. It does not
create a second financial model or require a new application database schema.

## Capability Contract Metadata

Represents one replaceable client capability.

| Field | Meaning | Rules |
|---|---|---|
| `capability` | Stable capability name | Unique within the mobile client |
| `majorVersion` | Breaking-change boundary | Positive integer; change only for incompatible contract change |
| `owner` | Feature/domain that owns the result | Exactly one owner |
| `methods` | Supported queries/commands | Inputs, outputs, failures, side effects documented |
| `providerKinds` | Available provider categories | At least deterministic mock; platform where applicable |
| `unavailableOutcome` | Safe unsupported behavior | Required for platform/external capability |

Relationships: one contract has one or more providers and may be referenced by many validation
cases. Additive fields may retain a major version; a breaking version requires a migration and
compatibility case.

## Capability Provider

| Field | Meaning | Rules |
|---|---|---|
| `id` | Provider identity | Unique per contract/major |
| `contract` | Contract reference | Matching capability and supported major required |
| `kind` | `mock`, `platform`, or future `live` | Current phase uses mock/platform only |
| `availability` | `available` or `unavailable` | Unavailable produces the contract outcome, not false success |
| `scenarioSupport` | Named deterministic outcomes | Mock providers only |

Transition: unavailable → available may occur when permission/platform state changes. Contract
major mismatch prevents selection before a method executes.

## Scenario Profile

| Field | Meaning | Rules |
|---|---|---|
| `id` | Stable scenario name | Unique and human-readable |
| `descriptionKey` | Localized description | Arabic/English parity required |
| `disposableProfileId` | Isolated validation profile | Reset allowed only for this profile |
| `domains` | Fixture builders to compose | Existing validated builders only |
| `clock` | Fixed scenario time | Required for deterministic dates/expiry |
| `expectedStates` | Observable states/routes | At least one per participating domain |
| `density` | `empty`, `typical`, or `dense` | Dense includes documented counts |

Relationships: a scenario references records from multiple existing owners by stable IDs. Reset
deletes only fixture-owned data in the disposable profile, then reseeds through owners. Repeating
reset + seed yields equivalent observable state.

## Authoritative Record Reference

This is metadata used by cross-feature proof, not a replacement record.

| Field | Meaning | Rules |
|---|---|---|
| `kind` | Domain record kind | Allowlisted union |
| `id` | Canonical record ID | Resolves through its owner |
| `owner` | Owning capability | Exactly one |
| `version` | Current optimistic version | Non-negative integer where mutable |
| `source` | Origin of the record | Validated domain source |
| `syncStatus` | Current sync truth | Existing domain status |

## Operation Result

| Field | Meaning | Rules |
|---|---|---|
| `operationId` | Stable request/replay identity | Required for financially effective command |
| `owner` | Capability applying the effect | Exactly one |
| `kind` | Command kind | Allowlisted per owner |
| `status` | `pending`, `succeeded`, or `failed` | Terminal success immutable |
| `expectedVersion` | Version checked before mutation | Required where source is mutable |
| `resultReference` | Safe reference to success result | Required on success |
| `failureCode` | Safe retry/recovery classification | Required on failure; no raw text |
| `createdAt`, `updatedAt` | Lifecycle timestamps | Scenario clock or real clock per environment |

Transitions:

```text
absent -> pending -> succeeded
                  -> failed -> pending (same operationId retry)
succeeded -> succeeded (exact replay only)
```

Concurrent calls for one operation share the in-flight outcome. A failed attempt releases the
in-flight claim for safe retry; a succeeded operation never invokes the owner again.

## Preserved Sync Conflict

| Field | Meaning | Rules |
|---|---|---|
| `id` | Stable conflict ID | Unique |
| `record` | Authoritative record reference | Required |
| `localVersion` | Full validated local candidate | Immutable while unresolved |
| `laterVersion` | Full validated competing candidate | Immutable while unresolved |
| `localEffect`, `laterEffect` | Safe financial-effect summaries | No hidden raw sensitive content |
| `detectedAt` | Detection time | Required |
| `status` | `unresolved` or `resolved` | No auto-resolution |
| `resolution` | Explicit allowed user choice | Null until resolved |
| `operationId` | Resolution operation | Required at resolution |

Transitions: absent → unresolved → resolved. Neither candidate is overwritten before resolution.
Resolution applies once and preserves the conflict audit record. Allowed choices depend on domain;
`keep_both` is offered only where it cannot violate uniqueness or duplicate one financial event.

## Local Pending Record

| Field | Meaning | Rules |
|---|---|---|
| `localId` | Stable local identity | Survives retry/restart |
| `recordKind` | Domain type | Allowlisted |
| `draft` | Validated user input | Preserved on recoverable failure |
| `syncStatus` | `pending`, `failed`, `conflict`, or `synced` | Never inferred early |
| `operationId` | Stable sync operation | Reused on retry |
| `failureCode` | Safe recovery code | No provider/raw error |
| `conflictId` | Preserved conflict reference | Required for conflict status |

Transitions:

```text
pending -> synced
pending -> failed -> pending
pending -> conflict -> pending (after explicit resolution) -> synced
```

## Validation Case

| Field | Meaning | Rules |
|---|---|---|
| `id` | Requirement-proof identity | Unique |
| `requirements` | FR/SC references | At least one |
| `kind` | automated, visual, native, participant, inspection, performance | Allowlisted |
| `environment` | Runtime/device description | Required |
| `procedure` | Command or steps | Reproducible |
| `expected` | Observable expected outcome | Required |
| `actual` | Observed summary | No sensitive content |
| `status` | pass, fail, or blocked | Explicit |
| `evidencePaths` | Retained artifacts | Workspace-relative; optional only when safely unnecessary |
| `executedAt` | Date/time | Required when not blocked |

A blocked case includes the missing prerequisite. Automated results never substitute for a manual,
native, or participant case requiring its own evidence.

## Delivery Gate

| Field | Meaning | Rules |
|---|---|---|
| `id` | Gate name | architecture, behavior, localization, accessibility, privacy, visual, performance, Android, iOS, participant |
| `requiredCases` | Validation case IDs | Non-empty |
| `status` | pass, fail, or blocked | Derived from cases unless exception applies |
| `exceptionId` | Approved exception | Null unless required gate is blocked |

Gate passes only when every required case passes. Any failure fails the gate. A block blocks closure
unless a current exception exists.

## Delivery Exception

| Field | Meaning | Rules |
|---|---|---|
| `id` | Exception identity | Unique |
| `gateId` | Blocked required gate | Exactly one |
| `approvedBy` | Product-owner identity/reference | Required |
| `risk` | Concrete unproven behavior and impact | Required |
| `owner` | Accountable follow-up owner | Required |
| `expiresAt` | Time bound | Future date; no permanent exceptions |
| `requiredEvidence` | Follow-up proof | Required |
| `status` | active, fulfilled, expired, or revoked | Derived/explicit lifecycle |

Only active, unexpired exceptions permit closure with a blocked gate. Exceptions cannot turn a
failed gate into pass.

## Analytics Event Definition

| Field | Meaning | Rules |
|---|---|---|
| `name` | Stable event name | Allowlisted union |
| `allowedKeys` | Permitted categorical/timing fields | Explicit finite set |
| `payload` | Fresh validated values | Deeply immutable after creation |
| `occurredAt` | Event time | Required |

Forbidden fields include financial values, balances, account/transaction identifiers, message or
notification content, voice transcripts, assistant questions/answers, support text, credentials,
and raw errors. Event construction rejects extra fields.

## Existing Storage Mapping

- Authoritative finance/planning/report/tracking/voice records, operations, drafts, and conflicts
  remain in existing domain repositories and SQLite v7 tables.
- Notification/assistant, subscription, and support lifecycle records remain in their existing v7
  repositories.
- Session and protected preferences remain in existing protected storage.
- Capability metadata and scenario manifests are source/test artifacts.
- Validation cases, gates, and exceptions are stored in `validation.md` and evidence files, not in
  the user's application database.

## Scale and Retention

- Dense validation contains at least 1,000 transaction or notification items as applicable.
- Scenario reset is limited to a disposable validation profile.
- Successful operation evidence remains as long as its owning record/history requires replay.
- Validation evidence excludes secrets and protected authored content; unsafe captures are not
  retained.
- Participant results retain anonymous aggregate measures only in the repository.
