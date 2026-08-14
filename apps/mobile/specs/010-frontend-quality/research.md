# Phase 0 Research: Frontend Quality and Delivery

## Decision 1: Harden the existing architecture in place

**Decision**: Inventory the current domain, contract, provider, repository, Query, Zustand, route,
and platform boundaries; fix violations at their owning seam and add only an aggregate boundary
check.

**Rationale**: SPEC-001 through SPEC-009 already implement feature-based ownership and eight
boundary scripts. Moving working code or adding a generic framework would increase risk without
adding user value.

**Alternatives considered**: A service registry, dependency-injection container, event bus, or
repository base class. Rejected because there is no second architectural model to reconcile and
the existing typed imports are simpler and statically verifiable.

## Decision 2: Version contracts with minimal metadata

**Decision**: Keep each client contract beside its consumers and expose an explicit major version
where provider replacement occurs. Accept backward-compatible additive output fields within the
major; require a new major, migration note, compatibility fixture, and deliberate provider choice
for breaking changes.

**Rationale**: This makes the clarification enforceable without runtime negotiation or a central
registry. Client and provider ship together in the current frontend phase.

**Alternatives considered**: Semantic versions on every function or network-style content
negotiation. Rejected as unused complexity before a remote API exists.

## Decision 3: Keep idempotency with the owning mutation

**Decision**: Every financial mutation reuses a stable operation ID, stores or reconstructs its
successful outcome with the owning service/repository, replays that success unchanged, and evicts
failed in-flight attempts so the same operation may retry safely.

**Rationale**: Existing finance, planning, reports, notifications, assistant, subscription, and
support services already use operation IDs. Owner-local enforcement is the smallest way to keep
domain state and replay atomic.

**Alternatives considered**: A global operation table/coordinator. Rejected because it would cross
ownership boundaries, require migration, and still need owner-specific transaction handling.

## Decision 4: Preserve both conflict versions; never auto-merge money

**Decision**: Conflict records keep local and later versions plus source, version, time, and a safe
effect summary. The user explicitly selects an allowed resolution; unresolved state is immutable
except for replacement by a newer explicitly detected conflict.

**Rationale**: Automatic merging can create or remove a financial effect that the user never
approved. Existing conflict flows already support explicit resolution and can be hardened.

**Alternatives considered**: Last-write-wins and field-level automatic merge. Rejected because
both can silently overwrite financially meaningful values.

## Decision 5: Compose one scenario manifest from existing fixtures

**Decision**: Add a typed manifest that names and composes current feature fixture builders. Reset
is available only for an explicitly disposable development/test profile and reseeds through
existing owners.

**Rationale**: Most required records already exist in `src/test-utils`. A manifest makes the full
matrix discoverable and repeatable without creating a second fixture catalog or scenario database.

**Alternatives considered**: Duplicate JSON snapshots and a production scenario service. Rejected
because snapshots drift from domain validation and a production selector could endanger user data.

## Decision 6: Retain SQLite v7 and current state ownership

**Decision**: Use existing SQLite v7 tables for authoritative records, conflicts, and operations;
SecureStore-backed storage for sensitive small preferences/session values; Query for service data;
and Zustand only for shell, preference, draft, recording, and other local UI state. No SPEC-010
migration is planned.

**Rationale**: The existing schema already represents all feature records needed by the quality
requirements. Delivery evidence and contract metadata are build-time documents/code, not user data.

**Alternatives considered**: Schema v8 for validation results/scenarios or a new global store.
Rejected because neither belongs to the shipped user's financial database.

## Decision 7: Aggregate, do not replace, quality gates

**Decision**: One frontend-quality boundary script invokes or shares the results of existing
feature boundaries and adds cross-feature checks for contract ownership, sensitive output,
unsupported claims, and required configuration.

**Rationale**: Current gates have focused ownership and should remain independently useful. An
aggregate command gives delivery one entry point while preserving actionable failures.

**Alternatives considered**: Merge all scripts into one checker. Rejected because it creates a
large unrelated ruleset and discards proven feature-local tests.

## Decision 8: Treat evidence as a versioned delivery ledger

**Decision**: Store non-sensitive validation summaries in `specs/010-frontend-quality/validation.md`
and native artifacts under an evidence directory. Every row records date, environment/device,
scenario, expected/actual result, evidence path, and pass/fail/blocked status. Exceptions add
product owner, risk, expiry, and follow-up proof.

**Rationale**: Evidence is review data, not runtime application state. A simple document is
auditable, diffable, and sufficient.

**Alternatives considered**: A validation dashboard or database. Rejected because there is no
operational service or multi-user workflow requiring it.

## Decision 9: Reuse present accessibility and visual validation seams

**Decision**: Extend existing accessibility tests, validation routes, localization parity checks,
semantic components, and native development-build runs. Use a minimum 12-person bilingual study,
with four regular screen-reader users and both languages represented, only for outcomes that need
human measurement.

**Rationale**: Automation can prove labels, structure, sizing, and catalog parity but cannot prove
spoken usability or trust ratings. The clarified sample supplies that missing evidence.

**Alternatives considered**: Infer participant percentages from automated checks. Rejected by the
spec. Adding a new screenshot/accessibility framework is also rejected until existing routes and
native tools demonstrably cannot produce the evidence.

## Decision 10: Measure user-visible performance with deterministic dense data

**Decision**: Warm once, then measure useful shell/list content, mounted rows, stable pagination,
and navigation while optional requests are delayed. Reuse the existing 1,000-record fixtures and
document hardware/runtime.

**Rationale**: The success criteria are user-visible and existing virtualized list tests already
provide the smallest stable measurement seam.

**Alternatives considered**: Synthetic micro-benchmarks or a new profiling dependency. Rejected
because they do not prove the acceptance outcomes and add tooling without necessity.

## Decision 11: Privacy is allowlist-first and immutable

**Decision**: Analytics events construct fresh immutable allowlisted payloads. Logs and evidence
omit sensitive values at creation. Source/config scans reject production credentials and direct
production provider connections.

**Rationale**: Redaction after emission or mutation is too late. Existing SPEC-009 analytics
established the correct pattern and can be applied consistently.

**Alternatives considered**: Denylists and log scrubbing. Rejected because new sensitive fields can
bypass them and mutable objects can become unsafe after validation.

## Decision 12: Native platform proof remains honest

**Decision**: Run Android on the available development build and iOS/VoiceOver only on macOS/Xcode.
A missing platform is blocked, not passed. Closure requires all gates or the clarified documented,
time-bounded product-owner exception.

**Rationale**: Simulators and unit tests cannot prove operating-system permission, notification,
background/cold-response, TalkBack, VoiceOver, or platform claim behavior.

**Alternatives considered**: Treat cross-platform automation as native evidence. Rejected because
it would violate the completion and platform-honesty requirements.
