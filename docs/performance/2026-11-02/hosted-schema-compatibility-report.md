# Hosted schema compatibility — 2 November 2026

**NOT READY for canonical backend/worker cutover.** This is a read-only release gate, separate from the completed Supabase cleanup. Application source `ea30c3a3efa5038b017ac89be69504a2041bcce2` passed Foundation qualification; `d4448bbd00d935b24f7f5aff4a527da0a49f4db2` is its documentation-only continuation. An isolated fresh/upgraded test database does not prove compatibility with the existing hosted schema, and the qualified candidate image is not deployed.

Two bounded catalog queries compared 182 canonical migration files with 174 hosted history rows. All local migration checksums pass. There are 82 exact version/LF-normalized SQL matches, 79 same-version differences consisting only of outer whitespace, six same-version execution-packaging differences, 15 local versions absent from hosted history and seven hosted-only environment/backport records. One additional bounded query retrieved those six stored SQL artifacts for private comparison. These counts classify history evidence, not application defects. No history or schema was changed.

The current runner's ordered-prefix check fails at index 124: local `20261017140043` versus hosted `20261017141513`, producing `MIGRATION_HISTORY_INVALID`. Do not bypass that check, replay the full migration chain, delete hosted-only history or stamp missing versions by name. The three reviewed current changes (`20261101223723`, `20261102070334`, `20261102073431`) match source and remain untouched.

The six privately compared artifacts have identical application SQL cores after isolating their reviewed execution wrappers:

| Version | Difference outside the matching application SQL |
| --- | --- |
| `20260922211640` | Canonical source adds temporary role grant, owner-role switch, reset and grant removal. |
| `20261017085837` | Hosted SQL adds operator membership preflight, temporary grant and restoration verification. |
| `20261017111007` | Hosted SQL adds executor/function/role preflight, temporary grant, restoration and owner/ACL verification. |
| `20261023232159` | Canonical source adds temporary role grant, owner-role switch, reset and grant removal. |
| `20261024110500` | Canonical source adds temporary role grant, owner-role switch, reset and grant removal. |
| `20261028114000` | Canonical source adds temporary role grant, owner-role switch, reset and grant removal. |

The complete SQL bytes still differ. Role setup and operator guards are meaningful provenance; identical application cores do not justify replacing stored statements or claiming current objects are unchanged by later migrations. Raw SQL remains private. A pinned Gitleaks 8.24.3 scan of the hosted/local comparison files found no secrets.

Four other same-name pairs differ only in their timestamp and outer SQL whitespace:

| Canonical version | Hosted version | Name |
| --- | --- | --- |
| `20261017144514` | `20261017145825` | `atomic_obligation_payment_create` |
| `20261020131349` | `20261020131934` | `account_idempotency_erasure_guard` |
| `20261021122922` | `20261021125639` | `manual_transaction_kind_revision` |
| `20261021122923` | `20261021125643` | `voice_capture_account_context` |

These are human-reviewable version-only repair candidates, not automatic repairs. Any later repair must lock the exact history rows under the migration advisory lock; require absent target versions, exact names, one statement entry, unchanged original SQL digests and proven outer-whitespace equivalence; update only versions; and verify affected counts while preserving statement/name bytes. Automatic salary detection has only partial backport evidence and is excluded. Even repairing all four would leave 11 missing canonical versions and three hosted-only records.

Actual catalog checks found three absent helpers, in compatibility-review priority order:

| Signature | Canonical migration |
| --- | --- |
| `private.set_tracking_worker_context(text,uuid,uuid)` | `20261024081800_report_closure_tracking_claim_context.sql` |
| `private.list_due_account_upload_erasure_owners(integer)` | `20261024003511_report_closure_upload_cleanup.sql` |
| `private.reminder_baseline(text)` | `20261020220455_normalize_reminder_cycle_baseline.sql` |

The first two are directly called by current tracking and owner-erasure source. Switching those canonical callers before correcting the hosted schema would fail. The reminder normalization migration additionally replaces two existing functions; creating only its parser does not qualify the complete reminder behavior. Current legacy callers remain running, and none of these absent helpers is established as the cause of every previous incident.

Missing history does not always mean missing capability: the requested-PDF selector's body and checked signature/owner/security/search-path/worker-only grants match canonical source despite its missing history version. That component match does not prove the containing migration ran completely.

Next, compare the 15 missing versions and partial backports with current columns, constraints, function definitions and grants in an isolated current restore. Draft a guarded additive helper migration only after checking its exact prerequisites: tracking session/item lease columns and active-profile assertion; upload-erasure tombstones, deletion requests and profiles; and the reminder parser signature. Require each helper to be absent, retain its intended owner/search path and worker-only execute grants, and restore temporary role memberships exactly.

Test tracking owner derivation from valid leases, wrong/expired leases, inactive owners and transaction-local context isolation. Test bounded upload-owner enumeration without invoking Storage deletion. Test ISO/PostgreSQL timestamp forms and malformed reminder baselines separately from reminder eligibility. Existing financial functions, rename-based wrappers, reference-data policies and already-present components require their own compatibility decisions, not historical replay.

Preserve applied SQL provenance and reconcile history only with an explicit artifact-to-live proof. Then rerun ordered-history validation and owner/lease/privacy/caller tests before canonical cutover. Production writes, deletion replay and provider delivery remain outside the selected acceptance scope.

## Isolated continuation checkpoint

The subsequent [isolated helper proof](isolated-helper-compatibility-report.md) completed the bounded prerequisite/ACL and three-helper behavior slice on the retained historical17.6 clone, including real worker/operator ACLs, leases, owner isolation, parser/selector cases, concurrency and rollback/deadline witnesses. The clone is cleanly stopped with those three additions only. It has171 history rows versus174 on live; full current-live parity is not established. No hosted helper DDL or history repair occurred. The four version-only repair candidates above remain unexecuted and unqualified. Follow the [guarded next step](guarded-hosted-compatibility-next-step.md) before any hosted dispatch; this isolated success does not authorize canonical caller/worker cutover.
