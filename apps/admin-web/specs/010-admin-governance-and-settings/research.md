# Research: Spec 010 Admin Governance, Settings, and Final Integration

## Decision 1 — Use one Phase 9 governance feature boundary

**Decision**: Add one `src/features/governance` boundary with strict contracts,
one repository, one hook module, one team/role view module, and one settings view
module. Keep all sixteen route files thin.

**Rationale**: Admin identity, role governance, permissions, settings, flags,
and maintenance share one privilege boundary, version/conflict model, audit
expectation, and mock state. Two view modules keep the code readable without
creating a subsystem for every route.

**Alternatives considered**:

- Separate `admin-team`, `roles`, `settings`, `flags`, and `maintenance`
  features: rejected because it duplicates repository, handler, mutation, and
  test infrastructure for one phase.
- One component per route: rejected as unnecessary file and prop boilerplate.
- One very large view module: rejected because team/role and settings journeys
  have different interaction density.

## Decision 2 — Reuse the existing foundation search and attention boundary

**Decision**: Extend `features/foundation`, `GlobalSearch`, `AttentionPanel`,
and their existing handlers/fixtures. Do not put duplicate search or attention
services inside governance.

**Rationale**: Both surfaces already live in the approved shell, have typed
repositories, query hooks, permission filtering, keyboard behavior, and tests.
Spec 010 completes their entity and event taxonomies rather than replacing them.

**Alternatives considered**:

- New governance search endpoints/components: rejected because the shell would
  have two sources of truth.
- Search index or fuzzy-search dependency: rejected because deterministic
  fictional records and bounded exact/contains matching meet the specification.

## Decision 3 — Preserve seven session roles and model governance roles separately

**Decision**: Keep `AdminRole` and the development role switcher limited to the
seven established system roles. Model system/custom governance roles by stable
role ID inside Phase 9 contracts and state.

**Rationale**: Custom roles are fictional managed records, not authenticated
session identities. Mixing them into the role switcher would widen the shared
authentication simulation and make prior role tests unstable.

**Alternatives considered**:

- Dynamically extend `AdminRole`: rejected because it makes compile-time route
  policy depend on mutable mock data.
- Prevent custom-role creation: rejected because it is explicitly required.

## Decision 4 — Derive the complete matrix from one permission inventory

**Decision**: Build matrix rows from `PERMISSION_KEYS` plus an exhaustive
`Record<PermissionKey, PermissionDefinitionMetadata>`. Use the existing role
map for the seven immutable system-role columns and Phase 9 state for custom roles.

**Rationale**: Compile-time exhaustiveness and tests can fail when a permission
is missing. Counts, detail groups, and matrix cells then derive from the same data.

**Alternatives considered**:

- Duplicate matrix fixtures: rejected because they drift from route and role policy.
- Infer labels from permission strings: rejected because localized labels,
  sensitivity, action semantics, and owning spec are not encoded in a key.

## Decision 5 — Add a restricted invitation-list read contract

**Decision**: Add `GET /api/v1/admin/admin-invitations` in addition to the
nineteen paths named in the specification. Require both `admin-team.read` and
`admin-team.invite`, return masked summaries only, and expose no detail or action endpoint.

**Rationale**: The UI must inspect newly created Pending invitations and seeded
Accepted, Expired, and Revoked scenarios. Without a read operation, that state
is unreachable. Requiring both permissions prevents the Security Administrator
read-only projection from receiving invitation data.

**Alternatives considered**:

- Mix invitation records into Admin Users: rejected because invitations and
  Admin accounts have different identity and lifecycle semantics.
- Add invitation detail/resend/revoke/accept operations: rejected because the
  clarification explicitly defers them.

## Decision 6 — Use deterministic in-memory state only for mutable mock behavior

**Decision**: Keep immutable sanitized fixtures for reference data and seed one
resettable `phase9-governance-state.ts` for Pending invitations, eligible Admin
changes, custom roles, settings-group versions, flags, and maintenance.

**Rationale**: Mutations must update related list/detail/matrix counts
consistently. One state boundary avoids contradictory fixture copies and
supports deterministic unit and browser tests.

**Alternatives considered**:

- Independent mutable arrays in handlers: rejected because counts and details drift.
- Browser storage: prohibited for sensitive governance/configuration data.
- Real persistence: outside the frontend-only phase.

## Decision 7 — Use fixed session states and safe projections

**Decision**: Use `active | revoked | expired` for fictional Admin session
state. Super Admin projections may receive a fictional stable session reference,
safe device label, broad region, times, risk label, and state. Security
Administrator projections omit mutation inputs and restricted session identifiers.

**Rationale**: Session revocation needs an eligible state and terminal outcomes,
while the privacy boundary forbids tokens, cookies, IPs, fingerprints, and real identifiers.

**Alternatives considered**:

- Boolean active flag: rejected because it cannot distinguish expired from revoked.
- Production session payloads: prohibited and unnecessary.

## Decision 8 — Keep invitation and custom-role lifecycles minimal

**Decision**: Only create Pending invitations. Accepted, Expired, and Revoked
remain read-only seeded states. Custom roles are created Active, may transition
`active ↔ disabled` through the existing update operation, cannot be deleted,
and cannot disable while assigned to an Active Admin. System roles never mutate.

**Rationale**: This exactly implements the clarified scope without inventing
delivery, acceptance, approval, or deletion workflows.

**Alternatives considered**:

- Full invitation lifecycle: explicitly out of scope.
- Role deletion: expressly excluded and unsafe for assigned records.
- Approval queue: clarification defines approval requirements as descriptive metadata only.

## Decision 9 — Bound custom-role inputs explicitly

**Decision**: Custom role keys use 3–64 lowercase ASCII characters beginning
with a letter and continuing with letters, digits, dots, or hyphens. Arabic and
English display names are each 2–80 trimmed Unicode characters; description is
0–500 characters; permissions are unique known assignable keys with at least one entry.

**Rationale**: Stable route/API keys need a narrow canonical form, while names
remain localized and human-readable. Bounds prevent oversized or ambiguous state.

**Alternatives considered**:

- Free-form role keys: rejected because normalization and uniqueness become ambiguous.
- Generated keys only: rejected because the specified editor includes a stable key.

## Decision 10 — Make settings-group saves atomic and explicitly typed

**Decision**: Represent settings updates as a discriminated union keyed by the
path/body group. Send only changed allowlisted fields, validate the entire patch,
and replace the group atomically against one expected version. Zero/false is a
value; omission means unchanged.

**Rationale**: This implements the clarification, prevents partial UI success,
and makes stale conflicts deterministic.

**Alternatives considered**:

- Generic `Record<string, unknown>` settings payload: rejected because it
  weakens validation and permits secret-like/unapproved fields.
- Per-field endpoints: rejected as needless contract and task expansion.

## Decision 11 — Use concrete settings bounds

**Decision**:

- General: platform name 2–80 characters; nonempty unique allowlisted countries,
  currencies, and languages; allowlisted IANA time zone; registration
  `open | invite_only | closed`; maintenance summary read-only.
- Mobile: dotted numeric version with 1–4 integer segments from 0–999;
  minimum ≤ latest; update mode `none | optional | force`; iOS store host
  `apps.apple.com`; Android store host `play.google.com`; feature states boolean.
- Imports: maximum file size 1–100 MB; nonempty subset of approved CSV/PDF/JPEG/
  PNG types; timeout 5–600 seconds; retention 1–365 days; duplicate threshold
  integer 0–100 percent; AI fallback boolean.
- AI: per-feature daily limits integer 0–100,000; unique allowlisted provider
  priority; cost-warning threshold 0–100,000 with at most two decimals; safety
  and fallback states boolean.
- Subscriptions: grace period 0–30 days; retry attempts 0–10; retry interval
  1–168 hours when attempts are nonzero; nonnegative plan limits; trial 0–90
  days; cancellation `immediate | period_end`.
- Security: Admin session 15–1,440 minutes; two-factor requirement boolean;
  password minimum length 8–128; temporary access maximum 15–480 minutes; risk
  thresholds integer 0–100 in strictly increasing low/medium/high/critical order.

**Rationale**: These bounded frontend mock contracts make validation and tests
unambiguous while remaining replaceable by authoritative future backend limits.

**Alternatives considered**:

- Server-supplied unconstrained descriptors only: rejected because offline mock
  validation would remain under-specified.
- Real provider, pricing, password, or risk policy: outside scope and unsafe.

## Decision 12 — Use a fixed feature-flag model

**Decision**: Flag status is `disabled | scheduled | active | ended`; `ended`
is a read-only seeded terminal scenario. Editable flags may move among Disabled,
Scheduled, and Active when schedule and version checks pass. Audience is the
fixed clarified enum; platform is `ios | android | shared`; rollout is integer
0–100; active at 0% is valid.

**Rationale**: The model covers status/start/end display and testable edits
without adding experiments, customer lists, or a rollout engine.

**Alternatives considered**:

- Draft/archived/experiment states: rejected as unrequested lifecycle.
- Custom audience expressions or IDs: explicitly prohibited.

## Decision 13 — Define maintenance cancellation and rescheduling

**Decision**: Support `off → scheduled`, `off → active`, `scheduled → scheduled`
for rescheduling, `scheduled → active`, `scheduled → off` for cancellation, and
`active → off` for ending. Every transition validates current version and
eligibility; immediate activation requires the second mock-only acknowledgement.
Client time never transitions state automatically.

**Rationale**: A scheduled window needs a safe recovery/cancellation path and
the user must be able to correct its time before activation.

**Alternatives considered**:

- No scheduled cancellation: rejected because it strands invalid future state.
- Client-timer activation/end: rejected because the contract is authoritative.
- Active → Scheduled: rejected; ending first keeps consequences explicit.

## Decision 14 — Use body submission keys now and production idempotency later

**Decision**: Follow existing repository patterns with a validated
`submissionKey` in mock mutation bodies and a pending lock keyed by operation
and target. Document the future production mapping to an `Idempotency-Key`
header scoped to actor, operation, target, canonical payload, and bounded TTL.

**Rationale**: This is compatible with existing code and supports deterministic
duplicate tests without claiming distributed idempotency.

**Alternatives considered**:

- New idempotency library/store: unnecessary and outside frontend scope.
- Pending lock alone: insufficient to represent delayed duplicate requests.

## Decision 15 — Preserve structural least-privilege projections

**Decision**: Handlers authorize exact operations and return role-shaped
responses. Security Administrator reads omit invitation data, full email,
assignable-role inputs, mutation actions, and restricted session identifiers.
Search/attention results are filtered before counts and serialization; their
owning permission remains contract metadata for defense-in-depth validation but
is not presented as user content.

**Rationale**: Hiding fields in CSS or components would allow protected values
to reach unauthorized browser code.

**Alternatives considered**:

- One full response with client masking: prohibited by the constitution.
- Treat `allowedActions` as authorization: rejected; it is advisory UI metadata only.

## Decision 16 — Standardize safe conflict and error behavior

**Decision**: Use existing safe response conventions: 400 validation, 401
session, 403 permission, non-enumerating 404, 409 stale/duplicate/invariant
conflict, 429 throttled, and 500/503 safe failure. A 409 may return an authorized
current version and correlation ID, never an unrestricted current resource;
the repository refetches the authorized resource.

**Rationale**: This matches current Admin Web patterns and prevents errors from
becoming a privacy side channel.

**Alternatives considered**:

- 422 validation: rejected because the existing client standardizes on 400.
- Raw exceptions/current object in conflict responses: unsafe.

## Decision 17 — Use minimum required final-integration evidence

**Decision**: Add focused Phase 9 tests and extend existing shared permission,
search, attention, accessibility, performance, visual-preservation, route, and
fixture-boundary suites. Verify all sixteen new routes plus representative and
inventory-driven prior routes rather than duplicating every prior user story.

**Rationale**: Existing Specs 001–009 already own their behavioral suites.
Spec 010 must prove shared-boundary integration and absence of regressions, not
rewrite all prior tests.

**Alternatives considered**:

- Rebuild every prior test in one Phase 9 suite: rejected as slow duplication.
- Manual-only final review: rejected because permission, route, contract, and
  responsive regressions require repeatable evidence.

## Deferred Production Controls

- Real identity, authentication, MFA, step-up authentication, and CSRF protection.
- Backend field-level authorization, separation of duties, assignable-scope
  policy, transactional last-Super-Admin checks, database constraints, and locks.
- Invitation token generation, hashing, delivery, acceptance, expiry, resend,
  revocation, and account provisioning.
- Session enumeration and revocation enforcement.
- Server idempotency storage, canonical payload hashing, rate limits, cache
  control, secure headers, and tamper-evident audit persistence.
- Secret management, provider configuration, feature evaluation, rollout kill
  switch, mobile release enforcement, maintenance break-glass/recovery,
  monitoring, alerting, backup/restore, incident response, and deployment.

No research item remains unresolved.
