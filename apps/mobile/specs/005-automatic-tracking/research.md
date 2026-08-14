# Research: Automatic Transaction Capture and Platform-Specific Tracking

## Decision 1: Extend the existing owners instead of creating a second tracking stack

**Decision**: Reuse the current Android permission adapter, AppShellStorage tracking preference
and keyword rules, SQLite database, core-finance transaction model, TanStack Query provider,
localization catalogs, and design-system components. Add one automatic-tracking domain,
repository, and mock service only for behavior not already owned.

**Rationale**: The project already proves permission education, tracking modes, keyword editing,
ledger effects, undo, privacy masking, and platform capability checks. Extending those boundaries
avoids contradictory state and keeps SPEC-003 and SPEC-004 behavior intact.

**Alternatives considered**: A standalone tracking store would duplicate permission, keyword,
and transaction state; a new component or state library has no demonstrated need.

## Decision 2: Use a forward-only SQLite version 3 migration

**Decision**: Add normalized tracking indexes plus JSON payload columns for detected events,
reviews, duplicate candidates, sender rules, obligation-match projections, history, and feedback.
Keep posted financial transactions in the existing finance transaction table.

**Rationale**: The existing database is the durable offline owner and already supports atomic
financial writes. Indexed lifecycle columns keep review, expiry, history, and duplicate queries
fast without prematurely normalizing every mock field.

**Alternatives considered**: AsyncStorage is poor for searchable event history and atomic ledger
effects; a second database or ORM adds dependencies and split ownership.

## Decision 3: Make event identity and processing idempotent

**Decision**: Every mock event carries a stable source fingerprint. Processing the same
fingerprint returns the prior result. A later completion, reversal, refund, or failure carries a
relationship hint and updates or links to the original event when unambiguous.

**Rationale**: Duplicate delivery and lifecycle follow-ups are normal capture cases. Stable
identity prevents double posting and lets later status changes preserve financial history.

**Alternatives considered**: Timestamp-only matching is unstable; always creating a new event
would turn retries and follow-ups into duplicate expenses.

## Decision 4: Centralize the clarified confidence policy

**Decision**: One pure policy returns automatic addition for eligible events at 90% or higher,
review for 60% through 89%, and ignore below 60%. Failure, authentication-code, marketing,
duplicate, amount conflict, rule conflict, and ambiguous obligation/account signals override the
numeric result and prevent silent addition.

**Rationale**: One deterministic decision point makes the product promise testable and prevents
route or fixture code from interpreting confidence differently.

**Alternatives considered**: Per-event thresholds create hidden behavior; UI-only branching
cannot protect every service caller.

## Decision 5: Commit automatic financial effects atomically

**Decision**: The tracking repository records the detection decision and applies the resulting
existing finance transaction in one SQLite transaction. It returns affected query scopes for
targeted invalidation. Clear obligation effects use a replaceable mock port until SPEC-007 owns
the obligation ledger.

**Rationale**: A tracking event must never appear as added while the ledger or related projection
failed. Reusing the ledger schema preserves account and summary calculations.

**Alternatives considered**: Calling independent stores sequentially can leave partial financial
changes; copying transactions into tracking state creates a second source of truth.

## Decision 6: Model review as an explicit lifecycle

**Decision**: A review item moves from pending to resolving and then resolved, ignored, or failed.
Dismissal does not resolve it. Confirmation validates the final amount, currency, type, account,
category, and any obligation relationship before the atomic write.

**Rationale**: Explicit states prevent accidental financial mutation and support retry, offline,
and accessibility feedback without inferring status from screen navigation.

**Alternatives considered**: A boolean `reviewed` cannot represent pending mutation, ignored
items, or recoverable failure.

## Decision 7: Merge duplicates into the existing canonical record

**Decision**: Merge keeps the existing transaction identity and adds only confirmed missing
merchant, category, account hint, reference, or source metadata. Amount, currency, date, and
account require a separate edit confirmation. The new candidate becomes a resolved duplicate.

**Rationale**: This follows the clarification, preserves audit continuity, and avoids balance
changes hidden inside a metadata merge.

**Alternatives considered**: Replacing the existing record can silently change financial facts;
deleting both and creating a third record loses provenance.

## Decision 8: Keep source text local, masked, and short-lived

**Decision**: Full mock source text may be stored only in the app-private database, is hidden by
default when privacy masking applies, never enters logs or analytics, can be deleted immediately
through clear history, and is purged no later than 30 days after detection. Extracted fields,
source type, fingerprint, and non-sensitive reasons may remain.

**Rationale**: This preserves a useful correction window while minimizing sensitive retention and
meeting the clarified privacy rule without adding an encryption dependency solely for mock data.

**Alternatives considered**: Permanent raw-message retention expands privacy risk; SecureStore is
not appropriate for searchable message history; never retaining source text weakens review and
incorrect-detection reporting.

## Decision 9: Reuse permission state and add a separate mock service condition

**Decision**: Keep SPEC-003 permission states unchanged. Tracking status composes permission with
mode and a mock service condition: healthy, interrupted, battery restricted, offline, or
unavailable. Permission transitions remain owned by the platform adapter.

**Rationale**: Permission and service health have different causes and recovery actions. Reusing
permission vocabulary preserves tested onboarding behavior.

**Alternatives considered**: Expanding permission status with battery and service failures mixes
unrelated concepts and risks breaking existing route logic.

## Decision 10: Use mock notification outcomes without a new notification dependency

**Decision**: Automatic additions create persisted in-app feedback and call a typed mock phone-
notification boundary. The mock records delivered, suppressed-by-privacy, disabled, and failed
outcomes. Production push/local delivery remains owned by SPEC-009.

**Rationale**: SPEC-005 must demonstrate user feedback, but the current package has no notification
dependency and the master explicitly excludes production notification infrastructure in this
frontend phase.

**Alternatives considered**: Adding Expo Notifications now would expand native configuration and
overlap SPEC-009; showing only a toast would not demonstrate phone-notification states.

## Decision 11: Keep persisted reads in TanStack Query and UI drafts transient

**Decision**: TanStack Query owns tracking status, event pages, review items, sender rules, and
service mutations. Zustand, if needed, stores only unsaved filters and current selection; it never
mirrors detections, transactions, permissions, or rules.

**Rationale**: This matches the existing project state split and the constitution's one-owner rule.

**Alternatives considered**: Mirroring database records in Zustand creates invalidation and
hydration races; route-local fetching duplicates loading and recovery behavior.

## Decision 12: Enforce iOS honesty at capability and route boundaries

**Decision**: Platform capability resolution hides Android-only tracking, keyword, sender,
permission, and service routes on iOS. iOS exposes existing manual and voice entry plus optional
platform-assisted setup only when the adapter reports support.

**Rationale**: Hiding a button is insufficient if a direct route can still render unsupported SMS
claims. One capability guard covers navigation and deep links.

**Alternatives considered**: Shared SMS screens with altered copy remain misleading; duplicated
iOS screens drift from the shared capture experience.

## Decision 13: Prove pure financial rules before native platform behavior

**Decision**: Unit-test confidence, eligibility, identity, lifecycle, merge, retention, and money
effects; component-test routes and states; integration-test automatic add/review/undo flows; then
validate actual Android permission/settings and platform lifecycle in a development build. Record
iOS native verification as blocked on Windows until a macOS/Xcode host is available.

**Rationale**: Deterministic tests cover the high-risk financial logic quickly, while native checks
remain necessary for operating-system behavior that Jest cannot prove.

**Alternatives considered**: Native-only testing is slow and incomplete; Jest-only testing cannot
prove permission prompts, settings recovery, background behavior, or actual RTL/accessibility.
