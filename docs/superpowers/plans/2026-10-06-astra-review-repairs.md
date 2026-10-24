# Astra Review Repairs Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Repair D1/D2/D3/D4 from the independent Voice/Manual Add review.
**Architecture:** Keep the existing form, owner-bound repository, service, and bounded operational controls. Gate draft loading, preserve unresolved identities, distinguish local preparation from financial dispatch, retry failed owner hydration, and separate trusted shutdown targets from mutable restoration pins.
**Tech Stack:** React Native/TypeScript/Jest; Node CommonJS/node:test.
**Spec:** docs/handoffs/2026-10-06-astra-independent-voice-manual-review-report.md

## Global Constraints

- Work exclusively in the existing voice-auto-batches worktree.
- Preserve documentation, review evidence, original device draft/login/data/journals.
- No financial write, Posting enablement, ordinary worker, host activation/restoration, deployment, install, commit, merge or Production access.
- All financial request tests use inert transport; all operational tests use inert adapters.
- Preserve provider/model/prompt/safety behavior.

## Review Focus

- Failed load must never allow replacement or discard of an unresolved operation.
- Concurrent hydration retries must retain owner isolation and one readiness attempt.
- A new local preparation failure must not look like a possibly posted financial request.
- An already-unknown operation stays frozen through later local/401/429 failures.
- Mutable pin drift must permit trusted shutdown/OFF attempts but prohibit restoration.

### Task 1: D1 draft-load gating and unresolved identity protection
Files: TransactionForm.tsx/test.tsx, core-finance-repository.ts, manual-submission-durability.test.ts, EN/AR messages.
Consumes loadDraft/saveDraft; produces retryable load error with no editable/create/discard path until successful load. Repository rejects replacing a non-null submission identity without reconciliation.
- [x] Write tests for failed load → Retry → restored unknown UUID; repository rejects a different UUID.
- [x] Run focused tests: expect missing retry/gating and replacement rejection failures.
- [x] Implement successful-load-only readiness, explicit retry and repository identity guard.
- [x] Re-run form/durability tests: expect PASS.

### Task 2: D3 retryable owner hydration
Files: core-finance-service.ts/test.ts.
Consumes repository.hydrate/bindOwner; produces retryable readiness for the same repository/owner.
- [x] Write a first-read failure then concurrent successful retry test preserving the frozen draft.
- [x] Run focused test: expect cached rejection.
- [x] Clear failed promise readiness without deleting/rebinding the owner repository.
- [x] Re-run live service and owner tests: expect PASS.

### Task 3: D2 local preparation feedback/retry
Files: TransactionForm.tsx/test.tsx, EN/AR messages.
Consumes durable preparation; produces honest local error and explicit recoverable retry without financial dispatch. Previous unknown identity remains protected.
- [x] Write new preparation-failure/no-dispatch/edit/retry and prior-unknown/local-failure tests.
- [x] Run focused tests: expect false uncertainty/blocked edit.
- [x] Track preparation/dispatch boundaries and preserve uncertainty only when justified.
- [x] Re-run form/durability/live replay tests: expect PASS.

### Task 4: D4 trusted closure independent of mutable pins
Files: ignored canary-host.cjs and canary-controls.test.cjs.
Consumes existing fixed Staging scope and pinned migration credentials. Produces attempted trusted shutdown/OFF before restoration pin checks; independent cleanup entry bypasses enablement guards.
- [x] Write pin drift, stop failure, closure failure, untrusted target, deadline-entry tests with inert adapters.
- [x] Run node:test: expect pin failure bypassing shutdown.
- [x] Separate host/target identity checks from mutable enablement/restoration checks; independently attempt shutdown steps/OFF, require valid pinned closure credentials, restore only after successful closure and full pin validation.
- [x] Re-run controls tests and syntax: expect PASS; live OFF restoration remains unperformed.

### Final verification
- [x] Preserve original reproducer sources outside the application test tree; regression tests assert repaired behavior.
- [x] Run full Mobile test command, typecheck, lint, relevant boundary checks, controls tests/syntax.
- [x] Request a fresh offline review of only this repair delta (authorized by executing-plans skill), handle important findings with focused tests.
- [x] Document changes, passing/failed evidence, and still-unapproved operational/financial boundary.
- [x] Leave all changes uncommitted for review.
