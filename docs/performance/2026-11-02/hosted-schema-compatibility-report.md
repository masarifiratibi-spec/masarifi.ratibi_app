# Hosted schema compatibility — 2 November 2026

**NOT READY for canonical backend/worker cutover.** This is a read-only release gate, separate from the completed Supabase cleanup. Source candidate `ea30c3a3efa5038b017ac89be69504a2041bcce2` passed Foundation qualification, but an isolated fresh/upgraded test database is not proof that the existing hosted schema has the same capabilities.

Two bounded catalog queries compared 182 canonical migration files with 174 hosted history rows. All local migration checksums pass. There are 82 exact version/SQL matches, 79 same-version differences consisting only of outer whitespace, six still-unclassified text differences, 15 local versions absent from hosted history and seven hosted-only environment/backport records. These counts are metadata classifications, not counts of application defects.

The current runner's ordered-prefix check fails at index 124: local `20261017140043` versus hosted `20261017141513`, producing `MIGRATION_HISTORY_INVALID`. Do not bypass that check, replay the full migration chain, delete hosted-only history or stamp missing versions by name. The three reviewed current changes (`20261101223723`, `20261102070334`, `20261102073431`) match source and remain untouched.

Actual catalog checks also found these missing helpers:

| Signature | Canonical migration |
| --- | --- |
| `private.set_tracking_worker_context(text,uuid,uuid)` | `20261024081800_report_closure_tracking_claim_context.sql` |
| `private.list_due_account_upload_erasure_owners(integer)` | `20261024003511_report_closure_upload_cleanup.sql` |
| `private.reminder_baseline(text)` | `20261020220455_normalize_reminder_cycle_baseline.sql` |

The first two are directly called by current tracking and owner-erasure source. Switching those canonical callers before correcting the hosted schema would fail. The reminder normalization migration additionally replaces two existing functions; creating only its parser does not qualify the complete reminder behavior. Current legacy callers remain running, and none of these absent helpers is established as the cause of every previous incident.

Missing history does not always mean missing capability: the requested-PDF selector's body and checked signature/owner/security/search-path/worker-only grants match canonical source despite its missing history version. That component match does not prove the containing migration ran completely.

Next, compare each unresolved or partially backported change with current columns, constraints, function definitions and grants in an isolated current restore. Prioritize the lease-bound tracking context and late-upload erasure enumeration, testing correct/wrong/expired leases, inactive owners and unrelated-owner rejection. Review reminder timestamp normalization and duplicate-delivery eligibility separately. Preserve applied SQL provenance and reconcile history only with an explicit artifact-to-live proof. Production writes, deletion replay and provider delivery remain outside the selected acceptance scope.
