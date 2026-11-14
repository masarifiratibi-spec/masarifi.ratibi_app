# Owner Payload Erasure Implementation Plan

> **For agentic workers:** Execute inline; the user authorized autonomous implementation and no commits.

**Goal:** Remove the confirmed owner's stored payload while preserving other owners, shared references, deletion evidence and technical retry fences.

**Architecture:** A supplement service prepares owner-specific AI cleanup before existing domain handlers and erases remaining finance, planning, reports, sync and local identity data before Clerk deletion. Request-bound SECURITY DEFINER functions keep privilege inside migration-owned functions; an ungrantable transaction context permits narrowly scoped immutable-row deletion.

**Tech Stack:** NestJS, PostgreSQL, existing report/export storage adapters, Jest.

**Spec:** Parent task instructions and `2026-10-16-account-deletion.md` with the latest immediate/full-payload requirement superseding cooling/retention behavior for new requests.

## Global Constraints

- New source, additive migration and focused local tests only; no hosted actions or commits.
- No broad DELETE grants, trigger disabling, GUC-only authorization, cross-owner deletion or shared reference changes.
- Freeze the exact processing owner under FOR UPDATE; API active-profile checks hold FOR SHARE until transaction completion.
- Keep profile subject/deletion timestamp, immutable deletion evidence, active holds and upload capability tombstones.
- Storage failure and active work block completion; retries remain idempotent.

## Review Focus

- Forged custom settings or mismatched requests cannot authorize immutable-row deletion.
- Foreign-owner financial references fail atomically instead of cascading across owners.
- Report uploads are drained with their existing advisory lock before object deletion.
- Populated financial history, replacement chains and feedback can be erased without bypassing normal immutability.
- Other owners and global categories/rules remain identical; active holds prevent erasure.

### Task 1: Supplement service and storage ordering

**Files:** `apps/api/src/security/owner-data-erasure.service.ts`, focused unit test.

- [x] Write and run failing tests for report/export/Support object deletion preceding database erasure, rollback on storage failure and counted outcome.
- [x] Implement `prepare(evidence): Promise<void>` and `erase(evidence): Promise<DeletionOutcome>` with worker transactions.
- [x] Verify focused unit tests and typecheck with execution-agent integration.

### Task 2: Privileged owner erasure

**Files:** one new migration, focused local SQL integration test.

- [x] Add local-only test proving functions absent before migration, then apply migration inside an owned local database.
- [x] Implement frozen processing-request validation, transaction context and narrow immutable delete guards.
- [x] Implement prepare, object enumeration/locks and remaining dependency-ordered erasure with residual checks.
- [x] Verify request mismatch, forged GUC, rollback, holds, replacement history, shared data, replay and transaction context cleanup.
- [x] Provide migration filename/checksum and integration hooks to parent. No commit.

### Task 3: Late-upload and webhook fences

- [x] Capture exact owner Support object paths before domain cleanup, remove their current objects before completion and retain only request/owner/path/expiry/lease technical instructions.
- [x] Implement `purgeOutstandingUploads(owner): Promise<void>` with bounded owner-only claims, leases and final deletion after the two-hour upload capability lifetime plus one-minute transport margin.
- [x] Redact late provider webhook content to the frozen subject while preserving the verified receipt hash.
- [x] Verify Support lease/owner/expiry behavior and webhook redaction with observed failing tests followed by passing tests.

### Task 4: Preserve anonymous operational AI cost evidence

- [x] Replace owner AI usage rows with genuinely unlinked monthly aggregates grouped by workload, model, provider and effective reservation status; randomize row/request IDs, remove generation hashes, clear per-request telemetry and coarsen timestamps to the budget month.
- [x] Normalize outstanding reservations to failed in the aggregate, preserving charged cost through the existing stale-reservation rollup without modifying that global function.
- [x] Prove month/workload charged totals, replay safety, unchanged foreign-owner rows and absence of original row/request/generation identifiers with a failing-then-passing actual SQL regression.

Anonymous aggregate cost evidence is retained solely to preserve shared operating budgets. It contains no original owner, request, generation or precise-time link and does not retain financial/user payload.

Validation: 16 actual local SQL integration scenarios and 3 supplement unit tests passed. Full API typecheck, scoped ESLint and exact whole-migration recreation inside a rolled-back local transaction passed. No hosted, provider or device actions were taken; production behavior still requires the parent's scoped deployment and acceptance work.
