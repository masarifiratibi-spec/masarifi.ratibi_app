# Staging Client Access Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prepare a verified client-access and Voice/Analysis/Assistant recovery candidate without deploying it.

**Architecture:** Extend existing analysis audience checks; retain operating-epoch financial safeguards and narrow workers; add sanitized cause diagnostics.

**Tech Stack:** NestJS/TypeScript, PostgreSQL capabilities/RLS, Jest, Node deployment controls, React Native/Expo, Docker/GitHub CI.

**Spec:** `docs/superpowers/specs/2026-10-10-staging-client-access-design.md`

## Global Constraints

- No Production, main merge/update, Staging service/config/migration mutation or provider/financial write during preparation.
- Preserve all worktrees, branches, stashes, original dirty Voice content and evidence. Reuse the isolated candidate checkout based on 42bcb8c.
- Local tests may use disposable databases only. Existing financial code, validation, limits, Savings and UI designs remain intact.
- The user's explicit autonomous implementation instruction overrides additional local design/plan approval handoffs; deployment approval is still required.

## Review Focus

Inspect arbitrary exception privacy and cause cycles; heartbeat and closure failures; preserved financial kill switches; audience checks in both admission and worker claims; active-owner/claim/context fences; stale pending capture exclusion; concurrent/idempotent financial writes; unrelated-worker preservation; claim-scope deployment checks; migration rollback and provider capacity claims.

### Task 1: Worker exception diagnostics

**Files:** observability safe error helper/logger types; scoped Voice/AiWorker/bootstrap; corresponding unit tests.

- [ ] Write root-error, secret-suppression, nested-cause and stage regressions first.
- [ ] Run focused Jest tests. Expected: new diagnostics assertions fail before production edits.
- [ ] Implement the smallest diagnostic helper and boundary changes, preserving scheduling/closure behavior.
- [ ] Run focused tests, typecheck and lint. Expected: pass; no arbitrary error contents in logs.
- [ ] Commit this logical feature separately.

### Task 2: Authenticated analysis audience

**Files:** new forward migration/checksum; disposable multi-user AI integration tests; deployment guard/snapshot/tests.

- [ ] Write two-owner eligibility, privacy, disabled-policy, quota and Posting-preservation tests.
- [ ] Run disposable database tests. Expected: unaffiliated owner fails before the migration.
- [ ] Add explicit audience with unchanged owner default and shared eligibility checks in review/v3 admission and claims.
- [ ] Prepare guarded authenticated-audience deployment checks, preserving financial/non-target workers.
- [ ] Verify migrations and cross-feature security, then commit separately.

### Task 3: Full release verification and approval packet

**Interfaces:** Tasks 1 and 2 produce the exact source/artifact tested by deployment controls; neither activates a policy.

- [ ] Recheck actual Staging images/queue/monitor and record source versions, current financial baseline hashes and backup evidence without mutation.
- [ ] Audit remaining user/device/provider restrictions; test Assistant and Manual Add separately.
- [ ] Run full exact-commit CI, migrations/security, Mobile and Android checks; prepare standalone APK only if client bundle changes.
- [ ] Produce exact service/image/flag/migration changes and ordered rollback. Mark live provider/device/multi-user gates honestly.
- [ ] Obtain a fresh whole-branch review and address significant findings with failing regressions.
- [ ] Request approval only when the deployment packet is concrete and verified.
